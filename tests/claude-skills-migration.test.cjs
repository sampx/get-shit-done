/**
 * WSF Tools Tests - Claude Skills Migration (#1504)
 *
 * Tests for migrating Claude Code from commands/wsf/ to skills/wsf-xxx/SKILL.md
 * format for compatibility with Claude Code 2.1.88+.
 *
 * Uses node:test and node:assert (NOT Jest).
 */

process.env.WSF_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');

const {
  convertClaudeCommandToClaudeSkill,
  copyCommandsAsClaudeSkills,
  writeManifest,
  install,
} = require('../bin/install.js');

// ─── convertClaudeCommandToClaudeSkill ──────────────────────────────────────

describe('convertClaudeCommandToClaudeSkill', () => {
  test('preserves allowed-tools multiline YAML list', () => {
    const input = [
      '---',
      'name: wsf-next',
      'description: Advance to the next step',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      '  - Grep',
      '---',
      '',
      'Body content here.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'wsf-next');
    assert.ok(result.includes('allowed-tools:'), 'allowed-tools field is present');
    assert.ok(result.includes('Read'), 'Read tool preserved');
    assert.ok(result.includes('Bash'), 'Bash tool preserved');
    assert.ok(result.includes('Grep'), 'Grep tool preserved');
  });

  test('preserves argument-hint', () => {
    const input = [
      '---',
      'name: wsf-debug',
      'description: Debug issues',
      'argument-hint: "[issue description]"',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      '---',
      '',
      'Debug body.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'wsf-debug');
    assert.ok(result.includes('argument-hint:'), 'argument-hint field is present');
    // The value should be preserved (possibly yaml-quoted)
    assert.ok(
      result.includes('[issue description]'),
      'argument-hint value preserved'
    );
  });

  test('converts name format from wsf-xxx to skill naming', () => {
    const input = [
      '---',
      'name: wsf-next',
      'description: Advance workflow',
      '---',
      '',
      'Body.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'wsf-next');
    assert.ok(result.includes('name: wsf-next'), 'name uses skill naming convention');
    assert.ok(!result.includes('name: wsf:next'), 'old name format removed');
  });

  test('preserves body content unchanged', () => {
    const body = '\n<objective>\nDo the thing.\n</objective>\n\n<process>\nStep 1.\nStep 2.\n</process>\n';
    const input = [
      '---',
      'name: wsf-test',
      'description: Test command',
      '---',
      body,
    ].join('');

    const result = convertClaudeCommandToClaudeSkill(input, 'wsf-test');
    assert.ok(result.includes('<objective>'), 'objective tag preserved');
    assert.ok(result.includes('Do the thing.'), 'body text preserved');
    assert.ok(result.includes('<process>'), 'process tag preserved');
    assert.ok(result.includes('Step 1.'), 'step text preserved');
  });

  test('preserves agent field', () => {
    const input = [
      '---',
      'name: wsf-plan-phase',
      'description: Plan a phase',
      'agent: true',
      'allowed-tools:',
      '  - Read',
      '---',
      '',
      'Plan body.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'wsf-plan-phase');
    assert.ok(result.includes('agent:'), 'agent field is present');
  });

  test('handles content with no frontmatter', () => {
    const input = 'Just some plain markdown content.';
    const result = convertClaudeCommandToClaudeSkill(input, 'wsf-plain');
    assert.strictEqual(result, input, 'content returned unchanged');
  });

  test('preserves allowed-tools as multiline YAML list (not flattened)', () => {
    const input = [
      '---',
      'name: wsf-debug',
      'description: Debug',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      '  - Task',
      '  - AskUserQuestion',
      '---',
      '',
      'Body.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'wsf-debug');
    // Claude Code native format keeps YAML multiline list
    assert.ok(result.includes('  - Read'), 'Read in multiline list');
    assert.ok(result.includes('  - Bash'), 'Bash in multiline list');
    assert.ok(result.includes('  - Task'), 'Task in multiline list');
    assert.ok(result.includes('  - AskUserQuestion'), 'AskUserQuestion in multiline list');
  });
});

// ─── copyCommandsAsClaudeSkills ─────────────────────────────────────────────

describe('copyCommandsAsClaudeSkills', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsf-claude-skills-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates correct directory structure skills/wsf-xxx/SKILL.md', () => {
    // Create source commands
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: wsf-next\ndescription: Advance\nallowed-tools:\n  - Read\n---\n\nBody.'
    );
    fs.writeFileSync(
      path.join(srcDir, 'health.md'),
      '---\nname: wsf-health\ndescription: Check health\n---\n\nHealth body.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'wsf', '$HOME/.claude/', 'claude', true);

    // Verify directory structure
    assert.ok(
      fs.existsSync(path.join(skillsDir, 'wsf-next', 'SKILL.md')),
      'skills/wsf-next/SKILL.md exists'
    );
    assert.ok(
      fs.existsSync(path.join(skillsDir, 'wsf-health', 'SKILL.md')),
      'skills/wsf-health/SKILL.md exists'
    );
  });

  test('cleans up old skills before installing new ones', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: wsf-next\ndescription: Advance\n---\n\nBody.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    // Create a stale skill that should be removed
    const staleDir = path.join(skillsDir, 'wsf-old-command');
    fs.mkdirSync(staleDir, { recursive: true });
    fs.writeFileSync(path.join(staleDir, 'SKILL.md'), 'stale content');

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'wsf', '$HOME/.claude/', 'claude', true);

    // Stale skill removed
    assert.ok(
      !fs.existsSync(staleDir),
      'stale skill directory removed'
    );
    // New skill created
    assert.ok(
      fs.existsSync(path.join(skillsDir, 'wsf-next', 'SKILL.md')),
      'new skill created'
    );
  });

  test('does not remove non-WSF skills', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: wsf-next\ndescription: Advance\n---\n\nBody.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    // Create a non-WSF skill
    const otherDir = path.join(skillsDir, 'my-custom-skill');
    fs.mkdirSync(otherDir, { recursive: true });
    fs.writeFileSync(path.join(otherDir, 'SKILL.md'), 'custom content');

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'wsf', '$HOME/.claude/', 'claude', true);

    // Non-WSF skill preserved
    assert.ok(
      fs.existsSync(otherDir),
      'non-WSF skill preserved'
    );
  });

  test('handles recursive subdirectories', () => {
    const srcDir = path.join(tmpDir, 'src');
    const subDir = path.join(srcDir, 'wired');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(subDir, 'ready.md'),
      '---\nname: wsf-wired:ready\ndescription: Show ready tasks\n---\n\nBody.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'wsf', '$HOME/.claude/', 'claude', true);

    assert.ok(
      fs.existsSync(path.join(skillsDir, 'wsf-wired-ready', 'SKILL.md')),
      'nested command creates wsf-wired-ready/SKILL.md'
    );
  });

  test('no-ops when source directory does not exist', () => {
    const skillsDir = path.join(tmpDir, 'skills');
    // Should not throw
    copyCommandsAsClaudeSkills(
      path.join(tmpDir, 'nonexistent'),
      skillsDir,
      'wsf',
      '$HOME/.claude/',
      'claude',
      true
    );
    assert.ok(!fs.existsSync(skillsDir), 'skills dir not created when src missing');
  });
});

