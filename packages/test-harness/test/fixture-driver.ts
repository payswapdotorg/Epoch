// W032 — the harness's SELF-TEST fixture driver.
//
// A minimal, deterministic, in-memory LEDGER driver used to prove the
// engine's own behavior (DSL parsing, trace sealing, every invariant's
// positive and negative paths, replay determinism, result records).
//
// IMPORTANT: this is NOT a mock of any Epoch kernel. It is a synthetic
// driver over a trivial ledger — the same typed shapes real drivers
// produce, with none of Epoch's kernels involved. The real-kernel
// composition happens in tests/integration (the cross-domain scenario
// packs), never here.
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type {
  CallStep,
  ScenarioDefinition,
  ScenarioDriver,
  StepReport,
  StepResult,
} from '../src';

/** One ledger record (content-addressed like every kernel record). */
interface LedgerRecord {
  readonly recordId: string;
  readonly payload: JsonValue;
  readonly contentDigest: string;
  readonly parentDigest: string | null;
}

/** The fixture world: an append-only ledger. */
export interface LedgerWorld {
  readonly homeTenantId: string;
  readonly records: readonly LedgerRecord[];
}

/** The ops the fixture driver accepts. */
export const LEDGER_DRIVER_OPS = [
  'ledger.append',
  'ledger.read',
  'ledger.append-foreign',
  'ledger.forge-state',
  'ledger.project-ids',
] as const;

function recordOf(recordId: string, payload: JsonValue, parent: string | null): LedgerRecord {
  const content = { recordId, payload };
  return { recordId, payload, contentDigest: canonicalDigest(content), parentDigest: parent };
}

/** The fixture ledger driver (deterministic; no clock, no randomness). */
export const ledgerDriver: ScenarioDriver<LedgerWorld> = {
  name: 'fixture-ledger',
  driverOps: LEDGER_DRIVER_OPS,

  begin(scenario: ScenarioDefinition): LedgerWorld {
    return { homeTenantId: scenario.tenantId, records: [] };
  },

  stateDigest(world: LedgerWorld): string {
    return canonicalDigest({
      homeTenantId: world.homeTenantId,
      records: world.records.map((record) => record.contentDigest),
    } as unknown as JsonValue);
  },

  runStep(world: LedgerWorld, step: CallStep): StepResult<LedgerWorld> {
    const input = (step.input ?? {}) as Record<string, unknown>;
    switch (step.driverOp) {
      case 'ledger.append': {
        const record = recordOf(
          String(input.recordId),
          (input.payload ?? null) as JsonValue,
          world.records.length === 0 ? null : world.records[world.records.length - 1]!.contentDigest,
        );
        const next: LedgerWorld = { ...world, records: [...world.records, record] };
        return { world: next, report: appendReport(step, next) };
      }
      case 'ledger.read': {
        const report: StepReport = {
          stepId: step.stepId,
          ok: true,
          valueDigest: canonicalDigest({ count: world.records.length }),
          errorCode: null,
          errorMessage: null,
          denial: null,
          authorityRejection: null,
          events: [],
          provenance: [],
          identities: [],
        };
        return { world, report };
      }
      case 'ledger.append-foreign': {
        // The tenant boundary: ALWAYS denied with the typed shape (R12).
        const foreign = String(input.foreignTenantId ?? 'tenant:foreign');
        const report: StepReport = {
          stepId: step.stepId,
          ok: false,
          valueDigest: null,
          errorCode: 'cross-tenant-denied',
          errorMessage: `foreign tenant ${foreign} may not append to the home ledger`,
          denial: {
            code: 'cross-tenant-denied',
            expectedTenantId: world.homeTenantId,
            encounteredTenantId: foreign,
          },
          authorityRejection: null,
          events: [],
          provenance: [],
          identities: [],
        };
        return { world, report };
      }
      case 'ledger.forge-state': {
        // The authority gate: direct writes are ALWAYS rejected.
        const message = 'the ledger state may only change through the append path';
        const report: StepReport = {
          stepId: step.stepId,
          ok: false,
          valueDigest: null,
          errorCode: 'authority-bypass-rejected',
          errorMessage: message,
          denial: null,
          authorityRejection: { code: 'authority-bypass-rejected', message },
          events: [],
          provenance: [],
          identities: [],
        };
        return { world, report };
      }
      case 'ledger.project-ids': {
        const surfaces = Array.isArray(input.surfaces)
          ? (input.surfaces as { surface: string; ids: string[] }[])
          : [];
        const report: StepReport = {
          stepId: step.stepId,
          ok: true,
          valueDigest: canonicalDigest({ projected: surfaces.length }),
          errorCode: null,
          errorMessage: null,
          denial: null,
          authorityRejection: null,
          events: [],
          provenance: [],
          identities: surfaces.map((entry) => ({ surface: entry.surface, ids: [...entry.ids].sort() })),
        };
        return { world, report };
      }
      default:
        throw new Error(`fixture driver: unknown op "${step.driverOp}"`);
    }
  },
};

function appendReport(step: CallStep, world: LedgerWorld): StepReport {
  const last = world.records[world.records.length - 1]!;
  return {
    stepId: step.stepId,
    ok: true,
    valueDigest: last.contentDigest,
    errorCode: null,
    errorMessage: null,
    denial: null,
    authorityRejection: null,
    events: [
      {
        streamId: 'ledger:stream-1',
        sequence: world.records.length,
        discriminator: 'ledger:record-appended',
        contentDigest: last.contentDigest,
      },
    ],
    provenance: [
      {
        content: { recordId: last.recordId, payload: last.payload },
        claimedDigest: last.contentDigest,
        parentDigest: last.parentDigest,
      },
    ],
    identities: [],
  };
}
