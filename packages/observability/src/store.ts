/**
 * The reference in-memory OBSERVABILITY STORE: append-only
 * admissions (policies, observations, quarantine facts), the
 * `security:*` event streams, the derived metrics/health/audit
 * projections, and tenant-scoped read paths.
 *
 * - ADMISSION IS TOTAL (errors are values). Precedence: version ->
 *   schema/digest (the sealers) -> tenant -> idempotency -> causal.
 * - IDEMPOTENT admission: re-admitting the SAME digest is a no-op
 *   success (replay-safe); re-admitting the same id with DIFFERENT
 *   content is the typed `policy-conflict` /
 *   `duplicate-observation` rejection.
 * - Tenant isolation (R12): an optional single-tenant scope guard;
 *   cross-tenant admissions are the typed `cross-tenant-denied`
 *   rejection.
 * - Event streams: one stream per observed subject
 *   (`stream:security-<suffix>`; the host may register host-level
 *   steps on `stream:security-host-<suffix>`); sequences are
 *   strictly contiguous from 1; same-stream causal parents must be
 *   strictly earlier; unknown cross-stream parents are rejected
 *   (the W010 discipline).
 * - DETERMINISM: every read path sorts (no insertion-order leaks);
 *   zero wall-clock, zero randomness.
 */
import type { ObservabilityError, ObservabilityResult } from './errors';
import { fail } from './issues';
import {
  auditTenantBoundary,
  type AuditFinding,
} from './audit';
import {
  foldObservations,
  type ObservabilityMetrics,
} from './metrics';
import {
  projectSecurityHealth,
  type SecurityHealth,
} from './health';
import {
  selectActivePolicy,
  sealSecurityPolicy,
  verifySealedSecurityPolicy,
  type SecurityThresholds,
  type SealedSecurityPolicy,
} from './policy';
import {
  sealObservation,
  verifySealedObservation,
  type SealedObservation,
} from './observation';
import {
  isSubjectQuarantined,
  sealQuarantineFact,
  verifySealedQuarantineFact,
  type SealedQuarantineFact,
} from './quarantine';

import {
  sealSecurityEvent,
  type SealedSecurityEvent,
} from './events';
import {
  securityStreamIdOf,
} from './version';

/** Options of {@link openObservabilityStore}. */
export interface ObservabilityStoreOptions {
  /**
   * Tenant this store is scoped to. When provided, ANY admission
   * naming a different tenant is the typed `cross-tenant-denied`
   * rejection (R12 — the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
}

/** One read-observation entry: the sealed event stream of one subject. */
export interface SubjectStream {
  readonly subjectId: string;
  readonly streamId: string;
  readonly events: readonly SealedSecurityEvent[];
}

/** A deterministic, serialization-friendly projection of a whole store. */
export interface ObservabilitySnapshot {
  readonly schemaVersion: 1;
  readonly policies: readonly SealedSecurityPolicy[];
  readonly observations: readonly SealedObservation[];
  readonly quarantine: readonly SealedQuarantineFact[];
  readonly streams: readonly SubjectStream[];
}

/** The derived read projection: metrics + health + audit + active policy. */
export interface ObservabilityStateProjection {
  readonly metrics: ObservabilityMetrics;
  readonly health: SecurityHealth | null;
  readonly activePolicy: SealedSecurityPolicy | null;
  readonly auditFindings: readonly AuditFinding[];
  readonly quarantinedSubjects: readonly string[];
}

/** Options of the tenant-scoped state projection. */
export interface StateProjectionOptions {
  /** The tenant whose facts are projected (required — reads are tenant-scoped, R12). */
  readonly tenantId: string;
  /**
   * Thresholds override when NO policy is admitted for the tenant
   * (the projection then uses these; the store never invents
   * defaults — caller-supplied policy-as-data or explicit
   * thresholds, never hidden constants).
   */
  readonly thresholds?: SecurityThresholds | undefined;
}

/** The reference in-memory observability store. */
export class ObservabilityStore {
  /** tenantId -> (policyId -> revisions). Maps iterate in insertion order; every read path sorts. */
  private readonly policies = new Map<string, Map<string, SealedSecurityPolicy[]>>();

