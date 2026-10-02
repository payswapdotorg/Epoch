/**
 * The TYPED EXTERNAL-PROCESS BOUNDARY (W060) — the only place Epoch spawns
 * the Blender foundation, under the ACR-007/CF1.0 rules:
 *
 * - SEPARATE PROGRAM: Blender is invoked as its own process (argv array,
 *   `spawn` WITHOUT a shell — no `shell: true` anywhere, no string commands,
 *   no interpolation). Epoch code is never linked against, embedded in, or
 *   derived from Blender (the GPL separate-executable posture recorded in
 *   docs/rendering/blender.md);
 * - TIMEOUTS: every invocation carries a wall-clock ceiling; exceeding it
 *   kills the child (SIGTERM, then SIGKILL) and returns a typed
 *   `process-timeout` failure. Wall-clock use is confined to THIS I/O
 *   boundary (the adapter's semantic reports stay caller-virtual-time);
 * - OUTPUT SIZE LIMITS: stdout and stderr are byte-capped while streaming;
 *   a child that floods either is killed and reported as
 *   `output-limit-exceeded` (never an unbounded buffer);
 * - TYPED REPORTS: the exit status, captured output, and elapsed
 *   milliseconds come back as ONE typed value — never a thrown error at
 *   the seam.
 *
 * The runner is an INJECTED surface (the W058/W059 injected-engine
 * precedent): CI drives the REAL spawn runner below against a committed
 * Node CLI double of `blender` (test/doubles/blender-double.mjs) — real
 * subprocesses, real kills, real caps; a real Blender binary is exercised
 * only by the ENV-GATED live battery.
 */
import { spawn } from 'node:child_process';
import type { BlenderBoundaryResult, BlenderProcessKillEvidence } from './version';
import { blenderFailure } from './version';

/** One process invocation request (argv array ONLY — never a command string). */
export type BlenderProcessRequest = {
  /** The program to run (the Blender binary, or `node` + prefix for doubles). */
  readonly program: string;
  /** Arguments inserted before the Blender flags (test doubles only). */
  readonly argvPrefix?: readonly string[];
  /** The Blender CLI arguments (e.g. --version, or --background ... -- <job> <report>). */
  readonly argv: readonly string[];
  /** Wall-clock ceiling in milliseconds. */
  readonly timeoutMs: number;
  /** Maximum captured stdout bytes. */
  readonly maxStdoutBytes: number;
  /** Maximum captured stderr bytes. */
  readonly maxStderrBytes: number;
  /** Environment additions merged over the parent environment. */
  readonly env?: Readonly<Record<string, string>>;
};

/** One completed process invocation (typed evidence). */
export type BlenderProcessReport = {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  /** The captured stdout (bounded; the tail beyond the cap is discarded). */
  readonly stdout: string;
  /** The captured stderr (bounded). */
  readonly stderr: string;
  /** Wall-clock duration of the invocation in milliseconds (boundary evidence). */
  readonly durationMs: number;
  /** Whether the invocation ended by itself (vs. being killed by this boundary). */
  readonly killedByBoundary: false;
};

/**
 * The injected runner surface. The REAL implementation is
 * {@link spawnBlenderProcess}; tests may inject their own, though the
 * committed batteries run the REAL one against the CLI double.
 */
export interface BlenderProcessRunner {
  run(request: BlenderProcessRequest): Promise<BlenderBoundaryResult<BlenderProcessReport>>;
}

/**
 * Run ONE Blender invocation under the typed boundary: spawn (argv array,
 * no shell), stream-capped output collection, timeout enforcement, and a
 * typed completion report. Non-zero exits are NOT process-boundary
 * failures — they complete the report (the JOB layer decides whether the
 * exit is acceptable); only timeouts, output caps, and spawn errors are
 * typed boundary failures.
 */
export function spawnBlenderProcess(
  request: BlenderProcessRequest,
): Promise<BlenderBoundaryResult<BlenderProcessReport>> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const argv = [...(request.argvPrefix ?? []), ...request.argv];
    let child;
    try {
      child = spawn(request.program, argv, {
        shell: false, // NEVER a shell — the argv array is the whole command
        env: request.env === undefined ? process.env : { ...process.env, ...request.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve(
        blenderFailure('internal-error', `spawning "${request.program}" failed: ${(err as Error).message}`),
      );
      return;
    }

    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdout = '';
    let stderr = '';
    let killed: 'timeout' | 'stdout-limit' | 'stderr-limit' | null = null;
    let settled = false;

    const finish = (report: BlenderBoundaryResult<BlenderProcessReport>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(report);
    };

    const timer = setTimeout(() => {
      if (killed === null) killed = 'timeout';
      child.kill('SIGTERM');
      // Escalate if the child ignores SIGTERM.
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
    }, request.timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      if (killed !== null) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > request.maxStdoutBytes) {
        killed = 'stdout-limit';
        child.kill('SIGTERM');
        return;
      }
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (killed !== null) return;
      stderrBytes += chunk.length;
      if (stderrBytes > request.maxStderrBytes) {
        killed = 'stderr-limit';
        child.kill('SIGTERM');
        return;
      }
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      finish(blenderFailure('process-failed', `the process could not run: ${err.message}`));
    });
    child.on('close', (exitCode, signal) => {
      const durationMs = Date.now() - startedAt;
      if (killed !== null) {
        // A boundary-enforced kill is a TYPED failure carrying the evidence
        // of what had been captured when the ceiling tripped.
        settled = true;
        clearTimeout(timer);
        const evidence: BlenderProcessKillEvidence = {
          killReason: killed,
          durationMs,
          stdout,
          stderr,
          bytesSeen: { stdout: stdoutBytes, stderr: stderrBytes },
        };
        resolve({
          ok: false,
          error: {
            code: killed === 'timeout' ? 'process-timeout' : 'output-limit-exceeded',
            message:
              killed === 'timeout'
                ? `the invocation exceeded its ${request.timeoutMs}ms ceiling and was killed`
                : `the invocation exceeded its ${killed === 'stdout-limit' ? 'stdout' : 'stderr'} byte cap (${killed === 'stdout-limit' ? request.maxStdoutBytes : request.maxStderrBytes}) and was killed`,
            killed: evidence,
          },
        });
        return;
      }
      finish({
        ok: true,
        value: {
          exitCode,
          signal,
          stdout,
          stderr,
          durationMs,
          killedByBoundary: false,
        },
      });
    });
  });
}

/** The default runner: the REAL spawn boundary above. */
export const REAL_SPAWN_RUNNER: BlenderProcessRunner = { run: spawnBlenderProcess };
