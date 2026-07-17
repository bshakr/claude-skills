# agent-skills

Personal collection of portable, [Agent Skills](https://agentskills.io)-compatible workflows for Claude Code, Codex, and other supporting agent harnesses.

Repository: https://github.com/bshakr/agent-skills

## Skills

| Skill | Version | Purpose |
|-------|---------|---------|
| [`standup`](./standup) | 1.3.0 | Generate a daily standup report against weekly goals, cross-referencing Linear tickets and GitHub PRs, formatted for Slack. Supports sprint-themed quotes/facts at the top. |
| [`pr-comments`](./pr-comments) | 1.1.0 | Resolve PR review comments end-to-end — fetch, evaluate validity, fix valid ones, commit, push, and draft replies for approval. |
| [`ship-ticket`](./ship-ticket) | 1.0.0 | Ship a Linear ticket end-to-end — worktree off latest main, planned TDD, mandatory `/review`, PR with traceable review SHA. |
| [`test-plan-builder`](./test-plan-builder) | 1.0.0 | Build a code-grounded, multi-tab QA test plan for a feature spanning one or more repos — fans out parallel research subagents per repo/layer, reconciles what's actually implemented vs the spec, and outputs a formatted spreadsheet. |
| [`rich-report`](./rich-report) | — | Turn a completed Markdown plan, summary, or report into a polished local web page — an editorial layer of highlights, timelines, risks, and mermaid diagrams over the full source. Reports are added to a single hub at `~/.rich-report` that serves them all from one long-running server on port 4400 with an index grouped by project. The agent authors one MDX file per report; dependencies install once for the hub. |

## Install

Clone the repo somewhere stable:

```bash
git clone https://github.com/bshakr/agent-skills ~/code/agent-skills
```

Symlink the skills you want into Claude Code:

```bash
mkdir -p ~/.claude/skills
ln -s ~/code/agent-skills/standup ~/.claude/skills/standup
ln -s ~/code/agent-skills/pr-comments ~/.claude/skills/pr-comments
ln -s ~/code/agent-skills/ship-ticket ~/.claude/skills/ship-ticket
ln -s ~/code/agent-skills/test-plan-builder ~/.claude/skills/test-plan-builder
ln -s ~/code/agent-skills/rich-report ~/.claude/skills/rich-report
```

Or into Codex:

```bash
mkdir -p ~/.codex/skills
ln -s ~/code/agent-skills/rich-report ~/.codex/skills/rich-report
```

Symlinks mean `git pull` instantly updates the live skill. Restart the agent session afterwards so its skill index reloads.

### Per-skill setup

Some skills need additional config. See the individual `SKILL.md` for details:

- `standup` — requires `~/.claude/weekly-goals.yaml`. Format documented in `standup/SKILL.md`.

## Updates

Skills with a `version:` field in their frontmatter self-check for updates on each invocation (cached for 24h). When a newer version is available, the skill will prompt before running. Accept and it pulls the repo for you.

To update manually:

```bash
git -C ~/code/agent-skills pull --ff-only
```

## Versioning

Skills follow [SemVer](https://semver.org):

- **Patch** (`1.1.0` → `1.1.1`) — wording tweaks, bug fixes, no behaviour change for the user.
- **Minor** (`1.1.0` → `1.2.0`) — new optional fields, new statuses, additive features.
- **Major** (`1.1.0` → `2.0.0`) — breaking changes to YAML schema or output contract.

Each `SKILL.md` carries the version in its frontmatter:

```yaml
---
name: standup
version: 1.1.0
repo: https://github.com/bshakr/agent-skills
skill_path: standup
---
```

## Contributing

This is a personal repo. Open an issue if something is broken or unclear.
