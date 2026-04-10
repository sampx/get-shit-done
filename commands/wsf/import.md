---
name: wsf-import
description: Ingest external plans with conflict detection against project decisions before writing anything.
argument-hint: "--from <filepath>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
Import external plan files into the WSF planning system with conflict detection against PROJECT.md decisions.

- **--from**: Import an external plan file, detect conflicts, write as WSF PLAN.md, validate via wsf-plan-checker.

Future: `--prd` mode for PRD extraction is planned for a follow-up PR.
</objective>

<execution_context>
@~/.claude/wsf/workflows/import.md
@~/.claude/wsf/references/ui-brand.md
@~/.claude/wsf/references/gate-prompts.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the import workflow end-to-end.
</process>
