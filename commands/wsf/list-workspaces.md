---
name: wsf-list-workspaces
description: List active WSF workspaces and their status
allowed-tools:
  - Bash
  - Read
---
<objective>
Scan `~/wsf-workspaces/` for workspace directories containing `WORKSPACE.md` manifests. Display a summary table with name, path, repo count, strategy, and WSF project status.
</objective>

<execution_context>
@~/.claude/wsf/workflows/list-workspaces.md
@~/.claude/wsf/references/ui-brand.md
</execution_context>

<process>
Execute the list-workspaces workflow from @~/.claude/wsf/workflows/list-workspaces.md end-to-end.
</process>
