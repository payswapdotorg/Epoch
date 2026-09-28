// W034 — the MATERIALIZATION layer: deterministic synthetic workloads ->
// REAL kernel inputs. The workload generator is kernel-agnostic (pure
// data); this module maps its synthetic payloads onto the W036/W039
// content shapes through the kernels' own public admission paths — the
// W032 driver-seam pattern (never kernel edits, never generator-side
// kernel knowledge).
//
// DETERMINISM: every mapped value derives from the workload payload
// (index arithmetic, the fixed instant series) — zero clock, zero
// randomness, zero network.
import {
  instantAt,
  type OperationCounts,
  type SealedWorkloadRecord,
} from '@epoch/performance';
import type { SealedSolutionVersion } from '@epoch/solution-delivery';

// --------------------------------------------------------------------------------
// The shared identity spine (deterministic constants, the W032 pattern).
// --------------------------------------------------------------------------------

export const TENANT = 'tenant:globex' as const;
export const OTHER_TENANT = 'tenant:initech' as const;
export const PRINCIPAL = 'principal:delivery-lead' as const;
export const OBSERVER = 'principal:field-engineer' as const;
export const APPROVER = 'principal:chief-engineer' as const;

export const SOLUTION_ID = 'solution:perf-scale' as const;
export const PROGRAM_ID = 'program:perf-scale-v1' as const;
export const DELIVERY_ID = 'delivery:perf-scale-v1' as const;

/** The scenario's world entities (3 fixed entities the plan lines cycle over). */
export const WORLD_ENTITIES = [
  { id: 'element-perf-0', type: 'construction:element' },
  { id: 'element-perf-1', type: 'construction:element' },
  { id: 'service-perf-2', type: 'software:service' },
] as const;

/** The deterministic acceptance/actualization instant: always AFTER every observation instant of the workload. */
export function applicationInstantOf(workload: SealedWorkloadRecord): string {
  return instantAt(workload.observations.length + 8);
}

/** The exact-decimal multiply of an integer quantity and a 2-decimal amount. */
function multiplyDecimal(intQuantity: string, decimalAmount: string): string {
  const quantity = Number(intQuantity);
  const [whole, fraction = ''] = decimalAmount.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2) || '0');
  const totalCents = quantity * cents;
  return `${Math.floor(totalCents / 100)}.${String(Math.abs(totalCents % 100)).padStart(2, '0')}`;
}

// --------------------------------------------------------------------------------
// The solution version (N plan lines -> solutionLines).
// --------------------------------------------------------------------------------

/** Materialize the W036 solution-version content from a workload. */
export function solutionContentOf(workload: SealedWorkloadRecord): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOLUTION_ID,
    version: '1.0.0',
    tenantId: workload.tenantId,
    title: 'Performance scale solution',
    description: 'Synthetic solution materialized from a deterministic workload (W034)',
    objective: 'Exercise the delivery stack at declared scale',
    solutionLines: workload.planLines.map((line) => ({
      lineId: line.lineId,
      title: line.title,
      description: `Synthetic line ${line.lineId}`,
      quantity: { value: line.quantity.value, unit: line.quantity.unit },
      unitCost: { amount: line.unitCost.amount, currency: line.unitCost.currency },
      worldEntityId: line.worldEntityId,
      acquisitionVariant: line.acquisitionVariant,
    })),
    worldReferences: WORLD_ENTITIES.map((entity) => ({ entityId: entity.id })),
    constraintReferences: [],
    previousVersionDigest: null,
    createdAt: instantAt(0),
    createdBy: PRINCIPAL,
  };
}

// --------------------------------------------------------------------------------
// The program of work (N plan lines -> work packages of 8 activities,
// one activity per line, one milestone per 16 lines, one resource per
// activity; realization variants cycle so BOTH packs project over it).
// --------------------------------------------------------------------------------

const ACTIVITIES_PER_PACKAGE = 8;
const LINES_PER_MILESTONE = 16;

/** The activity id of one plan line (deterministic). */
export function activityIdOf(lineIndex: number): string {
  return `activity:perf-${String(lineIndex).padStart(6, '0')}`;
}

/** The work-package id of one plan line (8 lines per package). */
export function workPackageIdOf(lineIndex: number): string {
  return `work-package:perf-${String(Math.floor(lineIndex / ACTIVITIES_PER_PACKAGE)).padStart(4, '0')}`;
}

/** The milestone id of one plan line (one milestone per 16 lines, when aligned). */
export function milestoneIdOf(lineIndex: number): string | null {
  if (lineIndex % LINES_PER_MILESTONE !== 0) {
    return null;
  }
  return `milestone:perf-${String(lineIndex / LINES_PER_MILESTONE).padStart(4, '0')}`;
}

