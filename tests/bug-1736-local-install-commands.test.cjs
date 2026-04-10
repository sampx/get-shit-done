/**
 * Regression test for #1736: local Claude install missing commands/wsf/
 *
 * After a fresh local install (`--claude --local`), all /wsf:* commands
 * except /wsf-help return "Unknown skill: wsf-quick" because
 * .claude/commands/wsf/ is not populated. Claude Code reads local project
 * commands from .claude/commands/wsf/ (the commands/ format), not from
 * .claude/skills/ — only the global ~/.claude/skills/ is used for skills.
 */

'use strict';

process.env.WSF_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');
const { install, copyCommandsAsClaudeSkills } = require(INSTALL_SRC);

// ─── #1736: local install deploys commands/wsf/ ─────────────────────────────

describe('#1736: local Claude install populates .claude/commands/wsf/', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsf-local-install-1736-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('local install creates .claude/commands/wsf/ directory', (t) => {
    const origCwd = process.cwd();
    t.after(() => { process.chdir(origCwd); });
    process.chdir(tmpDir);
    install(false, 'claude');

    const commandsDir = path.join(tmpDir, '.claude', 'commands', 'wsf');
    assert.ok(
      fs.existsSync(commandsDir),
      '.claude/commands/wsf/ directory must exist after local install'
    );
  });

  test('local install deploys at least one .md command file to .claude/commands/wsf/', (t) => {
    const origCwd = process.cwd();
    t.after(() => { process.chdir(origCwd); });
    process.chdir(tmpDir);
    install(false, 'claude');

    const commandsDir = path.join(tmpDir, '.claude', 'commands', 'wsf');
    assert.ok(
      fs.existsSync(commandsDir),
      '.claude/commands/wsf/ must exist'
    );

    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    assert.ok(
      files.length > 0,
      `.claude/commands/wsf/ must contain at least one .md file, found: ${JSON.stringify(files)}`
    );
  });

  test('local install deploys quick.md to .claude/commands/wsf/', (t) => {
    const origCwd = process.cwd();
    t.after(() => { process.chdir(origCwd); });
    process.chdir(tmpDir);
    install(false, 'claude');

    const quickCmd = path.join(tmpDir, '.claude', 'commands', 'wsf', 'quick.md');
    assert.ok(
      fs.existsSync(quickCmd),
      '.claude/commands/wsf/quick.md must exist after local install'
    );
  });
});