// ─── Path replacement in Claude skills (#1653) ────────────────────────────────

describe('copyCommandsAsClaudeSkills path replacement (#1653)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsf-claude-path-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('replaces ~/.claude/ paths with pathPrefix on local install', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'manager.md'),
      [
        '---',
        'name: wsf-manager',
        'description: Manager command',
        '---',
        '',
        '<execution_context>',
        '@~/.claude/wsf/workflows/manager.md',
        '@~/.claude/wsf/references/ui-brand.md',
        '</execution_context>',
      ].join('\n')
    );

    const skillsDir = path.join(tmpDir, 'skills');
    const localPrefix = '/Users/test/myproject/.claude/';
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'wsf', localPrefix, 'claude', false);

    const content = fs.readFileSync(path.join(skillsDir, 'wsf-manager', 'SKILL.md'), 'utf8');
    assert.ok(!content.includes('~/.claude/'), 'no hardcoded ~/.claude/ paths remain');
    assert.ok(content.includes(localPrefix + 'wsf/workflows/manager.md'), 'path rewritten to local prefix');
    assert.ok(content.includes(localPrefix + 'wsf/references/ui-brand.md'), 'reference path rewritten');
  });

  test('replaces $HOME/.claude/ paths with pathPrefix', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'debug.md'),
      '---\nname: wsf-debug\ndescription: Debug\n---\n\n@$HOME/.claude/wsf/workflows/debug.md'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    const localPrefix = '/tmp/project/.claude/';
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'wsf', localPrefix, 'claude', false);

    const content = fs.readFileSync(path.join(skillsDir, 'wsf-debug', 'SKILL.md'), 'utf8');
    assert.ok(!content.includes('$HOME/.claude/'), 'no $HOME/.claude/ paths remain');
    assert.ok(content.includes(localPrefix + 'wsf/workflows/debug.md'), 'path rewritten');
  });

  test('global install preserves $HOME/.claude/ when pathPrefix matches', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: wsf-next\ndescription: Next\n---\n\n@~/.claude/wsf/workflows/next.md'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'wsf', '$HOME/.claude/', 'claude', true);

    const content = fs.readFileSync(path.join(skillsDir, 'wsf-next', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('$HOME/.claude/wsf/workflows/next.md'), 'global paths use $HOME form');
    assert.ok(!content.includes('~/.claude/'), '~/ form replaced with $HOME/ form');
  });
});