/** Materialize the W036 program-of-work content from a workload + sealed solution. */
export function programContentOf(workload: SealedWorkloadRecord, sealed: SealedSolutionVersion): Record<string, unknown> {
  const realizationVariants = ['construction-build', 'software-implementation-deployment'] as const;
  const workPackages = new Map<string, Record<string, unknown>>();
  const milestones: Record<string, unknown>[] = [];
  const milestoneActivityIds = new Map<string, string[]>();

  for (const [index, line] of workload.planLines.entries()) {
    const workPackageId = workPackageIdOf(index);
    const activityId = activityIdOf(index);
    if (!workPackages.has(workPackageId)) {
      workPackages.set(workPackageId, {
        workPackageId,
        title: `Performance work package ${workPackageId}`,
        description: `Synthetic work package ${workPackageId}`,
        solutionLineId: workload.planLines[Math.floor(index / ACTIVITIES_PER_PACKAGE) * ACTIVITIES_PER_PACKAGE]!.lineId,
        worldEntityId: line.worldEntityId,
        realizationVariant: realizationVariants[Math.floor(index / ACTIVITIES_PER_PACKAGE) % 2]!,
        plannedStart: instantAt(1),
        plannedFinish: instantAt(2),
        responsibleActor: PRINCIPAL,
        resources: [],
        constraintReferences: [],
        approvals: [{ approvedBy: APPROVER, approvedAt: instantAt(0) }],
        verificationGates: [],
        activities: [],
      });
    }
    const workPackage = workPackages.get(workPackageId) as { activities: unknown[] };
    workPackage.activities.push({
      activityId,
      workPackageId,
      title: `Synthetic activity ${activityId}`,
      realizationVariant: realizationVariants[Math.floor(index / ACTIVITIES_PER_PACKAGE) % 2]!,
      plannedQuantity: { value: line.quantity.value, unit: line.quantity.unit },
      plannedCost: { amount: multiplyDecimal(line.quantity.value, line.unitCost.amount), currency: line.unitCost.currency },
      plannedStart: instantAt(1),
      plannedFinish: instantAt(2),
      predecessors: [],
      successors: [],
      resources: [{ resourceId: `resource:perf-${index % 4}`, quantity: '1', unit: 'machine' }],
      responsibleActor: PRINCIPAL,
      constraintReferences: [],
      actualProgress: 0.5,
      actualStart: instantAt(1),
      blockers: [],
      evidence: [],
    });
    const milestoneId = milestoneIdOf(index);
    if (milestoneId !== null) {
      milestoneActivityIds.set(milestoneId, []);
      milestones.push({
        milestoneId,
        title: `Performance milestone ${milestoneId}`,
        targetDate: instantAt(2),
        activityIds: [] as string[],
        status: 'planned',
        evidence: [],
      });
    }
  }

  // Wire the intra-package dependency chain (predecessors AND their
  // mirrored successors — the W036 schedule-integrity discipline).
  interface WiredActivity {
    activityId: string;
    predecessors: string[];
    successors: string[];
    [key: string]: unknown;
  }
  for (const workPackage of workPackages.values()) {
    const activities = workPackage.activities as WiredActivity[];
    for (let position = 1; position < activities.length; position += 1) {
      const predecessor = activities[position - 1]!;
      const successor = activities[position]!;
      predecessor.successors.push(successor.activityId);
      successor.predecessors.push(predecessor.activityId);
    }
  }

  // Wire milestone activityIds (sorted ascending — the serialization discipline).
  for (const [index] of workload.planLines.entries()) {
    const milestoneId = milestoneIdOf(index);
    if (milestoneId === null) {
      continue;
    }
    milestoneActivityIds.get(milestoneId)!.push(activityIdOf(index));
  }
  for (const milestone of milestones) {
    const ids = milestoneActivityIds.get(String(milestone.milestoneId))!;
    (milestone as { activityIds: string[] }).activityIds = [...ids].sort();
  }

  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: PROGRAM_ID,
    tenantId: workload.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    title: 'Performance scale programme',
    workPackages: [...workPackages.values()].sort((a, b) =>
      String(a.workPackageId) < String(b.workPackageId) ? -1 : 1,
    ),
    milestones: milestones.sort((a, b) => (String(a.milestoneId) < String(b.milestoneId) ? -1 : 1)),
    createdAt: instantAt(1),
    createdBy: PRINCIPAL,
  };
}

// --------------------------------------------------------------------------------
// The delivery record + observations (M observations -> W036 observation
// distinction records over plan-line activities).
// --------------------------------------------------------------------------------

/** Materialize the W036 delivery-record content for a workload. */
export function deliveryContentOf(workload: SealedWorkloadRecord, sealed: SealedSolutionVersion): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.delivery-record',
    schemaVersion: 1,
    deliveryId: DELIVERY_ID,
    tenantId: workload.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    openedAt: instantAt(0),
    openedBy: PRINCIPAL,
    status: 'open',
    observations: [],
    acceptedObservationIds: [],
    rejectedObservationIds: [],
    actuals: [],
  };
}

