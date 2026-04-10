/**
 * Cursor conversion regression tests.
 *
 * Ensures Cursor frontmatter names are emitted as plain identifiers
 * (without surrounding quotes), so Cursor does not treat quotes as
 * literal parts of skill/subagent names.
 */

process.env.WSF_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  convertClaudeCommandToCursorSkill,
  convertClaudeAgentToCursorAgent,
} = require('../bin/install.js');

describe('convertClaudeCommandToCursorSkill', () => {
  test('writes unquoted Cursor skill name in frontmatter', () => {
    const input = `---
name: quick
description: Execute a quick task
---

<objective>
Test body
</objective>
`;

    const result = convertClaudeCommandToCursorSkill(input, 'wsf-quick');
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'wsf-quick', 'skill name is plain scalar');
    assert.ok(!result.includes('name: "wsf-quick"'), 'quoted skill name is not emitted');
  });

  test('preserves slash for slash commands in markdown body', () => {
    const input = `---
name: wsf-plan-phase
description: Plan a phase
---

Next:
/wsf-execute-phase 17
/wsf-help
wsf-progress
`;

    const result = convertClaudeCommandToCursorSkill(input, 'wsf-plan-phase');

    assert.ok(result.includes('/wsf-execute-phase 17'), 'slash command remains slash-prefixed');
    assert.ok(result.includes('/wsf-help'), 'existing slash command is preserved');
    assert.ok(result.includes('wsf-progress'), 'non-slash wsf- references still normalize');
    assert.ok(!result.includes('/wsf:execute-phase'), 'legacy colon command form is removed');
  });
});

describe('convertClaudeAgentToCursorAgent', () => {
  test('writes unquoted Cursor agent name in frontmatter', () => {
    const input = `---
name: wsf-planner
description: Planner agent
tools: Read, Write
color: green
---

<role>
Planner body
</role>
`;

    const result = convertClaudeAgentToCursorAgent(input);
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'wsf-planner', 'agent name is plain scalar');
    assert.ok(!result.includes('name: "wsf-planner"'), 'quoted agent name is not emitted');
  });
});
