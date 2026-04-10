/**
 * Regression tests for:
 *   #1656 — 3 bash hooks referenced in settings.json but never installed
 *   #1657 — SDK install prompt fires and fails during interactive install
 */

'use strict';

process.env.WSF_TEST_MODE = '1';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HOOKS_DIST = path.join(__dirname, '..', 'hooks', 'dist');
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');

// ─── #1656 ───────────────────────────────────────────────────────────────────

describe('#1656: community .sh hooks must be present in hooks/dist', () => {
  // Run the build script once before checking outputs.
  // hooks/dist/ is gitignored so it must be generated; this mirrors what
  // `npm run build:hooks` (prepublishOnly) does before publish.
  before(() => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  });

  test('wsf-session-state.sh exists in hooks/dist', () => {
    const p = path.join(HOOKS_DIST, 'wsf-session-state.sh');
    assert.ok(fs.existsSync(p), 'wsf-session-state.sh must be in hooks/dist/ so the installer can copy it');
  });

  test('wsf-validate-commit.sh exists in hooks/dist', () => {
    const p = path.join(HOOKS_DIST, 'wsf-validate-commit.sh');
    assert.ok(fs.existsSync(p), 'wsf-validate-commit.sh must be in hooks/dist/ so the installer can copy it');
  });

  test('wsf-phase-boundary.sh exists in hooks/dist', () => {
    const p = path.join(HOOKS_DIST, 'wsf-phase-boundary.sh');
    assert.ok(fs.existsSync(p), 'wsf-phase-boundary.sh must be in hooks/dist/ so the installer can copy it');
  });
});

// ─── #1657 ───────────────────────────────────────────────────────────────────

describe('#1657: SDK prompt must not appear in installer source', () => {
  let src;
  test('install.js does not contain promptSdk call', () => {
    src = fs.readFileSync(INSTALL_SRC, 'utf-8');
    assert.ok(
      !src.includes('promptSdk('),
      'promptSdk() must not be called — SDK prompt causes install failures when package does not exist on npm'
    );
  });

  test('install.js does not contain --sdk flag handling', () => {
    src = src || fs.readFileSync(INSTALL_SRC, 'utf-8');
    assert.ok(
      !src.includes("args.includes('--sdk')"),
      '--sdk flag must be removed to prevent users triggering a broken SDK install'
    );
  });
});
