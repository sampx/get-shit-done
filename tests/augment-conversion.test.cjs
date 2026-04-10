/**
 * Augment conversion regression tests.
 *
 * Ensures Augment frontmatter names are emitted as plain identifiers
 * (without surrounding quotes), so Augment does not treat quotes as
 * literal parts of skill/subagent names.
 */

process.env.WSF_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  convertClaudeCommandToAugmentSkill,
  convertClaudeAgentToAugmentAgent,
  convertClaudeToAugmentMarkdown,
} = require('../bin/install.js');

describe('convertClaudeCommandToAugmentSkill', () => {
  test('writes unquoted Augment skill name in frontmatter', () => {
    const input = `---
name: quick
description: Execute a quick task
---

<objective>
Test body
</objective>
`;

    const result = convertClaudeCommandToAugmentSkill(input, 'wsf-quick');
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

    const result = convertClaudeCommandToAugmentSkill(input, 'wsf-plan-phase');
    // Slash commands: /wsf-execute-phase -> /wsf-execute-phase
    assert.ok(result.includes('/wsf-execute-phase 17'), 'slash command wsf- -> wsf-');
    assert.ok(result.includes('/wsf-help'), '/wsf-help preserved');
    assert.ok(result.includes('wsf-progress'), 'bare wsf- -> wsf-');
  });

  test('includes augment_skill_adapter block', () => {
    const input = `---
name: test
description: A test skill
---

Body content.
`;

    const result = convertClaudeCommandToAugmentSkill(input, 'wsf-test');
    assert.ok(result.includes('<augment_skill_adapter>'), 'adapter header present');
    assert.ok(result.includes('</augment_skill_adapter>'), 'adapter footer present');
    assert.ok(result.includes('launch-process'), 'launch-process tool mentioned');
    assert.ok(result.includes('str-replace-editor'), 'str-replace-editor tool mentioned');
  });

  test('converts tool names to Augment format', () => {
    const input = `---
name: test
description: Test
---

Use Bash() to run commands.
Use Edit() to modify files.
Use Read() to view files.
`;

    const result = convertClaudeCommandToAugmentSkill(input, 'wsf-test');
    assert.ok(result.includes('launch-process('), 'Bash converted to launch-process');
    assert.ok(result.includes('str-replace-editor('), 'Edit converted to str-replace-editor');
    assert.ok(result.includes('view('), 'Read converted to view');
  });
});

describe('convertClaudeAgentToAugmentAgent', () => {
  test('converts agent frontmatter with unquoted name', () => {
    const input = `---
name: wsf-bugfix
description: "Fix bugs automatically"
tools: Read, Write, Edit, Bash
color: green
---

<role>
You are a bug fixer.
</role>
`;

    const result = convertClaudeAgentToAugmentAgent(input);
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'wsf-bugfix', 'agent name is plain scalar');
    assert.ok(!result.includes('name: "wsf-bugfix"'), 'quoted agent name is not emitted');
  });

  test('removes color and skills from frontmatter', () => {
    const input = `---
name: wsf-test
description: Test agent
color: blue
skills:
  - some-skill
tools: Read, Write
---

<role>
Test role
</role>
`;

    const result = convertClaudeAgentToAugmentAgent(input);

    assert.ok(result.includes('name: wsf-test'), 'name preserved');
    assert.ok(result.includes('description:'), 'description preserved');
    assert.ok(!result.includes('color:'), 'color removed');
    assert.ok(!result.includes('skills:'), 'skills removed');
  });

  test('replaces CLAUDE.md with .augment/rules/', () => {
    const input = `---
name: wsf-test
description: Test
---

See CLAUDE.md for details.
`;

    const result = convertClaudeAgentToAugmentAgent(input);
    assert.ok(result.includes('.augment/rules/'), 'CLAUDE.md replaced with .augment/rules/');
    assert.ok(!result.includes('CLAUDE.md'), 'CLAUDE.md reference removed');
  });
});

describe('convertClaudeToAugmentMarkdown', () => {
  test('replaces Claude Code with Augment', () => {
    const input = 'Use Claude Code tools for this task.';
    const result = convertClaudeToAugmentMarkdown(input);
    assert.strictEqual(result, 'Use Augment tools for this task.');
  });

  test('replaces .claude/skills/ with .augment/skills/', () => {
    const input = 'Check .claude/skills/ for more info.';
    const result = convertClaudeToAugmentMarkdown(input);
    assert.strictEqual(result, 'Check .augment/skills/ for more info.');
  });

  test('normalizes wsf- to wsf-', () => {
    const input = 'Run /wsf-new-project for new projects.';
    const result = convertClaudeToAugmentMarkdown(input);
    assert.strictEqual(result, 'Run /wsf-new-project for new projects.');
  });
});