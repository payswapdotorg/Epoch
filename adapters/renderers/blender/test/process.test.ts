/**
 * The EXTERNAL-PROCESS BOUNDARY battery (W060): the typed spawn discipline
 * proven against the committed Node CLI double — argv arrays ONLY (the
 * no-shell proof below is a REAL behavioral test, not a convention),
 * timeouts enforced with real kills, output caps enforced while streaming,
 * and typed completion reports.
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBlenderVersion } from '../src/jobs';
import { spawnBlenderProcess } from '../src/process';

const DOUBLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'doubles', 'blender-double.mjs');

/** One boundary request against the double with a given misbehavior mode. */
/** One boundary request against the double (optionally in a misbehavior mode). */
function doubleRequest(mode: string | null, argv: readonly string[], overrides: Partial<Parameters<typeof spawnBlenderProcess>[0]> = {}) {
  return spawnBlenderProcess({
    program: process.execPath,
    argvPrefix: [DOUBLE],
    argv,
    timeoutMs: 15_000,
    maxStdoutBytes: 256 * 1024,
    maxStderrBytes: 256 * 1024,
    ...(mode === null ? {} : { env: { BLENDER_DOUBLE_MODE: mode } }),
    ...overrides,
  });
}

describe('the typed spawn boundary (against the committed CLI double)', () => {
  it('runs a version probe and reports it typed', async () => {
    const run = await doubleRequest(null, ['--version']);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.exitCode).toBe(0);
    expect(run.value.stdout).toContain('Blender 4.2.11 LTS (epoch-double');
    expect(run.value.killedByBoundary).toBe(false);
    expect(run.value.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('parses real Blender version strings (the live format)', () => {
    expect(parseBlenderVersion('Blender 4.2.11 LTS\n  build date ...')).toBe('4.2.11');
    expect(parseBlenderVersion('Blender 3.6.2')).toBe('3.6.2');
    expect(parseBlenderVersion('some other program')).toBeNull();
  });

  it('NEVER interprets shell syntax — argv elements stay literal (the no-shell proof)', async () => {
    // If any shell were involved, the `; rm -rf` fragment would be executed
    // as a second command. With argv arrays it is a literal argument that
    // /bin/echo prints back verbatim.
    const run = await spawnBlenderProcess({
      program: '/bin/echo',
      argv: ['safe; rm -rf /tmp/never-created-by-epoch'],
      argvPrefix: [],
      timeoutMs: 5_000,
      maxStdoutBytes: 64 * 1024,
      maxStderrBytes: 64 * 1024,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.exitCode).toBe(0);
    expect(run.value.stdout).toBe('safe; rm -rf /tmp/never-created-by-epoch\n');
  });

  it('enforces the timeout ceiling with a real kill (typed process-timeout)', async () => {
    const run = await doubleRequest('timeout', ['--version'], {
      timeoutMs: 500,
    });
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe('process-timeout');
    expect(run.error.message).toContain('500ms');
    expect(run.error.killed?.killReason).toBe('timeout');
    expect(run.error.killed?.durationMs).toBeLessThan(5_000);
  }, 10_000);

  it('enforces the stdout cap while streaming (typed output-limit-exceeded)', async () => {
    const run = await doubleRequest('flood-stdout', ['--version'], {
      maxStdoutBytes: 64 * 1024,
      timeoutMs: 10_000,
    });
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe('output-limit-exceeded');
    expect(run.error.killed?.killReason).toBe('stdout-limit');
    // The child floods 4 MiB; the boundary must stop it near the cap.
    expect(run.error.killed!.bytesSeen.stdout).toBeLessThan(256 * 1024);
  }, 10_000);

  it('completes non-zero exits as typed reports (the job layer decides)', async () => {
    const run = await doubleRequest('fail-exit', ['--version']);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.exitCode).toBe(3);
    expect(run.value.stderr).toContain('simulated fatal error');
  });

  it('reports spawn failures of nonexistent programs typed (never a throw)', async () => {
    const run = await spawnBlenderProcess({
      program: '/nonexistent/epoch-definitely-missing-blender',
      argv: ['--version'],
      argvPrefix: [],
      timeoutMs: 2_000,
      maxStdoutBytes: 64 * 1024,
      maxStderrBytes: 64 * 1024,
    });
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe('process-failed');
  });
});
