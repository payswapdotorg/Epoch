/**
 * @epoch/ops-kit — RUNBOOK validators (typed, versioned DATA).
 *
 * One runbook per incident class: detection signals -> containment steps ->
 * mitigation steps -> recovery verification. Runbooks reference topology
 * components BY ID (validated at simulation time); steps carry neutral
 * operator verbs from the closed RUNBOOK_ACTIONS vocabulary — never
 * provider commands. Every runbook is content-addressed and
 * provenance-carrying.
 *
 * DETECTION SIGNALS (W030 graceful skip): the signal kinds are the
 * deploy-native vocabulary (probe/gate/capacity/digest/stall
 * observations). When packages/observability merges, its event classes
 * extend DETECTION_SIGNAL_KINDS as data — the runbook records themselves
 * change nothing.
 */
import { z } from 'zod';
import { ComponentIdSchema, DeployProvenanceSchema } from '@epoch/deploy-model';
import { OPS_RECORD_VERSION } from '../version';
import { DETECTION_SIGNAL_KINDS, INCIDENT_CLASSES, RECOVERY_CHECKS, RUNBOOK_ACTIONS } from '../version';

/** One detection signal a runbook keys on (kind + optional component). */
export const DetectionSignalSchema = z
  .strictObject({
    kind: z.enum(DETECTION_SIGNAL_KINDS),
    /** Null = environment-wide signal (e.g. gate-report-missing). */
    componentId: ComponentIdSchema.nullable(),
    description: z.string().min(1).max(512),
  })
  .readonly();
export type DetectionSignal = z.infer<typeof DetectionSignalSchema>;

/** One containment or mitigation step (deterministic id: `<n>:<action>:<component|env>`). */
export const RunbookStepSchema = z
  .strictObject({
    stepId: z
      .string()
      .regex(
        /^[1-9][0-9]*:[a-z-]+:(?:cmp:[a-z0-9][a-z0-9-]{0,62}|env)$/,
        'runbook step ids are "<ordinal>:<action>:<componentId|env>"',
      ),
    action: z.enum(RUNBOOK_ACTIONS),
    /** Null = environment-wide step (e.g. freeze-deploys). */
    componentId: ComponentIdSchema.nullable(),
    expectedEffect: z.string().min(1).max(512),
  })
  .readonly();
export type RunbookStep = z.infer<typeof RunbookStepSchema>;

/** One recovery-verification check (typed predicate over post-mitigation state). */
export const RecoveryCheckSchema = z
  .strictObject({
    kind: z.enum(RECOVERY_CHECKS),
    componentId: ComponentIdSchema.nullable(),
    description: z.string().min(1).max(512),
  })
  .readonly();
export type RecoveryCheck = z.infer<typeof RecoveryCheckSchema>;

const runbookShape = z.strictObject({
  recordVersion: z.literal(OPS_RECORD_VERSION),
  runbookId: z.string().regex(/^rb:[a-z0-9][a-z0-9-]{0,62}$/),
  incidentClass: z.enum(INCIDENT_CLASSES),
  title: z.string().min(1).max(128),
  /** How the incident class is detected (signals over the environment). */
  detection: z.array(DetectionSignalSchema).min(1).readonly(),
  /** Immediate risk reduction (reversible, before mitigation). */
  containment: z.array(RunbookStepSchema).readonly(),
  /** The corrective work that ends the incident. */
  mitigation: z.array(RunbookStepSchema).min(1).readonly(),
  /** The typed predicates that PROVE recovery. */
  recoveryVerification: z.array(RecoveryCheckSchema).min(1).readonly(),
  provenance: DeployProvenanceSchema,
});

/** A runbook (content half). */
export const RunbookContentSchema = runbookShape.readonly();
export type RunbookContent = z.infer<typeof RunbookContentSchema>;

/** A sealed runbook (content-addressed). */
export const RunbookRecordSchema = runbookShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type RunbookRecord = z.infer<typeof RunbookRecordSchema>;
