---
name: test-plan-builder
description: Use when you need a comprehensive QA/test plan for a feature that spans one or more repos and should be grounded in what the code ACTUALLY implements (not just the tickets) — e.g. "write a test plan", "what do we need to test before go-live", "production E2E test scenarios", "QA spreadsheet". Fans out parallel research subagents per repo/layer, reconciles reality vs the spec, and produces a multi-tab spreadsheet.
user-invocable: true
version: 1.0.1
repo: https://github.com/bshakr/agent-skills
skill_path: test-plan-builder
---

# Test Plan Builder

Produce a detailed, **code-grounded** test plan for a feature by fanning out parallel research subagents across the repos/layers involved, reconciling what's actually implemented against the spec, and writing it into a formatted, multi-tab spreadsheet a QA engineer can work through.

Core principle: **the code is the source of truth, not the ticket.** Tickets describe intent; shipped code describes behaviour. Every scenario must be backed by a `file:line` reference so a failure can be triaged fast, and any place where the spec and the code disagree (built / partial / not-built) is surfaced explicitly so QA never writes impossible cases.

## Step 0: Version check (run first, every invocation)

The probe covers the Claude Code and Codex install locations; on any other harness,
set `SKILL_DIR` to wherever this `SKILL.md` is installed before running the block.

```bash
SKILL_NAME="test-plan-builder"
SKILL_DIR=""
for d in "$HOME/.claude/skills/$SKILL_NAME" "$HOME/.codex/skills/$SKILL_NAME"; do
  [ -f "$d/SKILL.md" ] && SKILL_DIR="$d" && break
done
if [ -z "$SKILL_DIR" ]; then
  echo "SKILL_NOT_FOUND - set SKILL_DIR to this skill's install directory and re-run this block"
else
  CACHE_FILE="$SKILL_DIR/.last-version-check"
  RAW_URL="https://raw.githubusercontent.com/bshakr/agent-skills/main/test-plan-builder/SKILL.md"
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
fi
```

If it prints `SKILL_NOT_FOUND`, continue the task with the current version rather
than blocking on the check.

If the output starts with `UPDATE_AVAILABLE`, ask the user before proceeding. On yes,
resolve the clone behind the install and pull:

```bash
REPO_DIR=$(git -C "$(dirname "$(readlink -f "$SKILL_DIR/SKILL.md")")" rev-parse --show-toplevel 2>/dev/null)
if [ -n "$REPO_DIR" ]; then
  git -C "$REPO_DIR" pull --ff-only
else
  echo "NO_REPO_FOUND - reinstall from https://github.com/bshakr/agent-skills"
fi
```

If it prints `NO_REPO_FOUND` (the skill was copied, not symlinked), reinstall from
https://github.com/bshakr/agent-skills instead. Then re-read this `SKILL.md` from
disk before continuing.

## Decide the mode FIRST (do not skip)

There are two fundamentally different plans. Producing the wrong one wastes the whole run. Confirm with the user before dispatching anything.

| Mode | Tests what | Steps look like | Use when |
|---|---|---|---|
| **A — Layer/coverage** | Each layer's behaviour & contracts (endpoints, services, schema, components) | API calls, status codes, DB/state assertions, per-component states | Engineers verifying correctness; pre-merge confidence; broad coverage |
| **B — End-user UX (UI-only)** | The whole system behaving correctly from a user's seat | Click-paths through real screens; observable outcomes only; **no API/endpoint calls** | "Test it like a user", pre-go-live E2E, "does the UI even exist" |

Mode B's defining rule: **every step is something a human does in the UI, and every expected result is something they can see.** The backend is still researched (to know what *should* happen), but it is never invoked directly in a step. In Mode B, a missing UI surface is a finding ("verify UI exists → blocked"), not an excuse to drop to the API.

If the user hasn't said, ask (AskUserQuestion). You can produce both as separate tabs.

## Pipeline

### 1. Scope
Read the reference tickets/PRD/design docs (Linear, Notion, repo `docs/`). Extract: the feature's phases, the launch gates (feature flags, allowed values, country/provider limits), the permission model, and which **repos and layers** are involved. Treat ticket content as intent to be verified, not fact.

### 2. Sync every repo to its real default branch — BEFORE researching
Researching a stale checkout produces a plan for code that won't ship. For each repo: find the real upstream (it is not always `main`), check how far behind, and fast-forward.

```bash
for d in <repo dirs>; do
  echo "== $d =="
  git -C "$d" fetch origin --quiet
  echo -n "default: "; git -C "$d" symbolic-ref refs/remotes/origin/HEAD
  echo -n "behind:  "; git -C "$d" rev-list --count @{u}..@{u} 2>/dev/null; \
  git -C "$d" rev-list --count HEAD..$(git -C "$d" rev-parse --abbrev-ref --symbolic-full-name @{u})
  git -C "$d" pull --ff-only 2>&1 | tail -1
done
```

