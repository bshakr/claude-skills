---
name: standup
description: Generate a daily standup status report against weekly goals, cross-referencing Linear tickets and GitHub PRs, formatted for Slack.
user-invocable: true
version: 1.1.0
repo: https://github.com/bshakr/claude-skills
skill_path: standup
---

# Daily Standup Generator

Generate a standup status report by cross-referencing your weekly goals with Linear ticket statuses and GitHub PRs, formatted for pasting into Slack.

## Step 0: Version check (run first, every invocation)

Before doing anything else, check if a newer version of this skill is available. Skip the network call if it's been done in the last 24 hours.

```bash
SKILL_DIR="$HOME/.claude/skills/standup"
CACHE_FILE="$SKILL_DIR/.last-version-check"
RAW_URL="https://raw.githubusercontent.com/bshakr/claude-skills/main/standup/SKILL.md"
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

> standup skill update available: `{local}` → `{remote}`. Pull updates? (y/n)

If yes, run:

```bash
# If installed via git clone + symlink:
git -C ~/code/claude-skills pull --ff-only

# Then re-read this skill from disk before continuing.
```

If the user declines or the skill isn't installed via git (no `.git` dir resolvable), continue with the current version and don't pester again until the next 24h window.

If the output is `UP_TO_DATE` or `SKIP_CHECK`, proceed silently to Step 1.

## Setup

Create a file at `~/.claude/weekly-goals.yaml` with your weekly goals:

```yaml
week: "2026-04-14 / 2026-04-18"
goals:
  - description: "Implement user authentication flow"
    tickets:
      - PROJ-1234
      - PROJ-1235
    effort: medium
    gated_by: design
    notes: "Blocked on design review until Wednesday"
  - description: "Fix checkout page performance"
    tickets:
      - PROJ-1300
    effort: small
