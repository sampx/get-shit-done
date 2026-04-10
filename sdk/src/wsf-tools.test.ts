import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WSFTools, WSFToolsError, resolveWsfToolsPath } from './wsf-tools.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const BUNDLED_WSF_TOOLS_PATH = fileURLToPath(
  new URL('../../wsf/bin/wsf-tools.cjs', import.meta.url),
);

describe('WSFTools', () => {
  let tmpDir: string;
  let fixtureDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `wsf-tools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ─── Helper: create a Node script that outputs something ────────────────

  async function createScript(name: string, code: string): Promise<string> {
    const scriptPath = join(fixtureDir, name);
    await writeFile(scriptPath, code, { mode: 0o755 });
    return scriptPath;
  }

  // ─── exec() tests ──────────────────────────────────────────────────────

  describe('exec()', () => {
    it('parses valid JSON output', async () => {
      // Create a script that ignores args and outputs JSON
      const scriptPath = await createScript(
        'echo-json.cjs',
        `process.stdout.write(JSON.stringify({ status: "ok", count: 42 }));`,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.exec('state', ['load']);

      expect(result).toEqual({ status: 'ok', count: 42 });
    });

    it('handles @file: prefix by reading referenced file', async () => {
      // Write a large JSON result to a file
      const resultFile = join(fixtureDir, 'big-result.json');
      const bigData = { items: Array.from({ length: 100 }, (_, i) => ({ id: i })) };
      await writeFile(resultFile, JSON.stringify(bigData));

      // Script outputs @file: prefix
      const scriptPath = await createScript(
        'file-ref.cjs',
        `process.stdout.write('@file:${resultFile.replace(/\\/g, '\\\\')}');`,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.exec('state', ['load']);

      expect(result).toEqual(bigData);
    });

    it('returns null for empty stdout', async () => {
      const scriptPath = await createScript(
        'empty-output.cjs',
        `// outputs nothing`,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.exec('state', ['load']);

      expect(result).toBeNull();
    });

    it('throws WSFToolsError on non-zero exit code', async () => {
      const scriptPath = await createScript(
        'fail.cjs',
        `process.stderr.write('something went wrong\\n'); process.exit(1);`,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });

      try {
        await tools.exec('state', ['load']);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(WSFToolsError);
        const wsfErr = err as WSFToolsError;
        expect(wsfErr.command).toBe('state');
        expect(wsfErr.args).toEqual(['load']);
        expect(wsfErr.stderr).toContain('something went wrong');
        expect(wsfErr.exitCode).toBeGreaterThan(0);
      }
    });

    it('throws WSFToolsError with context when wsf-tools.cjs not found', async () => {
      const tools = new WSFTools({
        projectDir: tmpDir,
        wsfToolsPath: '/nonexistent/path/wsf-tools.cjs',
      });

      await expect(tools.exec('state', ['load'])).rejects.toThrow(WSFToolsError);
    });

    it('throws parse error when stdout is non-JSON', async () => {
      const scriptPath = await createScript(
        'bad-json.cjs',
        `process.stdout.write('Not JSON at all');`,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });

      try {
        await tools.exec('state', ['load']);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(WSFToolsError);
        const wsfErr = err as WSFToolsError;
        expect(wsfErr.message).toContain('Failed to parse');
        expect(wsfErr.message).toContain('Not JSON at all');
      }
    });

    it('throws when @file: points to nonexistent file', async () => {
      const scriptPath = await createScript(
        'bad-file-ref.cjs',
        `process.stdout.write('@file:/tmp/does-not-exist-${Date.now()}.json');`,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });

      await expect(tools.exec('state', ['load'])).rejects.toThrow(WSFToolsError);
    });

    it('handles timeout by killing child process', async () => {
      const scriptPath = await createScript(
        'hang.cjs',
        `setTimeout(() => {}, 60000); // hang for 60s`,
      );

      const tools = new WSFTools({
        projectDir: tmpDir,
        wsfToolsPath: scriptPath,
        timeoutMs: 500,
      });

      try {
        await tools.exec('state', ['load']);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(WSFToolsError);
        const wsfErr = err as WSFToolsError;
        expect(wsfErr.message).toContain('timed out');
      }
    }, 10_000);
  });

  // ─── Typed method tests ────────────────────────────────────────────────

  describe('typed methods', () => {
    it('stateLoad() calls exec with correct args', async () => {
      const scriptPath = await createScript(
        'state-load.cjs',
        `
        const args = process.argv.slice(2);
        // Script receives: state load --raw
        if (args[0] === 'state' && args[1] === 'load' && args.includes('--raw')) {
          process.stdout.write('phase=3\\nstatus=executing');
        } else {
          process.stderr.write('unexpected args: ' + args.join(' '));
          process.exit(1);
        }
        `,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.stateLoad();

      expect(result).toBe('phase=3\nstatus=executing');
    });

    it('commit() passes message and optional files', async () => {
      const scriptPath = await createScript(
        'commit.cjs',
        `
        const args = process.argv.slice(2);
        // commit <msg> --files f1 f2 --raw — returns a git SHA
        process.stdout.write('f89ae07');
        `,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.commit('test message', ['file1.md', 'file2.md']);

      expect(result).toBe('f89ae07');
    });

    it('roadmapAnalyze() calls roadmap analyze', async () => {
      const scriptPath = await createScript(
        'roadmap.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'roadmap' && args[1] === 'analyze') {
          process.stdout.write(JSON.stringify({ phases: [] }));
        } else {
          process.exit(1);
        }
        `,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.roadmapAnalyze();

      expect(result).toEqual({ phases: [] });
    });

    it('verifySummary() passes path argument', async () => {
      const scriptPath = await createScript(
        'verify.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'verify-summary' && args[1] === '/path/to/SUMMARY.md') {
          process.stdout.write('passed');
        } else {
          process.exit(1);
        }
        `,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.verifySummary('/path/to/SUMMARY.md');

      expect(result).toBe('passed');
    });
  });

  // ─── Integration-style test ────────────────────────────────────────────

  describe('integration', () => {
    it('handles large JSON output (>100KB)', async () => {
      const largeArray = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        name: `item-${i}`,
        data: 'x'.repeat(20),
      }));
      const largeJson = JSON.stringify(largeArray);

      const scriptPath = await createScript(
        'large-output.cjs',
        `process.stdout.write(${JSON.stringify(largeJson)});`,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.exec('state', ['load']);

      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBe(5000);
    });
  });

  // ─── initNewProject() tests ────────────────────────────────────────────

  describe('initNewProject()', () => {
    it('calls init new-project and returns typed result', async () => {
      const mockResult = {
        researcher_model: 'claude-sonnet-4-6',
        synthesizer_model: 'claude-sonnet-4-6',
        roadmapper_model: 'claude-sonnet-4-6',
        commit_docs: true,
        project_exists: false,
        has_codebase_map: false,
        planning_exists: false,
        has_existing_code: false,
        has_package_file: false,
        is_brownfield: false,
        needs_codebase_map: false,
        has_git: true,
        brave_search_available: false,
        firecrawl_available: false,
        exa_search_available: false,
        project_path: '.planning/PROJECT.md',
        project_root: '/tmp/test',
      };

      const scriptPath = await createScript(
        'init-new-project.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'init' && args[1] === 'new-project') {
          process.stdout.write(JSON.stringify(${JSON.stringify(mockResult)}));
        } else {
          process.stderr.write('unexpected args: ' + args.join(' '));
          process.exit(1);
        }
        `,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.initNewProject();

      expect(result.researcher_model).toBe('claude-sonnet-4-6');
      expect(result.project_exists).toBe(false);
      expect(result.has_git).toBe(true);
      expect(result.is_brownfield).toBe(false);
      expect(result.project_path).toBe('.planning/PROJECT.md');
    });

    it('propagates errors from wsf-tools', async () => {
      const scriptPath = await createScript(
        'init-fail.cjs',
        `process.stderr.write('init failed\\n'); process.exit(1);`,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });

      await expect(tools.initNewProject()).rejects.toThrow(WSFToolsError);
    });
  });

  // ─── resolveWsfToolsPath() tests ────────────────────────────────────────

  describe('resolveWsfToolsPath()', () => {
    it('returns repo-local path when it exists', async () => {
      const localBinDir = join(tmpDir, '.claude', 'wsf', 'bin');
      await mkdir(localBinDir, { recursive: true });
      await writeFile(join(localBinDir, 'wsf-tools.cjs'), '// stub');

      const result = resolveWsfToolsPath(tmpDir);
      expect(result).toBe(join(localBinDir, 'wsf-tools.cjs'));
    });

    it('falls back to bundled repo path when repo-local does not exist', () => {
      const result = resolveWsfToolsPath(tmpDir);
      const expected = existsSync(BUNDLED_WSF_TOOLS_PATH)
        ? BUNDLED_WSF_TOOLS_PATH
        : join(homedir(), '.claude', 'wsf', 'bin', 'wsf-tools.cjs');

      expect(result).toBe(expected);
    });

    it('constructor uses repo-local path when available', async () => {
      const localBinDir = join(tmpDir, '.claude', 'wsf', 'bin');
      await mkdir(localBinDir, { recursive: true });
      const scriptPath = join(localBinDir, 'wsf-tools.cjs');
      await writeFile(
        scriptPath,
        `process.stdout.write(JSON.stringify({ source: "local" }));`,
        { mode: 0o755 },
      );

      // No explicit wsfToolsPath — should auto-resolve to local
      const tools = new WSFTools({ projectDir: tmpDir });
      const result = await tools.exec('test', []);
      expect(result).toEqual({ source: 'local' });
    });
  });

  // ─── configSet() tests ─────────────────────────────────────────────────

  describe('configSet()', () => {
    it('calls config-set with key and value args', async () => {
      const scriptPath = await createScript(
        'config-set.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'config-set' && args[1] === 'workflow.auto_advance' && args[2] === 'true' && args.includes('--raw')) {
          process.stdout.write('workflow.auto_advance=true');
        } else {
          process.stderr.write('unexpected args: ' + args.join(' '));
          process.exit(1);
        }
        `,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.configSet('workflow.auto_advance', 'true');

      expect(result).toBe('workflow.auto_advance=true');
    });

    it('passes string values without coercion', async () => {
      const scriptPath = await createScript(
        'config-set-str.cjs',
        `
        const args = process.argv.slice(2);
        // config-set mode yolo --raw
        process.stdout.write(args[1] + '=' + args[2]);
        `,
      );

      const tools = new WSFTools({ projectDir: tmpDir, wsfToolsPath: scriptPath });
      const result = await tools.configSet('mode', 'yolo');

      expect(result).toBe('mode=yolo');
    });
  });
});
