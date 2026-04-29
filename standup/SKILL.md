---
name: standup
description: Generate a daily standup status report against weekly goals, cross-referencing Linear tickets and GitHub PRs, formatted for Slack.
user-invocable: true
---

# Daily Standup Generator

Generate a standup status report by cross-referencing your weekly goals with Linear ticket statuses and GitHub PRs, formatted for pasting into Slack.

## Setup

Create a file at `~/.claude/weekly-goals.yaml` with your weekly goals:

```yaml
week: "2026-04-14 / 2026-04-18"
goals:
  - description: "Implement user authentication flow"
    tickets:
      - PROJ-1234
      - PROJ-1235
    notes: "Blocked on design review until Wednesday"
  - description: "Fix checkout page performance"
    tickets:
      - PROJ-1300
```

- `week`: the Monday/Friday date range for the current cycle
- `goals`: list of goals, each with a `description`, `tickets` (Linear issue IDs), and optional `notes`

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

Use the ticket statuses, PR states, day of the week, volume of remaining work, and any `notes` from the YAML to inform the judgment.

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