```

- `week`: the Monday/Friday date range for the current cycle
- `goals`: list of goals, each with:
  - `description` — short outcome statement
  - `tickets` — Linear issue IDs
  - `effort` (optional) — code-writing size with Claude Code: `xsmall` | `small` | `medium` | `large` (see sizing reference below)
  - `gated_by` (optional) — `review` | `design` | `external` | `decision` | `none`. Names the human-loop bottleneck that won't compress with Claude Code velocity. Default `none`.
  - `notes` (optional) — anything the forecaster should know

#### Effort sizing reference (Claude Code-assisted)

These are *code-writing* estimates assuming Claude Code does most of the typing. They do NOT include review latency, design wait, or external dependencies — those go in `gated_by`.

| Size | Wall-clock to a ready-for-review PR | Examples |
|------|-------------------------------------|----------|
| `xsmall` | < 1 hour | Copy tweak, single-file rename, one-line config |
| `small` | half a day or less | Single component, one CRUD endpoint, narrow refactor |
| `medium` | 1–2 days | Multi-file feature, FE+BE wiring, new card with API hooks |
| `large` | 3+ days | Cross-repo work, new subsystem, schema migration with backfill |

Rule of thumb: if the *code* is small but the goal still won't land, the bottleneck is `gated_by`, not effort.

## Steps

### 1. Load weekly goals

Read the file `~/.claude/weekly-goals.yaml`.

If the file is missing or stale, tell the user and stop.

### 2. Query Linear for each goal's tickets

For each goal, use `mcp__claude_ai_Linear__list_issues` (or `get_issue`) to fetch the status of every ticket listed under that goal.

### 3. Gather related GitHub PRs

First, determine the current GitHub username:

```bash
gh api user --jq '.login'
```

For each ticket that is NOT `Done`, search for PRs:

```bash
gh search prs --author=$GITHUB_USER --owner=$REPO_OWNER "$TICKET_ID" --sort=updated --json title,state,url --limit 5
```

Run these in parallel where possible.

Note: `--owner` should be inferred from the current repo (`gh repo view --json owner --jq '.owner.login'`) or omitted if not in a repo context.

### 4. Determine goal status

For each goal, make a **judgment call** about whether the weekly goal will be completed by end of week (Friday). The status is NOT a mechanical roll-up of ticket states — it's a forecast:

- :large_green_circle: **On track** — expected to hit the weekly outcome by Friday. Most tickets done, remaining work is straightforward and in progress.
- :large_yellow_circle: **At risk** — might miss without help, scope change, or a decision. Examples: PR waiting on review for days, unclear requirements blocking progress, too much remaining work for the time left.
- :red_circle: **Off track** — will miss unless the plan materially changes. Examples: committed work blocked with no workaround, key dependency not met, in-flight work derailed.
- :white_circle: **Not started** — work hasn't begun yet but isn't off track. Use for stretch goals, deprioritised items, or work intentionally deferred. Distinct from `:red_circle:`, which is for committed work that's failing.

Use the ticket statuses, PR states, day of the week, `effort`, `gated_by`, and any `notes` from the YAML to inform the judgment.

#### Forecasting with effort + gating

The user works with Claude Code, so code-writing is *fast*. Most missed estimates come from confusing code-writing time with human-loop time. Weight the forecast accordingly:

- **Code-writing bottleneck** (no `gated_by`, or `gated_by: none`):
  - `xsmall` / `small` remaining → green even with 1 day left
  - `medium` remaining → green with 2+ days left, yellow with 1 day
  - `large` remaining → yellow with 3+ days, red with less
- **Human-loop bottleneck** (`gated_by: review | design | external | decision`):
  - PR open and review pending → status depends on review SLA, not code size. Yellow if waiting >24h, red if dependency not delivered.
  - Design / decision pending → yellow if expected this week, red if not committed.
  - External dependency missing → red unless explicitly promised this week.
- **Effort + gating combined**: a `small` goal `gated_by: review` with PR sitting 2 days = yellow despite tiny code surface. A `large` goal with no gating and Claude Code in flight = green if started.

Default to optimism on code volume, pessimism on human-loop time. When in doubt, name the *bottleneck* in the *Blockers:* line so the forecast is auditable.

### 5. Format the output (Slack-ready)

Present the standup in Slack mrkdwn format inside a single fenced code block so it can be copy-pasted directly.

Use Slack formatting rules:
- `*bold*` for section headers (not markdown `**bold**`)
- Bullet points with plain `-`
- Use the actual emoji shortcodes: `:large_green_circle:`, `:large_yellow_circle:`, `:red_circle:`, `:white_circle:`
- IMPORTANT: The `<url|text>` mrkdwn link syntax does NOT work in Slack's composer (only via API). Do NOT include URLs.
- IMPORTANT: Do NOT include Linear ticket IDs (e.g., PROJ-1234) — they trigger the Linear bot to spam the Slack thread. Use summarised ticket titles instead.

#### Ticket and PR formatting

Each ticket is one line using its **summarised title** (short, no ID). If the ticket has an open PR that's relevant (needs review, blocking), append it inline:

```
- Extract Staffology pay lines (BE) — `Done` :white_check_mark:
- Employee Portal bank details lock (FE) — `In Progress`, PR needs review
- Audit trail frontend page — `In Progress`
```

Rules for ticket lines:
- Summarise the ticket title to be short and clear — strip prefixes like `[FE]`, `[BE]`, `[MW]` and use parenthetical tags instead: `(FE)`, `(BE)`, `(MW)`
- Append `:white_check_mark:` after `Done` tickets
- If the ticket has an open PR that needs action, append: `, PR needs review` or `, PR open`
- If the ticket has multiple PRs, only mention the most relevant one (usually the open one)
- Don't mention merged PRs unless the ticket is still in progress (indicates partial work)
- For goals where all tickets are `Done`, skip individual ticket lines — just say "All tickets complete"

#### Overall structure

```
*Weekly Goals — {week date}*

:large_green_circle: *Goal description*
*Today:*
- All tickets complete
*Blockers:* None

:large_yellow_circle: *Goal description*
*Today:*
- Working on audit trail frontend page
- Next up: CSV export and feature flag
*Blockers:* Tight on time — 2 tickets remaining with 3 days left

:red_circle: *Goal description*
*Today:*
- Blocked on backend API — escalating to unblock today
*Blockers:* Backend dependency not delivered, will miss unless scope dropped

:white_circle: *Stretch goal description*
*Today:*
- Not started — will pick up if primary goals land early
*Blockers:* None — capacity-dependent
```

Rules:
- One section per goal, prefixed with its status emoji
- *Today:* — 1-3 bullets describing what will be worked on today, inferred from in-progress/to-do tickets and open PRs. Use natural language, not ticket titles.
- *Blockers:* — `None` if clear, otherwise name the blocker, who can unblock it, and any PRs needing review. Don't be shy about naming people.
- Under *Today:*, optionally include ticket status lines for goals that are partially complete (mix of done and in-progress). Skip them for fully done or fully not-started goals.
- Keep it concise — the whole standup should be scannable in 30 seconds

Legend (include at the bottom):

```
:large_green_circle: On track — expected to hit weekly outcome
:large_yellow_circle: At risk — might miss without help/scope change/decision
:red_circle: Off track — will miss unless plan materially changes
:white_circle: Not started — stretch / deferred / not yet picked up
```

### 6. Updating weekly goals

If the user asks to "update goals" or "set this week's goals", help them edit `~/.claude/weekly-goals.yaml`:
- Ask them to provide the new goals
- Help map each goal to the relevant Linear ticket IDs (search Linear if needed)
- Write the updated YAML file
