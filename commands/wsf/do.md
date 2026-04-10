---
name: wsf-do
description: Route freeform text to the right WSF command automatically
argument-hint: "<description of what you want to do>"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
<objective>
Analyze freeform natural language input and dispatch to the most appropriate WSF command.

Acts as a smart dispatcher — never does the work itself. Matches intent to the best WSF command using routing rules, confirms the match, then hands off.

Use when you know what you want but don't know which `/wsf-*` command to run.
</objective>

<execution_context>
@~/.claude/wsf/workflows/do.md
@~/.claude/wsf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the do workflow from @~/.claude/wsf/workflows/do.md end-to-end.
Route user intent to the best WSF command and invoke it.
</process>
