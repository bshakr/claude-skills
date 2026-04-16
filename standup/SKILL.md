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

Determine the goal's overall status:
- :large_green_circle: **Green** — ALL tickets are `Done`
- :large_yellow_circle: **Yellow** — at least one ticket is actively being worked on (`In Progress`, `In Review`) and none are blocked
- :red_circle: **Red** — any ticket is explicitly `Blocked`, or the goal has made no progress (all tickets still `To Do` / `Backlog`)

### 3. Gather related GitHub PRs

First, determine the current GitHub username:

```bash
gh api user --jq '.login'
```

For each ticket ID found in step 2, search for PRs whose title or branch contains the ticket identifier:

```bash
gh search prs --author=$GITHUB_USER --owner=$REPO_OWNER "$TICKET_ID" --sort=updated --json title,url,state,repository,mergedAt --limit 5
```

Run these in parallel where possible.

Note: `--owner` should be inferred from the current repo (`gh repo view --json owner --jq '.owner.login'`) or omitted if not in a repo context.

### 4. Format the output (Slack-ready)

Present the standup in Slack mrkdwn format inside a single fenced code block so it can be copy-pasted directly.

Use Slack formatting rules:
- `*bold*` for section headers (not markdown `**bold**`)
- Bullet points with plain `-`
- Use the actual emoji shortcodes: `:large_green_circle:`, `:large_yellow_circle:`, `:red_circle:`
- IMPORTANT: The `<url|text>` mrkdwn link syntax does NOT work in Slack's composer (only via API). Do NOT include URLs — just show PR titles.

Structure:

```
*Weekly Goals Status — {week date}*

:large_green_circle: *Goal description*
- PROJ-1234: Ticket title — `Done`

:large_yellow_circle: *Goal description*
- PROJ-1234: Ticket title — `In Progress`
  - PR: PR title here (`OPEN`)
- PROJ-5678: Ticket title — `Done` :white_check_mark:

:red_circle: *Goal description* — _blocked on X_
- PROJ-1234: Ticket title — `Blocked`
```

Rules:
- One section per goal, prefixed with its status emoji, goal description in bold
- Under each goal, list its tickets with Linear status
- Show PR titles (no URLs) with their state (`OPEN`, `MERGED`) for yellow/red goals
- If a goal has `notes` in the YAML, append them as italicized context after the goal description
- For green goals, keep it brief — just confirm done, no PR listings
- For done tickets, add :white_check_mark: after the status
- Keep it concise — one line per ticket, PRs indented under their ticket

### 5. Updating weekly goals

If the user asks to "update goals" or "set this week's goals", help them edit `~/.claude/weekly-goals.yaml`:
- Ask them to provide the new goals
- Help map each goal to the relevant Linear ticket IDs (search Linear if needed)
- Write the updated YAML file
