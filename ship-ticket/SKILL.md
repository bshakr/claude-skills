---
name: ship-ticket
description: End-to-end workflow for shipping a Linear ticket. Sets up a fresh worktree off origin/main, plans the work, runs TDD-style implementation, runs /review, addresses findings, and opens a PR. Invoke when the user says "ship X", "tackle the next ticket", "/ship-ticket BLO-XXX", or any phrasing that means "do a whole ticket end-to-end".
user-invocable: true
version: 1.0.1
repo: https://github.com/bshakr/agent-skills
skill_path: ship-ticket
---

# Ship Ticket — End-to-End Workflow

Use this when the user wants a ticket taken from "no branch yet" to "PR opened" without micro-managing each step. The user's CLAUDE.md rules still apply (worktree per ticket, Linear CLI over MCP, no destructive git ops without consent). Re-read `~/.claude/CLAUDE.md` if you've drifted.

## HARD GATE — `/review` is mandatory

Every ticket. Every size. Every category. No "diff is small" or "deletions only" or "I already grepped" exception. The only valid post-commit sequence is **rebase → `/review` → fix findings → push**. If `/review` has not run on the current HEAD, you may not push. The PR body must include `- [x] /review ran on <SHA> — <N findings | 0 findings>`; missing that line means the PR is incomplete. This rule exists because skipping review shipped real regressions in past sessions.

## Step 0: Version check (run first, every invocation)

Before doing anything else, check if a newer version of this skill is available. Skip the network call if it's been done in the last 24 hours. The probe covers the Claude Code and Codex install locations; on any other harness, set `SKILL_DIR` to wherever this `SKILL.md` is installed before running the block.

```bash
SKILL_NAME="ship-ticket"
SKILL_DIR=""
for d in "$HOME/.claude/skills/$SKILL_NAME" "$HOME/.codex/skills/$SKILL_NAME"; do
  [ -f "$d/SKILL.md" ] && SKILL_DIR="$d" && break
done
CACHE_FILE="$SKILL_DIR/.last-version-check"
RAW_URL="https://raw.githubusercontent.com/bshakr/agent-skills/main/ship-ticket/SKILL.md"
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

> ship-ticket skill update available: `{local}` → `{remote}`. Pull updates? (y/n)

If yes, resolve the clone behind the install and pull:

```bash
REPO_DIR=$(git -C "$(dirname "$(readlink -f "$SKILL_DIR/SKILL.md")")" rev-parse --show-toplevel 2>/dev/null)
git -C "$REPO_DIR" pull --ff-only
```

If no git repo is found (the skill was copied, not symlinked), reinstall from https://github.com/bshakr/agent-skills instead. Then re-read this skill from disk before continuing. If the user declines, continue with the current version and don't pester again until the next 24h window.

If the output is `UP_TO_DATE` or `SKIP_CHECK`, proceed silently to Step 1.

## Inputs

- **Required:** Linear ticket id. If user said "next ticket", run `linear next` or `linear issues --mine --unblocked` and propose before claiming.
- **Optional:** target repo path (defaults to current working directory).

If no ticket id can be inferred, stop and ask. Do not invent.

## Step 1 — Set up the worktree

From the main repo (not from inside another worktree). CLAUDE.md mandates `.koh/<branch>`:

```bash
git fetch origin main
git worktree list                    # check for prior worktree on same branch
git worktree add .koh/<branch-name> -b <branch-name> origin/main
cd .koh/<branch-name>
```

- **Branch naming:** `<TICKET-ID>-<short-kebab-summary>`, under ~50 chars.
- **Existing worktree for the same ticket with an open PR:** push to that branch, do not create a parallel one.
- **Working directory is a merged worktree:** note it, do not auto-remove without user consent.

Then: `linear issue start <TICKET-ID>` (best-effort).

## Step 2 — Get ticket context

```bash
linear issue show <TICKET-ID>
```

Read the body, acceptance criteria, and any linked spec/plan docs (e.g. `docs/superpowers/plans/...`). If acceptance criteria are missing or scope is genuinely unclear, ask the user before writing code.

## Step 3 — Plan carefully

This is the step most people skip. Don't. Before writing any code:

1. **Identify the files you'll touch.** Read + Grep them, including callers of any symbols you're about to change.
2. **Check existing patterns.** Match conventions of similar features (tests, error handling, naming).
3. **Find load-bearing constraints** (fixture relationships, validation contexts, idempotency keys, multi-tenant scoping). Document any deviation from spec with a one-sentence "why".
4. **Set up task tracking** with TaskCreate — one task per concrete deliverable, no speculative entries.
5. **State the plan to the user** in 3–6 lines: scope, files, deviations. Then start.

The plan summary catches misdirections that would otherwise cost an hour of throwaway code.

## Step 4 — TDD implementation

Per task: write the failing test → run it → confirm RED → implement minimum → re-run → confirm GREEN → mark completed.

When you touch a service or model, run dependent tests too (don't let CI surface regressions).

**Do not commit between tasks.** One logical commit per ticket is the norm.

## Step 5 — Pre-commit checks

1. **Full test suite** (or the smallest scope known to cover all affected code).
2. **Lint** changed files (`bundle exec rubocop -f simple <files>`, `npm run lint`, `ruff`/`black --check`).
3. **Read `git diff` once** — no debug prints, no stray files.

## Step 6 — Commit

```bash
git add <explicit-file-list>          # no `git add -A` / `git add .`
git status                            # verify staged set
git commit -m "$(cat <<'EOF'
<TICKET-ID>: <one-line summary, imperative mood>

