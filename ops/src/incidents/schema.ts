/**
 * @epoch/ops-kit — INCIDENT TRACE validators (typed fixture data).
 *
 * An incident trace is a COMPLETE, chronological observation log of one
 * incident: the detection signals observed, the typed events (probe/gate/
 * capacity/digest/stall observations), the prior-good revisions the
 * mitigation may restore to, and the re-run probe results observed after
 * mitigation. Traces are fixture DATA — the simulator replays runbook
 * steps against them deterministically; nothing here invokes a probe,
 * command or provider.
 */
import { z } from 'zod';
import { ComponentIdSchema, DeployProvenanceSchema, EnvironmentIdSchema, EnvironmentStateSchema, RevisionSchema, Sha256DigestSchema, TenantIdSchema } from '@epoch/deploy-model';
import { OPS_RECORD_VERSION } from '../version';
import { DETECTION_SIGNAL_KINDS, INCIDENT_CLASSES } from '../version';

/** One observed detection signal (mirrors the runbook signal grammar). */
export const TraceSignalSchema = z
  .strictObject({
    kind: z.enum(DETECTION_SIGNAL_KINDS),
    componentId: ComponentIdSchema.nullable(),
    observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    detail: z.string().max(512).optional(),
  })
  .readonly();
export type TraceSignal = z.infer<typeof TraceSignalSchema>;

const observedAt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

/** The typed incident-event union (fixture observations). */
export const IncidentEventSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('probe-observed'),
        componentId: ComponentIdSchema,
        result: z.enum(['healthy', 'degraded', 'failed']),
        observedAt,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('gate-outcome-observed'),
        gateId: z.string().regex(/^gate:[a-z0-9][a-z0-9-]{0,62}$/),
        green: z.boolean(),
        observedAt,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('capacity-observed'),
        componentId: ComponentIdSchema,
        observedReplicas: z.number().int().min(1).max(4_096),
        observedAt,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('digest-observed'),
        componentId: ComponentIdSchema,
        verified: z.boolean(),
        observedAt,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('step-stalled-observed'),
        stepId: z.string().min(1).max(128),
        observedAt,
      })
      .readonly(),
  ])
  .readonly();
export type IncidentEvent = z.infer<typeof IncidentEventSchema>;

const incidentTraceShape = z.strictObject({
  recordVersion: z.literal(OPS_RECORD_VERSION),
  traceId: z.string().regex(/^trace:[a-z0-9][a-z0-9-]{0,62}$/),
  incidentClass: z.enum(INCIDENT_CLASSES),
  environmentId: EnvironmentIdSchema,
  tenantId: TenantIdSchema,
  /** The topology revision this trace's state derives from. */
  topologyDigest: Sha256DigestSchema,
  /** The tenant-scoped fixture state when the incident was detected. */
  initialState: EnvironmentStateSchema,
  /** The detection signals observed (the runbook's detection must match). */
  signals: z.array(TraceSignalSchema).min(1).readonly(),
  /** The chronological typed observation log. */
  events: z.array(IncidentEventSchema).readonly(),
  /** Prior-good revisions restore actions may pin (fixture data). */
  priorRevisions: z
    .array(
      z
        .strictObject({ componentId: ComponentIdSchema, revision: RevisionSchema })
        .readonly(),
    )
    .readonly(),
  /** Re-run probe results observed after mitigation (fixture data). */
  recoveryProbes: z
    .array(
      z
        .strictObject({
          componentId: ComponentIdSchema,
          result: z.enum(['healthy', 'degraded', 'failed']),
        })
        .readonly(),
    )
    .readonly(),
  provenance: DeployProvenanceSchema,
});

/** An incident trace (content half). */
export const IncidentTraceContentSchema = incidentTraceShape.readonly();
export type IncidentTraceContent = z.infer<typeof IncidentTraceContentSchema>;

/** A sealed incident trace (content-addressed). */
export const IncidentTraceSchema = incidentTraceShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type IncidentTrace = z.infer<typeof IncidentTraceSchema>;
