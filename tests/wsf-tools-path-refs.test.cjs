/**
 * Regression guard for #1766: $WSF_TOOLS env var undefined
 *
 * All command files must use the resolved path to wsf-tools.cjs
 * ($HOME/.claude/wsf/bin/wsf-tools.cjs), not the undefined
 * $WSF_TOOLS variable. This test catches any command file that
 * references the undefined variable.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'wsf');

describe('command files: wsf-tools path references (#1766)', () => {
  test('no command file references undefined $WSF_TOOLS variable', () => {
    const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(COMMANDS_DIR, file), 'utf-8');
      // Match $WSF_TOOLS or "$WSF_TOOLS" or ${WSF_TOOLS} used as a path
      // (not as a documentation reference)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\$WSF_TOOLS\b/.test(line) && /node\s/.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    assert.strictEqual(violations.length, 0,
      'Command files must not reference undefined $WSF_TOOLS. ' +
      'Use $HOME/.claude/wsf/bin/wsf-tools.cjs instead.\n' +
      'Violations:\n' + violations.join('\n'));
  });

  test('workstreams.md uses standard wsf-tools.cjs path', () => {
    const content = fs.readFileSync(
      path.join(COMMANDS_DIR, 'workstreams.md'), 'utf-8'
    );
    const nodeLines = content.split('\n').filter(l => /node\s/.test(l));

    assert.ok(nodeLines.length > 0,
      'workstreams.md should contain node invocations');

    for (const line of nodeLines) {
      assert.ok(
        line.includes('wsf-tools.cjs'),
        'Each node invocation must reference wsf-tools.cjs, got: ' + line.trim()
      );
    }
  });
});
