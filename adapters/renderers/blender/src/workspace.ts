/**
 * The SCOPED WORKSPACE (W060) — the only directory tree the sidecar
 * boundary reads from or writes to. Every file the boundary touches is
 * derived from a STRICT SLUG id (lowercase letters, digits, dashes), so a
 * hostile job/report name can never traverse outside the workspace:
 * `path.join` is only ever called with validated slugs, and the resolved
 * path is re-checked to be inside the workspace directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { BlenderBoundaryLimits, BlenderBoundaryResult } from './version';
import { blenderFailure } from './version';

/** The strict slug grammar of every workspace file id. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;

/** Validate one workspace file id (typed refusal on anything else). */
export function validWorkspaceSlug(id: string): boolean {
  return SLUG_PATTERN.test(id);
}

/** The scoped, traversal-proof workspace of one adapter instance. */
export class BlenderWorkspace {
  readonly root: string;
  private readonly limits: BlenderBoundaryLimits;

  constructor(root: string, limits: BlenderBoundaryLimits) {
    this.root = path.resolve(root);
    this.limits = limits;
  }

  /** Ensure the workspace exists and is a writable directory (typed check). */
  ensure(): BlenderBoundaryResult<true> {
    try {
      fs.mkdirSync(this.root, { recursive: true });
      const stat = fs.statSync(this.root);
      if (!stat.isDirectory()) {
        return blenderFailure('workspace-invalid', `the workspace path "${this.root}" is not a directory`);
      }
      return { ok: true, value: true };
    } catch (err) {
      return blenderFailure(
        'workspace-invalid',
        `the workspace directory "${this.root}" is not usable: ${(err as Error).message}`,
      );
    }
  }

  /** The in-workspace path of one slug-named file (traversal-checked). */
  pathOf(id: string, extension: string): BlenderBoundaryResult<string> {
    if (!validWorkspaceSlug(id)) {
      return blenderFailure(
        'workspace-invalid',
        `"${id.slice(0, 64)}" is not a valid workspace file id (lowercase slug required)`,
      );
    }
    if (!/^\.[a-z0-9]+(\.[a-z0-9]+)?$/.test(extension)) {
      return blenderFailure('workspace-invalid', `"${extension}" is not a valid workspace extension`);
    }
    const resolved = path.resolve(this.root, `${id}${extension}`);
    if (!resolved.startsWith(`${this.root}${path.sep}`)) {
      return blenderFailure('workspace-invalid', 'the resolved path escaped the workspace');
    }
    return { ok: true, value: resolved };
  }

  /** Write one JSON document into the workspace (bounded). */
  writeJson(id: string, extension: string, value: unknown): BlenderBoundaryResult<string> {
    const target = this.pathOf(id, extension);
    if (!target.ok) return target;
    const text = JSON.stringify(value);
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > this.limits.maxReportBytes) {
      return blenderFailure(
        'job-invalid',
        `the ${extension} document "${id}" is ${bytes} bytes (max ${this.limits.maxReportBytes})`,
        { jobId: id },
      );
    }
    try {
      fs.writeFileSync(target.value, text, 'utf8');
      return target;
    } catch (err) {
      return blenderFailure('workspace-invalid', `writing "${id}${extension}" failed: ${(err as Error).message}`);
    }
  }

  /** Read one JSON document from the workspace (bounded, strict parse). */
  readJson(id: string, extension: string): BlenderBoundaryResult<Record<string, unknown>> {
    const target = this.pathOf(id, extension);
    if (!target.ok) return target;
    let raw: Buffer;
    try {
      const stat = fs.statSync(target.value);
      if (!stat.isFile()) {
        return blenderFailure('report-missing', `"${id}${extension}" is not a file`, { jobId: id });
      }
      if (stat.size > this.limits.maxReportBytes) {
        return blenderFailure(
          'report-invalid',
          `the report "${id}" is ${stat.size} bytes (max ${this.limits.maxReportBytes})`,
          { jobId: id },
        );
      }
      raw = fs.readFileSync(target.value);
    } catch (err) {
      return blenderFailure('report-missing', `reading "${id}${extension}" failed: ${(err as Error).message}`, {
        jobId: id,
      });
    }
    try {
      const parsed: unknown = JSON.parse(raw.toString('utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return blenderFailure('report-invalid', `the report "${id}" is not a JSON object`, { jobId: id });
      }
      return { ok: true, value: parsed as Record<string, unknown> };
    } catch (err) {
      return blenderFailure('report-invalid', `the report "${id}" is not valid JSON: ${(err as Error).message}`, {
        jobId: id,
      });
    }
  }

  /** Write one binary artifact into the workspace (bounded). */
  writeArtifact(id: string, extension: string, bytes: Uint8Array): BlenderBoundaryResult<string> {
    const target = this.pathOf(id, extension);
    if (!target.ok) return target;
    if (bytes.length > this.limits.maxArtifactBytes) {
      return blenderFailure(
        'job-invalid',
        `the artifact "${id}" is ${bytes.length} bytes (max ${this.limits.maxArtifactBytes})`,
        { jobId: id },
      );
    }
    try {
      fs.writeFileSync(target.value, bytes);
      return target;
    } catch (err) {
      return blenderFailure('workspace-invalid', `writing "${id}${extension}" failed: ${(err as Error).message}`);
    }
  }

  /**
   * Read one binary artifact back and VERIFY it against the digest/size the
   * report claimed — sidecar output is UNTRUSTED until re-computed here
   * (the adapter never trusts a provider's self-reported digest).
   */
  readVerifiedArtifact(
    id: string,
    extension: string,
    expected: { digest: string; byteSize: number },
    sha256OfBytes: (bytes: Uint8Array) => string,
  ): BlenderBoundaryResult<Uint8Array> {
    const target = this.pathOf(id, extension);
    if (!target.ok) return target;
    let raw: Buffer;
    try {
      const stat = fs.statSync(target.value);
      if (!stat.isFile()) {
        return blenderFailure('artifact-mismatch', `the artifact "${id}" is missing`, { jobId: id });
      }
      if (stat.size > this.limits.maxArtifactBytes) {
        return blenderFailure(
          'artifact-mismatch',
          `the artifact "${id}" is ${stat.size} bytes (max ${this.limits.maxArtifactBytes})`,
          { jobId: id },
        );
      }
      raw = fs.readFileSync(target.value);
    } catch (err) {
      return blenderFailure('artifact-mismatch', `reading "${id}${extension}" failed: ${(err as Error).message}`, {
        jobId: id,
      });
    }
    if (raw.length !== expected.byteSize) {
      return blenderFailure(
        'artifact-mismatch',
        `the artifact "${id}" is ${raw.length} bytes but the report claimed ${expected.byteSize}`,
        { jobId: id },
      );
    }
    const digest = sha256OfBytes(raw);
    if (digest !== expected.digest) {
      return blenderFailure(
        'artifact-mismatch',
        `the artifact "${id}" digests to ${digest.slice(0, 16)}… but the report claimed ${expected.digest.slice(0, 16)}…`,
        { jobId: id },
      );
    }
    return { ok: true, value: raw };
  }

  /** Remove one workspace file (best effort; disposal hygiene). */
  remove(id: string, extension: string): void {
    const target = this.pathOf(id, extension);
    if (!target.ok) return;
    try {
      fs.rmSync(target.value, { force: true });
    } catch {
      // Disposal hygiene is best-effort by design.
    }
  }
}
