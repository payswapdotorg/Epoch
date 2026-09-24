/**
 * In-memory reference host state (W008 pin: "In-memory reference
 * behavior, serialization-friendly, NO persistence, NO UI, NO workflow
 * engine"). The EXTERNAL boundary inputs (clock, world projections,
 * capability invocations) are injectable; storage, evidence, logs, and
 * the audit trail are host-internal, per-extension/per-session, and
 * deterministic:
 *
 * - the default clock is a FIXED instant (determinism by default — real
 *   clocks are injected by the embedding host);
 * - evidence ids and audit sequences are stable sequences
 *   (`evidence:000001`, 1, 2, 3, ...), never randomness;
 * - the session log is bounded (the newest records are kept).
 */
import type {
  CapabilityInvoker,
  HostClock,
  HostExecutionOutcome,
  WorldViewProvider,
} from './types';

/** The fixed default clock instant (determinism by default). */
export const DEFAULT_CLOCK_INSTANT = '1970-01-01T00:00:00.000Z' as const;

/** A deterministic fixed clock. */
export function fixedClock(instant: string = DEFAULT_CLOCK_INSTANT): HostClock {
  return { now: () => instant };
}

/** The default (empty) world projection provider. */
export function emptyWorldView(): WorldViewProvider {
  return {
    readProjection: (refs) => refs.map(() => null),
  };
}

/** A map-backed world projection provider (deterministic, read-only). */
export function mapWorldView(
  projections: Readonly<Record<string, unknown>>,
): WorldViewProvider {
  return {
    readProjection: (refs) => refs.map((ref) => (projections[ref] ?? null) as never),
  };
}

/** The default capability invoker: none installed (typed failure). */
export function unavailableCapabilityInvoker(): CapabilityInvoker {
  return {
    invoke: () => ({
      status: 'failed',
      code: 'handler-unavailable',
      message:
        'no capability invoker is installed in this host — capability.invoke requires an injected CapabilityInvoker (fabric adapters arrive in later Work Orders)',
    }),
  };
}

/** A canned-response capability invoker (tests / deterministic hosts). */
export function cannedCapabilityInvoker(
  respond: (request: { readonly capabilityId: string; readonly inputs: Readonly<Record<string, unknown>> }) => HostExecutionOutcome,
): CapabilityInvoker {
  return { invoke: respond };
}

/** Per-extension in-memory storage namespace (reversible host state). */
export class ExtensionStorageNamespace {
  private readonly values = new Map<string, unknown>();

  read(key: string): unknown {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  write(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  get size(): number {
    return this.values.size;
  }

  /** Sorted entries (deterministic snapshot order). */
  entries(): readonly [string, unknown][] {
    return [...this.values.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }
}

/** Per-session in-memory log ring (bounded, newest kept). */
export class SessionLogRing {
  private static readonly CAPACITY = 256;

  private readonly records: { level: string; message: string; instant: string }[] = [];

  append(level: string, message: string, instant: string): void {
    this.records.push({ level, message, instant });
    if (this.records.length > SessionLogRing.CAPACITY) {
      this.records.splice(0, this.records.length - SessionLogRing.CAPACITY);
    }
  }

  snapshot(): readonly { level: string; message: string; instant: string }[] {
    return [...this.records];
  }
}

/** Host-internal in-memory evidence book (NOT the W006 chain — statements only). */
export class InMemoryEvidenceBook {
  private nextId = 1;

  private readonly statements: {
    evidenceId: string;
    statement: string;
    subjectDigest?: string;
    attributedExtensionId: string;
  }[] = [];

  append(statement: string, attributedExtensionId: string, subjectDigest?: string): string {
    const evidenceId = `evidence-${String(this.nextId).padStart(6, '0')}`;
    this.nextId += 1;
    this.statements.push({ evidenceId, statement, subjectDigest, attributedExtensionId });
    return evidenceId;
  }

  snapshot(): readonly {
    evidenceId: string;
    statement: string;
    subjectDigest?: string;
    attributedExtensionId: string;
  }[] {
    return [...this.statements];
  }
}
