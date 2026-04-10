---
name: wsf-set-profile
description: Switch model profile for WSF agents (quality/balanced/budget/inherit)
argument-hint: <profile (quality|balanced|budget|inherit)>
model: haiku
allowed-tools:
  - Bash
---

Show the following output to the user verbatim, with no extra commentary:

!`node "$HOME/.claude/wsf/bin/wsf-tools.cjs" config-set-model-profile $ARGUMENTS --raw`
