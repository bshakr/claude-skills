---
name: rich-report
description: Use when a completed plan, investigation, summary, or decision memo needs a polished local webpage — an editorial layer of highlights, timelines, risks, and mermaid diagrams over the full source — added to a local report hub served on localhost.
user-invocable: true
version: 1.0.0
repo: https://github.com/bshakr/agent-skills
skill_path: rich-report
---

# Rich Report

Turn a finished Markdown document into a beautiful local web page. Reports are added
to a single hub at `~/.rich-report` that serves them all from one long-running
server and shows an index grouped by project. You author one MDX file per report; the
full source is always preserved and rendered underneath the editorial layer.

## Step 0: Version check (run first, every invocation)

The probe covers the Claude Code and Codex install locations. On any other harness,
set `SKILL_DIR` to wherever this `SKILL.md` is installed before running the block.

```bash
SKILL_NAME="rich-report"
SKILL_DIR=""
for d in "$HOME/.claude/skills/$SKILL_NAME" "$HOME/.codex/skills/$SKILL_NAME"; do
  [ -f "$d/SKILL.md" ] && SKILL_DIR="$d" && break
done
CACHE_FILE="$SKILL_DIR/.last-version-check"
RAW_URL="https://raw.githubusercontent.com/bshakr/agent-skills/main/rich-report/SKILL.md"
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

If the output starts with `UPDATE_AVAILABLE`, ask the user before proceeding. On yes,
resolve the clone behind the install and pull:

```bash
REPO_DIR=$(git -C "$(dirname "$(readlink -f "$SKILL_DIR/SKILL.md")")" rev-parse --show-toplevel 2>/dev/null)
git -C "$REPO_DIR" pull --ff-only
```

If no git repo is found (the skill was copied, not symlinked), tell the user to
reinstall from https://github.com/bshakr/agent-skills instead. Then re-read this
`SKILL.md` from disk before continuing.

## Workflow

1. Preserve the source. If it lives in the conversation, save it verbatim as a `.md`
   file first. Never rewrite, condense, or reorder it.
2. Add the report to the hub (use an absolute source path when it is elsewhere):

   ```bash
   python scripts/add_report.py <source.md>
   ```

   This syncs the hub app (installing dependencies once — pnpm when available, npm
   otherwise), then creates `~/.rich-report/content/<project>/<slug>/` with your
   source, a `meta.json`, and a starter `report.mdx`. It prints the content directory
   and the report URL. `project` is inferred from the source's git repo (override with
   `--project`), `slug` from the filename (override with `--slug`); `--force` replaces
   an existing report.
3. Read `references/components.md`, then author `report.mdx` in the printed content
   directory:
   - A `Hero` with the source's real title and a one-line summary.
   - Editorial sections (`HighlightGrid`, `ComparisonGrid`, `Timeline`, `RiskList`,
     `ActionList`) built only from facts the source states. Skip any section the
     source has no material for — a sparse source makes a sparse page.
   - `Mermaid` diagrams only for structure the source actually describes.
   - Author sections as top-level MDX blocks separated by blank lines (never
     wrap the page in a component or a `<div>` — the hub supplies the article
     shell), and always end with `<CompleteDocument source={props.source} />`.

   Do not invent titles, numbers, owners, or dates that are not in the source.
4. Serve the hub (idempotent — reuses the running server if one is up):

   ```bash
   python scripts/serve_hub.py
   ```

   The server detaches into its own session and keeps running after this Claude
   session ends; the command verifies the hub is live, prints the URL, and exits.
   Use `--status` to check whether it is up and `--stop` to shut it down.

   Verify the report with
   `curl --fail --silent -o /dev/null -w '%{http_code}\n' <report-url>`. To build-check
   every report at once, run `python scripts/validate_hub.py`.
5. Hand the user the report URL, and mention the index at the hub root
   (`http://127.0.0.1:4400/`). Reports are plain data under `~/.rich-report/content/`
   — never inside a repository, and deleted by removing the folder.

Never report success from a build you did not run, and never replace the complete
source with an editorial summary.
