---
name: wsf-remove-workspace
description: Remove a WSF workspace and clean up worktrees
argument-hint: "<workspace-name>"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<context>
**Arguments:**
- `<workspace-name>` (required) — Name of the workspace to remove
</context>

<objective>
Remove a workspace directory after confirmation. For worktree strategy, runs `git worktree remove` for each member repo first. Refuses if any repo has uncommitted changes.
</objective>

<execution_context>
@~/.claude/wsf/workflows/remove-workspace.md
@~/.claude/wsf/references/ui-brand.md
</execution_context>

<process>
Execute the remove-workspace workflow from @~/.claude/wsf/workflows/remove-workspace.md end-to-end.
</process>