If you already dispatched agents against a stale tree, **stop them, sync, and re-dispatch** — the old output is for the wrong code. (Confirm merge state with `git log` rather than trusting a local branch name.)

### 3. Decompose into independent research domains, dispatch in parallel
One subagent per repo × layer × feature-phase that can be understood without the others (e.g. BE catalog / BE shift-types / BE assignments / FE catalog / FE surfaces / middleware). Run them concurrently (background). For Mode B, also dispatch focused **UI-path** agents whose only job is to confirm exact click-paths and labels and whether each action is doable in the UI today (YES/NO/PARTIAL).

Each agent prompt is self-contained and uses the template in **[research-agent-prompt.md](research-agent-prompt.md)**. Every prompt MUST include:
- The launch gates / scope (flag, allowed values, permissions) so scenarios respect them.
- The repo path + a note that it is now on latest default branch (source of truth; confirm with `git log`).
- **READ-ONLY. Do not modify files. Do not run tests** (state any repo-specific CPU/test-suite guards explicitly — broad test runs can spin up heavy stacks).
- The fixed **scenario schema** below, and an instruction to open with a short "Implementation summary" of routes/components/gates with `file:line`.
- "Your final message IS the deliverable, consumed programmatically — no preamble/signoff."

### 4. Collect the reports
Background agents sometimes finish and only emit an idle signal without delivering their report. If you get an idle notification but no content, message the agent: *"Send your COMPLETE final report to main via SendMessage now — implementation summary + every scenario."* Wait until all domains are in before synthesising.

### 5. Reconcile reality vs spec
Before writing, build two cross-cutting outputs from the reports:
- **Implementation-state caveats** — for every spec'd surface, mark built / partial / not-built. In Mode B these become "verify UI exists" rows or blocked rows; never write steps for a screen that doesn't exist.
- **Risk register** — the agents' "TOP RISK" findings (silent data loss, no-op deletes, dead-ends, missing isolation). These lead the plan.

### 6. Build the workbook
Use **[build_workbook.py](build_workbook.py)** (openpyxl). It produces: a README tab (scope, gates, caveats, legend), a Risk Register & E2E tab (top risks + ordered happy-path journeys to run first), one tab per research domain, priority colour-coding (P0/P1/P2), a Status dropdown (Not run/Pass/Fail/Blocked/N/A/Deferred), and Tester/Notes columns. Fill the script's data lists from the agent reports verbatim (keep the `file:line` refs). One `python -m venv` + `pip install openpyxl` if not present.

Scenario schema (one row each):

`ID | Area | Scenario | Priority | Preconditions | Steps | Expected result | Edge / Risk | Code ref | Status | Tester | Notes`

### 7. Deliver as a Google Sheet
There is usually **no programmatic path** to create a native Google Sheet (the claude.ai Drive connector is typically read-only; no `rclone`/`gdrive` CLI by default). Default: write the `.xlsx`, drop it somewhere easy (e.g. `~/Desktop/`), and tell the user to drag it into Drive with "Convert uploads" on (or right-click → Open with → Google Sheets) — this preserves tabs, colours and dropdowns. Offer the connector/rclone route only if they want hands-off and are willing to authenticate. Confirm the delivery method with AskUserQuestion rather than guessing.

## Quick reference

| Phase | Output |
|---|---|
| Scope | feature phases, gates, repo/layer list |
| Sync | every repo fast-forwarded to real upstream |
| Dispatch | N parallel READ-ONLY research agents, fixed schema |
| Collect | full reports pulled to main |
| Reconcile | implementation-state caveats + risk register |
| Build | multi-tab `.xlsx` via build_workbook.py |
| Deliver | drag-to-Drive Google Sheet |

## Common mistakes

| Mistake | Fix |
|---|---|
| Researching the local checkout as-is | Sync to the real default branch first; it's often many commits behind and may not be `main` |
| Writing scenarios from the ticket | Ground every scenario in `file:line`; the ticket is intent, the code is behaviour |
| Mode B steps that call an API "to verify" | UI-only means UI-only; a missing screen is a finding, not a reason to hit the endpoint |
| Assuming a spec'd UI exists | Confirm built/partial/not-built per surface before writing steps |
| Agent finished but no report arrived | Explicitly request the full report be sent to main |
| Running the repo's test suite to "check" | READ-ONLY research; never run tests (some repos spin up heavy stacks on broad scopes) |
| One mega-agent for everything | Decompose into independent domains and run them concurrently |
| Burying the risks | Lead with a risk register + ordered E2E happy paths; QA runs those first |

## Files
- `research-agent-prompt.md` — copy-paste template for each parallel research subagent.
- `build_workbook.py` — openpyxl workbook generator; fill the data lists from agent reports.