  /** tenantId -> observations (append-only). */
  private readonly observations = new Map<string, SealedObservation[]>();

  /** observationId -> the admitted digest (idempotency bookkeeping). */
  private readonly observationDigests = new Map<string, string>();

  /** tenantId -> quarantine facts (append-only). */
  private readonly quarantine = new Map<string, SealedQuarantineFact[]>();

  /** streamId -> events (append-only). */
  private readonly streams = new Map<string, SealedSecurityEvent[]>();

  private readonly expectedTenantId: string | undefined;

  constructor(options: ObservabilityStoreOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
  }

  // --------------------------------------------------------------------------------
  // The tenant scope guard (R12).
  // --------------------------------------------------------------------------------

  private tenantFailure(tenantId: string): ObservabilityError | null {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        code: 'cross-tenant-denied',
        message: `cross-tenant admission denied: this store is scoped to tenant "${this.expectedTenantId}", encountered "${tenantId}"`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: tenantId,
        subject: tenantId,
      };
    }
    return null;
  }

  // --------------------------------------------------------------------------------
  // Policy admission (idempotent by digest; replay-conflict on same id + different content).
  // --------------------------------------------------------------------------------

  /**
   * Admit a sealed security policy (verified at admission). Same
   * (policyId, digest) re-admission is an idempotent no-op;
   * same id + different digest is the typed `policy-conflict`.
   */
  admitPolicy(sealed: unknown): ObservabilityResult<{ policy: SealedSecurityPolicy; admitted: boolean }> {
    const verified = verifySealedSecurityPolicy(sealed);
    if (!verified.ok) return verified;
    const policy = verified.value;
    const failure = this.tenantFailure(policy.tenantId);
    if (failure !== null) return fail(failure);
    const byTenant = this.policies.get(policy.tenantId) ?? new Map<string, SealedSecurityPolicy[]>();
    const revisions = byTenant.get(policy.policyId) ?? [];
    const existing = revisions.find((entry) => entry.contentDigest === policy.contentDigest);
    if (existing !== undefined) {
      return { ok: true, value: { policy: existing, admitted: false } };
    }
    const conflicting = revisions.find((entry) => entry.revision === policy.revision);
    if (conflicting !== undefined) {
      return fail({
        code: 'policy-conflict',
        message: `policy "${policy.policyId}" revision "${policy.revision}" is already admitted with different content (replay-conflict)`,
        policyId: policy.policyId,
        encounteredDigest: policy.contentDigest,
      });
    }
    byTenant.set(policy.policyId, [...revisions, policy].sort((a, b) =>
      a.contentDigest < b.contentDigest ? -1 : a.contentDigest > b.contentDigest ? 1 : 0,
    ));
    this.policies.set(policy.tenantId, byTenant);
    return { ok: true, value: { policy, admitted: true } };
  }

  /** Admit raw policy content (sealed here first). */
  admitPolicyContent(content: unknown): ObservabilityResult<{ policy: SealedSecurityPolicy; admitted: boolean }> {
    const sealed = sealSecurityPolicy(content);
    if (!sealed.ok) return sealed;
    return this.admitPolicy(sealed.value);
  }

  /** Find the ACTIVE policy of one tenant (latest activation; null when none). */
  findActivePolicy(tenantId: string): SealedSecurityPolicy | null {
    const byTenant = this.policies.get(tenantId);
    if (byTenant === undefined) return null;
    const all: SealedSecurityPolicy[] = [];
    for (const revisions of byTenant.values()) {
      all.push(...revisions);
    }
    return selectActivePolicy(all);
  }

  /** Every admitted policy of one tenant (deterministic order). */
  listPolicies(tenantId: string): readonly SealedSecurityPolicy[] {
    if (this.tenantFailure(tenantId) !== null) return [];
    const byTenant = this.policies.get(tenantId);
    if (byTenant === undefined) return [];
    const all: SealedSecurityPolicy[] = [];
    for (const revisions of byTenant.values()) {
      all.push(...revisions);
    }
    return [...all].sort((a, b) =>
      a.policyId < b.policyId
        ? -1
        : a.policyId > b.policyId
          ? 1
          : a.contentDigest < b.contentDigest
            ? -1
            : 1,
    );
  }

  // --------------------------------------------------------------------------------
  // Observation admission (idempotent by id + digest; duplicate-observation on same id + different content).
  // --------------------------------------------------------------------------------

  /**
   * Admit a sealed observation (verified at admission). Same
   * (observationId, digest) re-admission is an idempotent no-op;
   * same id + different digest is the typed `duplicate-observation`.
   */
  admitObservation(sealed: unknown): ObservabilityResult<{ observation: SealedObservation; admitted: boolean }> {
    const verified = verifySealedObservation(sealed);
    if (!verified.ok) return verified;
    const observation = verified.value;
    const failure = this.tenantFailure(observation.tenantId);
    if (failure !== null) return fail(failure);
    const knownDigest = this.observationDigests.get(observation.observationId);
    if (knownDigest === observation.contentDigest) {
      const admitted = this.observations
        .get(observation.tenantId)!
        .find((entry) => entry.observationId === observation.observationId)!;
      return { ok: true, value: { observation: admitted, admitted: false } };
    }
    if (knownDigest !== undefined) {
      return fail({
        code: 'duplicate-observation',
        message: `observation "${observation.observationId}" is already admitted with different content (idempotency conflict)`,
        observationId: observation.observationId,
        encounteredDigest: observation.contentDigest,
      });
    }
    const tenantObservations = this.observations.get(observation.tenantId) ?? [];
    this.observations.set(observation.tenantId, [...tenantObservations, observation]);
    this.observationDigests.set(observation.observationId, observation.contentDigest);
    return { ok: true, value: { observation, admitted: true } };
  }

  /** Admit raw observation content (sealed here first). */
  admitObservationContent(content: unknown): ObservabilityResult<{ observation: SealedObservation; admitted: boolean }> {
    const sealed = sealObservation(content);
    if (!sealed.ok) return sealed;
    return this.admitObservation(sealed.value);
  }

  /** Every admitted observation of one tenant (deterministic order). */
  listObservations(tenantId: string): readonly SealedObservation[] {
    if (this.tenantFailure(tenantId) !== null) return [];
    return this.sortObservations(this.observations.get(tenantId) ?? []);
  }

  /** The observation stream of one subject (deterministic order). */
  listObservationsOfSubject(tenantId: string, subjectId: string): readonly SealedObservation[] {
    if (this.tenantFailure(tenantId) !== null) return [];
    return this.sortObservations(
      (this.observations.get(tenantId) ?? []).filter((entry) => entry.subjectId === subjectId),
    );
  }

  private sortObservations(observations: readonly SealedObservation[]): readonly SealedObservation[] {
    return [...observations].sort((a, b) =>
      a.observedAt < b.observedAt
        ? -1
        : a.observedAt > b.observedAt
          ? 1
          : a.observationId < b.observationId
            ? -1
            : 1,
    );
  }

  // --------------------------------------------------------------------------------
  // Quarantine facts (append-only; deny-by-default fold).
  // --------------------------------------------------------------------------------

  /**
   * Admit one quarantine fact input: raw content is SEALED here; a
   * sealed record (a `contentDigest` field present) is VERIFIED first
   * (a claimed digest that does not match the content never enters —
   * tamper detection).
   */
  private admitQuarantineInput(input: unknown): ObservabilityResult<SealedQuarantineFact> {
    if (
      typeof input === 'object' &&
      input !== null &&
      'contentDigest' in input &&
      typeof (input as { contentDigest?: unknown }).contentDigest === 'string'
    ) {
      return verifySealedQuarantineFact(input);
    }
    return sealQuarantineFact(input);
  }

  /**
   * Impose quarantine on a subject. Fails with `quarantine-conflict`
   * when the subject is ALREADY quarantined (no silent double
   * imposition) or when the input carries a release fact; sealed
   * inputs are verified at admission (tamper detection).
   */
  imposeQuarantine(content: unknown): ObservabilityResult<SealedQuarantineFact> {
    const sealed = this.admitQuarantineInput(content);
    if (!sealed.ok) return sealed;
    const fact = sealed.value;
    const failure = this.tenantFailure(fact.tenantId);
    if (failure !== null) return fail(failure);
    if (fact.factKind !== 'quarantine-imposed') {
      return fail({
        code: 'quarantine-conflict',
        message: 'imposeQuarantine admits impose facts only — release goes through releaseQuarantine',
        subjectId: fact.subjectId,
      });
    }
    const facts = this.quarantine.get(fact.tenantId) ?? [];
    if (isSubjectQuarantined(fact.subjectId, facts)) {
      return fail({
        code: 'quarantine-conflict',
        message: `subject "${fact.subjectId}" is already quarantined (deny-by-default; release before re-imposing)`,
        subjectId: fact.subjectId,
      });
    }
    this.quarantine.set(fact.tenantId, [...facts, fact]);
    return { ok: true, value: fact };
  }

  /**
   * Release a quarantined subject. Fails with
   * `quarantine-release-rejected` when the subject is NOT
   * quarantined (no silent no-op) or when the input carries an impose
   * fact; sealed inputs are verified at admission (tamper detection).
   */
  releaseQuarantine(content: unknown): ObservabilityResult<SealedQuarantineFact> {
    const sealed = this.admitQuarantineInput(content);
    if (!sealed.ok) return sealed;
    const fact = sealed.value;
    const failure = this.tenantFailure(fact.tenantId);
    if (failure !== null) return fail(failure);
    if (fact.factKind !== 'quarantine-released') {
      return fail({
        code: 'quarantine-release-rejected',
        message: 'releaseQuarantine admits release facts only — imposition goes through imposeQuarantine',
        subjectId: fact.subjectId,
      });
    }
    const facts = this.quarantine.get(fact.tenantId) ?? [];
    if (!isSubjectQuarantined(fact.subjectId, facts)) {
      return fail({
        code: 'quarantine-release-rejected',
        message: `subject "${fact.subjectId}" is not quarantined (nothing to release; no silent no-op)`,
        subjectId: fact.subjectId,
      });
    }
    this.quarantine.set(fact.tenantId, [...facts, fact]);
    return { ok: true, value: fact };
  }

  /** Whether one subject is quarantined (the derived fold). */
  isQuarantined(tenantId: string, subjectId: string): boolean {
    if (this.tenantFailure(tenantId) !== null) return false;
    return isSubjectQuarantined(subjectId, this.quarantine.get(tenantId) ?? []);
  }

  /** The quarantined subjects among the tenant's OBSERVED subjects (deterministic). */
  listQuarantinedSubjects(tenantId: string): readonly string[] {
    if (this.tenantFailure(tenantId) !== null) return [];
    const facts = this.quarantine.get(tenantId) ?? [];
    const subjects = new Set<string>(facts.map((fact) => fact.subjectId));
    return [...subjects].filter((subjectId) => isSubjectQuarantined(subjectId, facts)).sort();
  }

  /** Every quarantine fact of one tenant (deterministic order). */
  listQuarantine(tenantId: string): readonly SealedQuarantineFact[] {
    if (this.tenantFailure(tenantId) !== null) return [];
    return [...(this.quarantine.get(tenantId) ?? [])].sort((a, b) =>
      a.actedAt < b.actedAt
        ? -1
        : a.actedAt > b.actedAt
          ? 1
          : a.quarantineId < b.quarantineId
            ? -1
            : 1,
    );
  }

  // --------------------------------------------------------------------------------
  // Event emission (sealed by the kernel; contiguous sequences; causal discipline).
  // --------------------------------------------------------------------------------

  /**
   * Append one event to a subject's (or the host) stream. Sequences
   * are strictly contiguous; a same-stream causal parent must be
   * strictly earlier; an unknown cross-stream parent is rejected.
   * Returns the sealed record.
   */
  appendEvent(event: unknown): ObservabilityResult<SealedSecurityEvent> {
    const sealed = sealSecurityEvent(event);
    if (!sealed.ok) return sealed;
    const content = sealed.value;
    const failure = this.tenantFailure(content.tenantId);
    if (failure !== null) return fail(failure);
    const events = this.streams.get(content.streamId) ?? [];
    if (events.length + 1 !== content.sequence) {
      return fail({
        code: 'sequence-gap',
        message: `stream "${content.streamId}" is at sequence ${events.length}; the event claims ${content.sequence} (strictly contiguous from 1)`,
        streamId: content.streamId,
        expectedSequence: events.length + 1,
        encounteredSequence: content.sequence,
      });
    }
    if (content.causalParent !== null) {
      if (content.causalParent.streamId === content.streamId) {
        const parent = events[content.causalParent.sequence - 1];
        if (parent === undefined) {
          return fail({
            code: 'unknown-causal-parent',
            message: `the same-stream causal parent (${content.streamId}#${content.causalParent.sequence}) is outside known history`,
            streamId: content.streamId,
            parentStreamId: content.causalParent.streamId,
            parentSequence: content.causalParent.sequence,
          });
        }
      } else {
        const parentStream = this.streams.get(content.causalParent.streamId);
        if (parentStream === undefined || parentStream.length < content.causalParent.sequence) {
          return fail({
            code: 'unknown-causal-parent',
            message: `the cross-stream causal parent (${content.causalParent.streamId}#${content.causalParent.sequence}) is outside known history`,
            streamId: content.streamId,
            parentStreamId: content.causalParent.streamId,
            parentSequence: content.causalParent.sequence,
          });
        }
      }
    }
    this.streams.set(content.streamId, [...events, sealed.value]);
    return sealed;
  }

  /** The events of one stream (deterministic order). */
  readStream(streamId: string): readonly SealedSecurityEvent[] {
    return [...(this.streams.get(streamId) ?? [])];
  }

  /** The subject stream id derivation (re-exported convenience). */
  static streamIdOf(subjectId: string): string {
    return securityStreamIdOf(subjectId);
  }

  // --------------------------------------------------------------------------------
  // Projections (metrics + health + audit + quarantine; deterministic).
  // --------------------------------------------------------------------------------

  /** Project the tenant's observability state (metrics, health, audit findings, quarantine). */
  projectState(options: StateProjectionOptions): ObservabilityResult<ObservabilityStateProjection> {
    const failure = this.tenantFailure(options.tenantId);
    if (failure !== null) return fail(failure);
    const observations = this.observations.get(options.tenantId) ?? [];
    const metrics = foldObservations(observations);
    const activePolicy = this.findActivePolicy(options.tenantId);
    const thresholds: SecurityThresholds | undefined =
      activePolicy?.thresholds ?? options.thresholds;
    const health =
      thresholds === undefined
        ? null
        : projectSecurityHealth(
            metrics,
            thresholds,
            this.listQuarantinedSubjects(options.tenantId).length,
          );
    const auditFindings = auditTenantBoundary(observations);
    return {
      ok: true,
      value: {
        metrics,
        health,
        activePolicy,
        auditFindings,
        quarantinedSubjects: this.listQuarantinedSubjects(options.tenantId),
      },
    };
  }

  // --------------------------------------------------------------------------------
  // Snapshot (deterministic, serialization-friendly).
  // --------------------------------------------------------------------------------

  /** Snapshot the tenant's whole state (sorted; byte-identical for equal contents). */
  snapshot(tenantId: string): ObservabilityResult<ObservabilitySnapshot> {
    const failure = this.tenantFailure(tenantId);
    if (failure !== null) return fail(failure);
    const policies = this.listPolicies(tenantId);
    const observations = this.listObservations(tenantId);
    const quarantine = this.listQuarantine(tenantId);
    const subjects = new Set<string>(observations.map((entry) => entry.subjectId));
    for (const fact of quarantine) subjects.add(fact.subjectId);
    const streams: SubjectStream[] = [];
    for (const subjectId of [...subjects].sort()) {
      const streamId = securityStreamIdOf(subjectId);
      const events = this.streams.get(streamId);
      if (events !== undefined && events.length > 0) {
        streams.push({ subjectId, streamId, events: [...events] });
      }
    }
    return {
      ok: true,
      value: { schemaVersion: 1, policies, observations, quarantine, streams },
    };
  }
}
