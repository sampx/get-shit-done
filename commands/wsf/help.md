---
name: wsf-help
description: Show available WSF commands and usage guide
allowed-tools:
  - Read
---
<objective>
Display the complete WSF command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<execution_context>
@~/.claude/wsf/workflows/help.md
</execution_context>

<process>
Output the complete WSF command reference from @~/.claude/wsf/workflows/help.md.
Display the reference content directly — no additions or modifications.
</process>
