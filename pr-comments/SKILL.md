---
name: pr-comments
description: Read PR review comments, evaluate validity, fix valid ones, commit, push, and draft replies for approval. Use when the user wants to address review comments on a PR.
user-invocable: true
argument-hint: "<pr-number-or-url>"
---

# Resolve PR Review Comments

Given a PR, read all review comments, evaluate each for validity, fix the valid ones in code, commit and push, then draft reply text for each comment and wait for user approval before posting.

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
