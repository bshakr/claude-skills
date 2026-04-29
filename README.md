# claude-skills

Personal collection of [Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills) for everyday workflows.

## Skills

| Skill | Version | Purpose |
|-------|---------|---------|
| [`standup`](./standup) | 1.1.0 | Generate a daily standup report against weekly goals, cross-referencing Linear tickets and GitHub PRs, formatted for Slack. |
| [`pr-comments`](./pr-comments) | — | Read PR review comments, evaluate validity, fix valid ones, commit, push, and draft replies. |

## Install

Clone the repo somewhere stable, then symlink each skill into `~/.claude/skills/`:

```bash
git clone https://github.com/bshakr/claude-skills ~/code/claude-skills

mkdir -p ~/.claude/skills
ln -s ~/code/claude-skills/standup ~/.claude/skills/standup
ln -s ~/code/claude-skills/pr-comments ~/.claude/skills/pr-comments
```

Symlinks mean `git pull` instantly updates the live skill. Restart your Claude Code session afterwards so the skill index reloads.

### Per-skill setup

Some skills need additional config. See the individual `SKILL.md` for details:

- `standup` — requires `~/.claude/weekly-goals.yaml`. Format documented in `standup/SKILL.md`.

## Updates

Skills with a `version:` field in their frontmatter self-check for updates on each invocation (cached for 24h). When a newer version is available, the skill will prompt before running. Accept and it pulls the repo for you.

To update manually:

```bash
git -C ~/code/claude-skills pull --ff-only
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
repo: https://github.com/bshakr/claude-skills
skill_path: standup
---
```

## Contributing

This is a personal repo. Open an issue if something is broken or unclear.