/** Materialize the W036 observation distinction-record content for one workload observation. */
export function observationContentOf(workload: SealedWorkloadRecord, observationIndex: number): Record<string, unknown> {
  const observation = workload.observations[observationIndex]!;
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: observation.observationId,
    tenantId: workload.tenantId,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: activityIdOf(observation.subjectActivityIndex),
    },
    measure: { kind: 'quantity', value: observation.measure.value, unit: observation.measure.unit },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: observation.observedAt,
      observedBy: OBSERVER,
      evidence: [],
    },
    recordedAt: observation.observedAt,
    recordedBy: OBSERVER,
    uncertainty: {
      schemaVersion: 1,
      provenance: { kind: 'observed', sourceRef: 'source:perf-scale', actor: OBSERVER },
      freshness: { state: 'fresh', assessedAt: observation.observedAt },
      confidence: { method: 'measured', value: 0.95, rationale: 'deterministic synthetic capture' },
    },
  };
}

// --------------------------------------------------------------------------------
// The variance computation inputs (M observations -> M variance records).
// --------------------------------------------------------------------------------

/** Materialize one W039 variance computation input from a workload observation. */
export function varianceInputOf(workload: SealedWorkloadRecord, observationIndex: number): Record<string, unknown> {
  const observation = workload.observations[observationIndex]!;
  const subjectId = activityIdOf(observation.subjectActivityIndex);
  const actualValue = observation.measure.value;
  const baselineValue = String(Number(actualValue) + 3);
  return {
    varianceId: `variance:perf-${String(observationIndex).padStart(6, '0')}`,
    tenantId: workload.tenantId,
    solutionId: SOLUTION_ID,
    subjectKind: 'activity',
    subjectId,
    varianceClass: 'quantity',
    baselineRef: { kind: 'baseline', recordId: 'baseline:perf-scale', contentDigest: 'a'.repeat(64) },
    actualRef: { kind: 'actual', recordId: `actual:perf-${String(observationIndex).padStart(6, '0')}`, contentDigest: 'b'.repeat(64) },
    baselineMeasure: { kind: 'quantity', value: baselineValue, unit: observation.measure.unit },
    actualMeasure: { kind: 'quantity', value: actualValue, unit: observation.measure.unit },
    evidence: [],
    confidence: { method: 'measured', value: 0.95, rationale: 'deterministic synthetic variance' },
    thresholds: { minor: '10', material: '100', severe: '1000' },
    computedAt: instantAt(observationIndex),
    computedBy: PRINCIPAL,
  };
}

// --------------------------------------------------------------------------------
// The harness scenario (S steps -> a W032 ScenarioDefinition value).
// --------------------------------------------------------------------------------

/** The W032 harness scenario definition materialized from a workload (S steps). */
export function scenarioDefinitionOf(workload: SealedWorkloadRecord): Record<string, unknown> {
  return {
    schemaVersion: 1,
    scenarioId: `scenario:${workload.workloadId.replace(/^workload:/, '')}`,
    name: 'Performance harness scenario',
    description: `Synthetic harness scenario at ${workload.sizes.scenarioSteps} steps (deterministic workload projection)`,
    tenantId: workload.tenantId,
    actors: [
      { actorId: 'actor:home-tenant', kind: 'tenant', tenantId: workload.tenantId },
      { actorId: 'actor:delivery-lead', kind: 'principal', tenantId: workload.tenantId, role: 'delivery-lead' },
    ],
    fixtures: [
      { fixtureId: 'fixture:workload', kind: 'workload', label: 'the workload projection', content: { workloadId: workload.workloadId, sizes: workload.sizes } },
    ],
    steps: workload.scenarioSteps.map((step) => ({
      stepId: step.stepId,
      kind: 'call' as const,
      driverOp: step.op,
      actorId: 'actor:delivery-lead',
      route: 'public-api' as const,
      input: { recordIndex: step.input.recordIndex, value: step.input.value },
      expect: 'ok' as const,
    })),
    identityMap: [
      { canonicalId: 'perf-ledger', surfaces: ['harness-steps', 'perf-ledger-records'], note: 'the synthetic ledger chain' },
    ],
    invariants: [{ invariant: 'replay-determinism' }],
  };
}

// --------------------------------------------------------------------------------
// Shared flow plumbing (the unwrap + counting conventions).
// --------------------------------------------------------------------------------

/** Unwrap a total kernel result or fail loudly (the W032 driver `need` pattern). */
export function need<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`performance flow: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** The zeroed count map (imported shape parity with @epoch/performance). */
export function zeroCounts(): OperationCounts {
  return {
    'kernel-admission': 0,
    'kernel-fold': 0,
    'projection-compute': 0,
    'digest-compute': 0,
    'harness-scenario': 0,
  };
}