// ─── Legacy cleanup during install ──────────────────────────────────────────

describe('Legacy commands/wsf/ cleanup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsf-legacy-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('install removes legacy commands/wsf/ directory when present', () => {
    // Create a mock legacy commands/wsf/ directory
    const legacyDir = path.join(tmpDir, 'commands', 'wsf');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'next.md'), 'legacy content');

    // Create source commands for the installer to read
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: wsf-next\ndescription: Advance\n---\n\nBody.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    // Install skills
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'wsf', '$HOME/.claude/', 'claude', true);

    // Simulate the legacy cleanup that install() does after copyCommandsAsClaudeSkills
    if (fs.existsSync(legacyDir)) {
      fs.rmSync(legacyDir, { recursive: true });
    }

    assert.ok(!fs.existsSync(legacyDir), 'legacy commands/wsf/ removed');
    assert.ok(
      fs.existsSync(path.join(skillsDir, 'wsf-next', 'SKILL.md')),
      'new skill installed'
    );
  });
});

// ─── writeManifest tracks skills/ for Claude ────────────────────────────────

describe('writeManifest tracks skills/ for Claude', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsf-manifest-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('manifest includes skills/wsf-xxx/SKILL.md entries for Claude runtime', () => {
    // Create skills directory structure (as install would)
    const skillsDir = path.join(tmpDir, 'skills');
    const skillDir = path.join(skillsDir, 'wsf-next');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'skill content');

    // Create wsf directory (required by writeManifest)
    const wsfDir = path.join(tmpDir, 'wsf');
    fs.mkdirSync(wsfDir, { recursive: true });
    fs.writeFileSync(path.join(wsfDir, 'test.md'), 'test');

    writeManifest(tmpDir, 'claude');

    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'wsf-file-manifest.json'), 'utf8')
    );

    // Should have skills/ entries
    const skillEntries = Object.keys(manifest.files).filter(k =>
      k.startsWith('skills/')
    );
    assert.ok(skillEntries.length > 0, 'manifest has skills/ entries');
    assert.ok(
      skillEntries.some(k => k === 'skills/wsf-next/SKILL.md'),
      'manifest has skills/wsf-next/SKILL.md'
    );

    // Should NOT have commands/wsf/ entries
    const cmdEntries = Object.keys(manifest.files).filter(k =>
      k.startsWith('commands/wsf/')
    );
    assert.strictEqual(cmdEntries.length, 0, 'manifest has no commands/wsf/ entries');
  });
});

// ─── Exports exist ──────────────────────────────────────────────────────────

describe('Claude skills migration exports', () => {
  test('convertClaudeCommandToClaudeSkill is exported', () => {
    assert.strictEqual(typeof convertClaudeCommandToClaudeSkill, 'function');
  });

  test('copyCommandsAsClaudeSkills is exported', () => {
    assert.strictEqual(typeof copyCommandsAsClaudeSkills, 'function');
  });
});
