---
name: pr-comments
description: Resolve PR review comments end-to-end — fetch comments, evaluate validity against the codebase, fix valid ones in code, commit + push, then draft replies for each comment and wait for user approval before posting. Use when the user wants to address review feedback on a PR.
user-invocable: true
argument-hint: "<pr-number-or-url>"
version: 1.1.0
repo: https://github.com/bshakr/claude-skills
skill_path: pr-comments
---

# Resolve PR Review Comments

Given a PR, read all review comments, evaluate each for validity, fix the valid ones in code, commit and push, then draft reply text for each comment and wait for user approval before posting.

## Step 0: Version check (run first, every invocation)

Before doing anything else, check if a newer version of this skill is available. Skip the network call if it's been done in the last 24 hours.

```bash
SKILL_DIR="$HOME/.claude/skills/pr-comments"
CACHE_FILE="$SKILL_DIR/.last-version-check"
RAW_URL="https://raw.githubusercontent.com/bshakr/claude-skills/main/pr-comments/SKILL.md"
LOCAL_VERSION=$(awk -F': ' '/^version:/ {print $2; exit}' "$SKILL_DIR/SKILL.md")
NOW=$(date +%s)
LAST_CHECK=$(cat "$CACHE_FILE" 2>/dev/null || echo 0)

if [ $((NOW - LAST_CHECK)) -gt 86400 ]; then
  REMOTE_VERSION=$(curl -fsSL "$RAW_URL" 2>/dev/null | awk -F': ' '/^version:/ {print $2; exit}')
  echo "$NOW" > "$CACHE_FILE"
  if [ -n "$REMOTE_VERSION" ] && [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
    echo "UPDATE_AVAILABLE local=$LOCAL_VERSION remote=$REMOTE_VERSION"
  else
    echo "UP_TO_DATE version=$LOCAL_VERSION"
  fi
else
  echo "SKIP_CHECK version=$LOCAL_VERSION"
fi
```

If the output starts with `UPDATE_AVAILABLE`, ask the user before proceeding:

> pr-comments skill update available: `{local}` → `{remote}`. Pull updates? (y/n)

If yes, run:

```bash
git -C ~/code/claude-skills pull --ff-only
```

Then re-read this skill from disk before continuing.

If the user declines or the skill isn't installed via git (no `.git` dir resolvable), continue with the current version and don't pester again until the next 24h window.

If the output is `UP_TO_DATE` or `SKIP_CHECK`, proceed silently to Step 1.

## Steps

### 1. Fetch all review comments

```
gh api repos/{owner}/{repo}/pulls/{pr}/comments --jq '.[] | "---\nID: \(.id)\nFILE: \(.path):\(.original_line // .line)\nBODY: \(.body)\n"'
```

If the PR is provided as a URL, extract the owner/repo/number from it. If only a number is given, use the current repo.

### 2. Evaluate each comment

For each comment:
- Read the relevant code in the file at the referenced line
- Determine if the comment is **valid** (a real bug, missing requirement, or meaningful improvement) or **not valid** (incorrect suggestion, conflicts with intentional design decisions, inconsistent with codebase conventions, or would break other functionality)
- Consider the broader codebase context — does the existing code follow the same pattern the comment is criticizing? If so, the comment may be applying standards inconsistently.
- Check if the suggested fix (if any) would actually work or would introduce new problems

### 3. Present evaluation summary

Before making any changes, present a summary table to the user:

| # | File | Comment summary | Valid? | Action |
|---|------|----------------|--------|--------|

This gives the user a chance to override any assessment before code changes are made.

### 4. Fix valid comments

For each comment assessed as valid:
- Make the code change
- Update any affected tests
- Run lint on modified files
- Run relevant tests to verify

### 5. Commit and push

- Stage all changed files
- Create a single commit with message: `Address review feedback` followed by a bullet list of what was fixed
- Push using stax: `stax branch submit --no-prompt --no-template --force`

### 6. Draft replies and wait for approval

Present ALL draft replies (for both valid and invalid comments) to the user in a single message. Format each reply clearly:

```
Comment #N (FILE:LINE) — [FIXED / NOT FIXING]
> [brief summary of the comment]

Draft reply:
[the reply text]
```

**Do NOT post any replies until the user explicitly approves.** The user may want to edit the wording or change the assessment.

### 7. Post approved replies

Once the user approves, post all replies using:

```
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies --method POST -f body="..."
```

## Important rules

- **Never post replies without explicit user approval** — always show drafts first
- When dismissing a comment, explain WHY (intentional design decision, follows existing pattern, suggested fix would break X, etc.)
- When confirming a fix, reference the commit hash
- Keep replies concise and professional
- If a comment is from a bot (like Cubic), still evaluate it on its merits — bots can be wrong
- If the user provided context earlier in the conversation about intentional design decisions, use that context when evaluating comments
