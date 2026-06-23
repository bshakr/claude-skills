# Research-agent prompt template

One agent per independent domain (repo × layer × feature-phase). Dispatch concurrently (background). Fill the `<...>` placeholders. Keep it self-contained — the agent inherits none of your context.

```
You are researching the <FEATURE> feature to build a <production E2E / QA> test plan. Your output feeds a QA test-plan spreadsheet.

LAUNCH SCOPE / GATES (scenarios must respect these):
- <feature flag(s) and how they gate; brand/tenant-scoped?>
- <allowed values only at launch, e.g. one enum value; rejected elsewhere>
- <country / provider / permission limits>

YOUR SCOPE = <layer / phase> in the repo <ABSOLUTE PATH>.
The repo is now FULLY UP TO DATE with its default branch (production-candidate). Treat the working tree as the source of truth; confirm anything ambiguous with `git log` / `git branch --contains`.

CONSTRAINTS:
- READ-ONLY research + analysis. Do NOT modify files.
- Do NOT run tests / the dev server. <State any repo-specific guard, e.g. "NEVER run the full test suite — it spins up heavy containers.">
- Use ripgrep + direct file reads. Search for: <key symbols, routes, component names, table names>.

DELIVERABLE: a comprehensive list of concrete test scenarios grounded in the ACTUAL implemented code. For EACH scenario give these labeled fields:
- Area | Scenario (short title) | Preconditions | Steps | Expected result | Priority (P0 launch-blocking / P1 / P2) | Edge/risk notes | Code ref (file:line)

For a UI-only (end-user) plan: every Step is a UI action a human takes; every Expected result is something they can SEE. Never call an API in a step. If a needed screen does NOT exist, say so — that becomes a "verify UI exists / blocked" finding, not an API step.

COVER AT MINIMUM: <happy paths, each validation/error, each state transition, permission gating, flag-off behaviour, tenant/brand isolation, idempotency, race/cutoff guards, and the known edge cases relevant to this layer>.

Start with a short "Implementation summary": the actual routes (method+path) / components / DB tables / gates, each with file:line. Then the scenarios.

Be precise and exhaustive. Your final message IS the deliverable — it is consumed programmatically, not shown to a human. No preamble, no signoff. If you only have time to emit an idle signal, still send the full report to main via SendMessage.
```

## Tips
- Give each agent a distinct, narrow domain so they don't overlap or trip on shared state.
- Tell agents that recently-merged work should now be present (name specific tickets/behaviours that were previously unmerged), so they don't report stale gaps.
- For UI-path confirmation (Mode B), a lighter agent whose only job is "map the exact click-path + labels and answer YES/NO/PARTIAL on whether X is doable in the UI today" is worth dispatching separately from the deep behaviour agents.
