---
name: standup
description: Generate a daily standup status report against weekly goals, cross-referencing Linear tickets and GitHub PRs, formatted for Slack.
user-invocable: true
version: 1.4.0
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
sprint_name: "Tom Bombadil"
sprint_theme: "Lord of the Rings characters"
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
- `sprint_name` (optional): the team's name for this sprint (e.g., a character, place, song). Used to fetch a themed quote/fact for the top of the standup.
- `sprint_theme` (optional): the broader theme the name belongs to (e.g., "Lord of the Rings characters", "Studio Ghibli films"). Helps disambiguate when fetching quotes — e.g., "Frodo" the LOTR character vs. "Frodo" the dog.
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

If `sprint_name` is missing from the YAML, ask the user before proceeding:

> No sprint name set for this week. What's the sprint called? (and what's the theme — e.g., LOTR characters, Ghibli films?)

Then update the YAML with `sprint_name` + `sprint_theme` before continuing.

### 1b. Fetch a themed quote / fact

If `sprint_name` is set, fetch a short quote, phrase, or fun fact tied to it. Use `WebSearch` (or `WebFetch` against a known canonical source) to get something accurate — do NOT make it up from training data, since names like "Tom Bombadil" have many associations and apocrypha.

#### Quality bar — this is the whole point

Optimise for **remarkable, funny, interesting, or iconic**. The standup should feel fun, not like trivia filler. Reject the first plausible result if it doesn't clear the bar.

**Good** (use these):
- Iconic lines the audience recognises ("One does not simply walk into Mordor.")
- Genuinely funny or absurd quotes (Tom Bombadil singing nonsense rhymes)
- Surprising trivia (Tolkien deliberately left Bombadil's nature unexplained — even *he* didn't decide what Tom was)
- Signature catchphrases the character is famous for

**Bad** (skip these):
- Generic descriptive sentences pulled from a wiki summary
- Quotes that need 3+ lines of context to land
- Bland exposition the audience won't recognise as belonging to the theme
- Anything you'd describe as "fine, I guess"

#### Process

1. **Cast a wide net.** Run at least 2 distinct searches to surface a candidate pool:
   - `"<sprint_name>" <sprint_theme> iconic quotes`
   - `"<sprint_name>" famous lines` OR `"<sprint_name>" funny quotes` OR `"<sprint_name>" trivia`
2. **Generate a shortlist of 5 candidates** internally. Mix quotes, trivia, and signature phrases — don't pull all from the same axis.
3. **Score each against the quality bar.** Drop anything bland.
4. **Present 3–5 options to the user the FIRST time a sprint name is used** (or whenever the user says "more options" / "give me alternatives"). Format:
   ```
   1. _"quote"_ — attribution
   2. Fun fact: ...
   3. ...
   ```
   Then ask: "Which one (or want more)?"
5. **On subsequent days**, pick the next-best candidate that hasn't been used yet — no need to re-prompt unless asked.

Keep each item under 2 lines. If search returns nothing usable, fall back to a one-line description of the sprint name and move on — don't block the standup on this.

#### Cache

Cache picked + rejected quotes in `~/.claude/skills/standup/.sprint-quote-cache.json` keyed by `sprint_name`:

```json
{
  "Tom Bombadil": {
    "candidates": [
      "pre-approved quote 1",
      "pre-approved quote 2",
      "pre-approved quote 3"
    ],
    "used": ["quote 1 already shown"],
    "rejected": ["bland quote user passed on"]
  }
}
```

- `candidates` — pre-approved pool. When the user says "save these for next week" or accepts a shortlist, store the full shortlist here. Subsequent daily standups draw from this pool first (oldest unused first) before doing a fresh web search.
- `used` — quotes already shown in this sprint. Cycle when 5+ entries.
- `rejected` — quotes the user passed on. Never show again for the lifetime of the sprint.

Selection order on each daily run:
1. If `candidates` non-empty — pick the first one not in `used` or `rejected`, move it to `used`.
2. Else web-search fresh.

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

- :white_check_mark: **Done** — goal shipped. All tickets complete, work merged. Use this instead of `:large_green_circle:` once a goal is fully delivered.
- :large_green_circle: **On track** — expected to hit the weekly outcome by Friday. Remaining work is straightforward and in progress.
- :large_yellow_circle: **At risk** — might miss without help, scope change, or a decision. Examples: PR waiting on review for days, unclear requirements, too much remaining work for the time left.
- :large_orange_circle: **Delayed** — will bleed into next week. Work is moving but won't land Friday — typically because scope grew or the estimate was off. Not blocked, just slower than planned.
- :red_circle: **Blocked** — completely blocked. Cannot progress until the blocker clears. Examples: committed work blocked with no workaround, key dependency not delivered, decision outstanding.
- :white_circle: **Not started** — work hasn't begun yet but isn't blocked. Use for stretch goals, deprioritised items, or work intentionally deferred.

**Orange vs red:** orange = moving, just late. Red = stopped, can't move. If you can describe progress this week, it's orange not red.

Use the ticket statuses, PR states, day of the week, `effort`, `gated_by`, and any `notes` from the YAML to inform the judgment.

#### Forecasting with effort + gating

The user works with Claude Code, so code-writing is *fast*. Most missed estimates come from confusing code-writing time with human-loop time. Weight the forecast accordingly:

- **Code-writing bottleneck** (no `gated_by`, or `gated_by: none`):
  - `xsmall` / `small` remaining → green even with 1 day left
  - `medium` remaining → green with 2+ days left, yellow with 1 day
  - `large` remaining → yellow with 3+ days, orange with less (will bleed into next week)
- **Human-loop bottleneck** (`gated_by: review | design | external | decision`):
  - PR open and review pending → status depends on review SLA, not code size. Yellow if waiting >24h, orange if reviewer unresponsive, red if dependency not delivered at all.
  - Design / decision pending → yellow if expected this week, orange if slipping to next, red if not committed.
  - External dependency missing → red unless explicitly promised this week.
- **Effort + gating combined**: a `small` goal `gated_by: review` with PR sitting 2 days = yellow despite tiny code surface. A `large` goal with no gating and Claude Code in flight = green if started, orange if scope grew mid-week.

Default to optimism on code volume, pessimism on human-loop time. When in doubt, name the *bottleneck* in a `*Blockers:*` line so the forecast is auditable. If there are no blockers, omit the line entirely — don't write "Blockers: None".

### 5. Format the output (Slack-ready)

Present the standup in Slack mrkdwn format inside a single fenced code block so it can be copy-pasted directly.

Use Slack formatting rules:
- `*bold*` for section headers (not markdown `**bold**`)
- Bullet points with plain `-`
- Use the actual emoji shortcodes: `:white_check_mark:`, `:large_green_circle:`, `:large_yellow_circle:`, `:large_orange_circle:`, `:red_circle:`, `:white_circle:`
- IMPORTANT: The `<url|text>` mrkdwn link syntax does NOT work in Slack's composer (only via API). Do NOT include URLs.
- IMPORTANT: Do NOT include Linear ticket IDs (e.g., PROJ-1234) — they trigger the Linear bot to spam the Slack thread. Use summarised ticket titles instead.

#### Ticket and PR formatting

Each ticket is one line using its **summarised title** (short, no ID). If the ticket has an open PR that's relevant (needs review, blocking), append it inline:

```
- Employee Portal bank details lock (FE) — `In Progress`, PR needs review
- Audit trail frontend page — `In Progress`
```

Rules for ticket lines:
- Summarise the ticket title to be short and clear — strip prefixes like `[FE]`, `[BE]`, `[MW]` and use parenthetical tags instead: `(FE)`, `(BE)`, `(MW)`
- If the ticket has an open PR that needs action, append: `, PR needs review` or `, PR open`
- If the ticket has multiple PRs, only mention the most relevant one (usually the open one)
- Don't mention merged PRs unless the ticket is still in progress (indicates partial work)
- For done goals (`:white_check_mark:`), skip ticket lines entirely — the checkmark already says "shipped"

#### Overall structure

Each goal is a status emoji + bold goal description, followed by 0–N short bullets describing in-flight work or context, and an optional `*Blockers:*` line. **Do not include a `*Today:*` label** — bullets stand alone under the goal heading. **Only include `*Blockers:*` when there is an actual blocker** — omit the line entirely otherwise.

The standup opens with a sprint header line (if `sprint_name` is set) — sprint name + themed quote/fact on a separate line, italicised. Then a blank line, then the weekly goals header.

```
*Sprint: {sprint_name}*
_"{quote or fact}"_ — {attribution if quote}

*Weekly Goals — {week date}*

:white_check_mark: *Shipped goal description*

:large_green_circle: *On-track goal description*
- PR approved, merging today

:large_yellow_circle: *At-risk goal description*
- Working on audit trail frontend page
- Next up: CSV export and feature flag
*Blockers:* Tight on time — 2 tickets remaining with 3 days left

:large_orange_circle: *Delayed goal description*
- Scope grew beyond initial estimate, will bleed into next week
- Finalising plan + sub-ticket breakdown across BE/MW/FE
- Picking up first BE sub-ticket

:red_circle: *Blocked goal description*
- Backend API not delivered — escalating to unblock today
*Blockers:* Waiting on platform team, no ETA

:white_circle: *Stretch goal description*
- Picking this up today
```

Rules:
- One section per goal, prefixed with its status emoji
- For `:white_check_mark:` goals, no bullets needed — the checkmark conveys completion
- Bullets describe what's in flight or what's next — use natural language, not ticket titles
- For partially complete goals, ticket status lines are optional context bullets
- `*Blockers:*` only appears when there is one — never write "Blockers: None"
- Keep it concise — whole standup should be scannable in 30 seconds

Legend (include at the bottom):

```
:white_check_mark: Done — shipped this week
:large_green_circle: On track — expected to hit weekly outcome
:large_yellow_circle: At risk — might miss without help/scope change/decision
:large_orange_circle: Delayed — bleeding into next week, not blocked
:red_circle: Blocked — cannot progress until blocker clears
:white_circle: Not started — stretch / deferred / not yet picked up
```

### 6. Updating weekly goals

If the user asks to "update goals" or "set this week's goals", help them edit `~/.claude/weekly-goals.yaml`:
- Ask them to provide the new goals
- **Ask for the sprint name and theme for this cycle** if not provided (e.g., "Sprint name? Theme?")
- Help map each goal to the relevant Linear ticket IDs (search Linear if needed)
- Write the updated YAML file
- If `sprint_name` changed from the previous cycle, drop or reset the entry for the old name in `.sprint-quote-cache.json`
