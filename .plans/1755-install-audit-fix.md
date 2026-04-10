# Plan: Fix Install Process Issues (#1755 + Full Audit)

## Overview
Full cleanup of install.js addressing all issues found during comprehensive audit.
All changes in `bin/install.js` unless noted.

## Changes

### Fix 1: Add chmod +x for .sh hooks during install (CRITICAL)
**Line 5391-5392** — After `fs.copyFileSync`, add `fs.chmodSync(destFile, 0o755)` for `.sh` files.

### Fix 2: Fix Codex hook path and filename (CRITICAL)
**Line 5485** — Change `wsf-update-check.js` to `wsf-check-update.js` and fix path from `wsf/hooks/` to `hooks/`.
**Line 5492** — Update dedup check to use `wsf-check-update`.

### Fix 3: Fix stale cache invalidation path (CRITICAL)
**Line 5406** — Change from `path.join(path.dirname(targetDir), 'cache', ...)` to `path.join(os.homedir(), '.cache', 'wsf', 'wsf-update-check.json')`.

### Fix 4: Track .sh hooks in manifest (MEDIUM)
**Line 4972** — Change filter from `file.endsWith('.js')` to `(file.endsWith('.js') || file.endsWith('.sh'))`.

### Fix 5: Add wsf-workflow-guard.js to uninstall hook list (MEDIUM)
**Line 4404** — Add `'wsf-workflow-guard.js'` to the `wsfHooks` array.

### Fix 6: Add community hooks to uninstall settings.json cleanup (MEDIUM)
**Lines 4453-4520** — Add filters for `wsf-session-state`, `wsf-validate-commit`, `wsf-phase-boundary` in the appropriate event cleanup blocks (SessionStart, PreToolUse, PostToolUse).

### Fix 7: Remove phantom wsf-check-update.sh from uninstall list (LOW)
**Line 4404** — Remove `'wsf-check-update.sh'` from `wsfHooks` array.

### Fix 8: Remove dead isCursor/isWindsurf branches in uninstall (LOW)
Remove the unreachable duplicate `else if (isCursor)` and `else if (isWindsurf)` branches.

### Fix 9: Improve verifyInstalled() for hooks (LOW)
After the generic check, warn if expected `.sh` files are missing (non-fatal warning).

## New Test File
`tests/install-hooks-copy.test.cjs` — Regression tests covering:
- .sh files copied to target dir
- .sh files are executable after copy
- .sh files tracked in manifest
- settings.json hook paths match installed files
- uninstall removes community hooks from settings.json
- uninstall removes wsf-workflow-guard.js
- Codex hook uses correct filename
- Cache path resolves correctly