<2-4 paragraphs: WHAT changed and WHY. Note any spec deviation. Reference parent epic.>
EOF
)"
```

CLAUDE.md commit rules apply: no `--no-verify`, no force ops, never `-uall`, explicit file lists.

## Step 7 — Review (MANDATORY — see Hard Gate)

**Rebase first.** Other PRs may have landed:

```bash
git fetch origin main --quiet
git log --oneline HEAD..origin/main      # what landed since branch point?
git rebase origin/main                   # if anything new
```

Resolve conflicts deliberately — don't `--skip`. If risky, `--abort` and ask. Re-run tests after a clean rebase.

**Capture the SHA**: `git rev-parse HEAD`. You'll need it for the PR body and Step 8 precondition.

**Run `/review`** via the Skill tool. It will detect scope drift, run a critical pass (SQL safety, races, enum completeness), dispatch specialists for meaty diffs, and run an adversarial pass (Claude + Codex if available).

Classify findings:

- **AUTO-FIX** — mechanical fixes a senior engineer would apply without discussion (drop wasted eager load, tighten idempotency key, fix comment). Apply directly. Add tests where non-trivial.
- **ASK** — design decisions, user-visible behavior, scope changes. Batch into one AskUserQuestion with a recommendation.
- **Out of scope** — note in PR body's "Out of scope" section; don't expand the diff.

After fixes: re-run affected tests + full suite, re-run lint, **commit review fixes as a separate commit** so the diff reads as "implementation" then "review fixes". If you commit after `/review`, either re-run it against the new HEAD or be explicit in the PR body that the second commit was just the auto-fix batch from the recorded SHA.

**Zero findings is a valid outcome** — record it as `0 findings`. The gate enforces that review *ran*, not that it always finds bugs.

## Step 8 — Push and open PR

**Precondition:** can you state "`/review` ran on SHA `<x>`, N findings addressed (or 0 findings)"? If not, go back to Step 7. Do not push.

```bash
git push -u origin <branch-name>
gh pr create --title "<TICKET-ID>: <one-line summary>" --body "$(cat <<'EOF'
## Summary

<2-4 sentences: what this PR does + which epic it's part of>

Fixes <TICKET-ID>.

## What changes

- Bullet list of meaningful changes. Skip noise.
- Note any spec deviation with reason.

## Out of scope

- Items deferred to later phases (link tickets).
- Items flagged in review but accepted as design decisions.

## Test plan

- [x] <test runner invocation + result, e.g. "49 runs, 143 assertions, 0 failures">
- [x] Full suite passes
- [x] Lint clean
- [x] /review ran on <SHA> — <N findings, all addressed | 0 findings>
- [ ] After merge: manual verification on staging
EOF
)"
```

Use `Fixes <TICKET-ID>` so Linear auto-closes the ticket on merge. Return the PR URL.

## What NOT to do

- **Do NOT skip `/review`.** Ever. Not for small diffs, "obvious" deletions, refactors, or typo fixes. If you're rationalizing "this one doesn't need it" — that is exactly when to run it. The Hard Gate is non-negotiable.
- **Do NOT push or `gh pr create` before `/review` has run and findings are addressed.** This bug shipped twice in past sessions; both times review would have caught a real regression.
- **Do NOT reuse a branch from a previous PR.** New ticket = new worktree off latest `origin/main`.
- **Do NOT commit until implementation and tests pass.** Half-done commits pollute the diff.
- **Do NOT skip the plan summary** even when the ticket seems trivial.
- **Do NOT auto-merge or auto-deploy.** Leave the PR for the user.
- **Do NOT silently expand scope.** Out-of-scope items go in the PR description.

## End state

1. A green PR linked to the Linear ticket.
2. Either two commits (implementation + review fixes) or one commit with `/review ran on <SHA> — 0 findings` in the PR body. A single-commit PR without that line means the gate was skipped.
3. Linear ticket auto-moved to "In Review".
4. PR URL printed in the chat.
