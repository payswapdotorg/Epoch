/**
 * @epoch/ops-kit — RELEASE + ROLLBACK procedures as typed, versioned
 * checklists with provenance.
 *
 * A release checklist is DERIVED from a sealed deploy plan (one item per
 * build/verify/promote/health-check phase + the gate battery), and a
 * rollback checklist is derived from a sealed rollback receipt (one item
 * per restored placement). Completion is typed: an item is complete only
 * with a caller-supplied instant + actor, and a checklist admits only
 * when every item is complete and the checklist digest verifies —
 * release/rollback discipline is DATA, provenance-carrying, deterministic.
 */
import { z } from 'zod';
import { canonicalDigest, canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  ComponentIdSchema,
  DeployProvenanceSchema,
  Sha256DigestSchema,
  scanProviderVocabulary,
  type DeployPlan,
  type DeployProvenance,
  type DeployRun,
  type GateCommand,
} from '@epoch/deploy-model';
import { OPS_RECORD_VERSION } from '../version';
import { opsFail, type OpsResult } from '../errors';

const checklistItemShape = z.strictObject({
  itemId: z.string().regex(/^item:[1-9][0-9]*:[a-z-]+$/),
  description: z.string().min(1).max(512),
  /** The component the item concerns (null = procedure-wide). */
  componentId: ComponentIdSchema.nullable(),
  /** The battery command an item asserts (gate items only, else null). */
  gateCommand: z.string().max(256).nullable(),
  /** Completion evidence (null until the item is done). */
  completedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).nullable(),
  completedBy: z.string().regex(/^actor:[a-z0-9][a-z0-9-]{0,62}$/).nullable(),
});

const checklistShape = z.strictObject({
  recordVersion: z.literal(OPS_RECORD_VERSION),
  checklistId: z.string().regex(/^(?:release|rollback):[a-z0-9][a-z0-9-]{0,62}$/),
  kind: z.enum(['release', 'rollback']),
  title: z.string().min(1).max(128),
  /** The exact plan (and, for rollbacks, run) this procedure executes. */
  planId: z.string().regex(/^plan:[0-9a-f]{16}$/),
  planDigest: Sha256DigestSchema,
  runDigest: Sha256DigestSchema.nullable(),
  environmentId: z.string().regex(/^env:[a-z0-9][a-z0-9-]{0,62}$/),
  items: z.array(checklistItemShape.readonly()).min(1).readonly(),
  provenance: DeployProvenanceSchema,
});

/** A checklist (content half). */
export const ChecklistContentSchema = checklistShape.readonly();
export type ChecklistContent = z.infer<typeof ChecklistContentSchema>;

/** A sealed checklist (content-addressed). */
export const OpsChecklistSchema = checklistShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type OpsChecklist = z.infer<typeof OpsChecklistSchema>;

/** The content half of a sealed checklist (digest excluded). */
export function checklistContent(checklist: OpsChecklist): Omit<OpsChecklist, 'digest'> {
  const { digest: _digest, ...rest } = checklist;
  void _digest;
  return rest;
}

/** Verify a sealed checklist's digest. */
export function verifyChecklistDigest(checklist: OpsChecklist): OpsResult<OpsChecklist> {
  const content = checklistContent(checklist);
  const revalidated = ChecklistContentSchema.safeParse(content);
  if (!revalidated.success) {
    return opsFail('validation', `checklist "${checklist.checklistId}" failed validation: ${revalidated.error.issues[0]?.message ?? 'unknown'}`);
  }
  const expected = canonicalDigest(content as unknown as JsonValue);
  return expected === checklist.digest
    ? { ok: true, value: checklist }
    : opsFail('digest-mismatch', `checklist "${checklist.checklistId}": digest does not match content (tampered checklist)`);
}

/**
 * Derive the RELEASE checklist of a plan (deterministic): one gate item per
 * battery command + one item per component phase of the plan's steps.
 */
export function releaseChecklistFor(
  plan: DeployPlan,
  battery: readonly GateCommand[],
  provenance: DeployProvenance,
): OpsResult<OpsChecklist> {
  const items: {
    itemId: string;
    description: string;
    componentId: string | null;
    gateCommand: string | null;
    completedAt: string | null;
    completedBy: string | null;
  }[] = [];
  let index = 0;
  const push = (description: string, componentId: string | null, gateCommand: string | null): void => {
    index += 1;
    const slug = gateCommand !== null ? 'gate' : componentId !== null ? componentId.split(':')[1]! : 'procedure';
    items.push({
      itemId: `item:${index}:${slug}`,
      description,
      componentId,
      gateCommand,
      completedAt: null,
      completedBy: null,
    });
  };
  for (const command of battery) {
    push(`Gate command green: ${command.command}`, null, command.command);
  }
  for (const step of plan.steps) {
    push(`Confirm plan step ${step.stepId} (${step.kind}) sealed an outcome`, step.componentId, null);
  }
  return sealChecklist({
    recordVersion: 1,
    checklistId: `release:${plan.planId.slice('plan:'.length)}`,
    kind: 'release',
    title: `Release of plan ${plan.planId} to ${plan.environmentId}`,
    planId: plan.planId,
    planDigest: plan.digest,
    runDigest: null,
    environmentId: plan.environmentId,
    items,
    provenance,
  });
}

/**
 * Derive the ROLLBACK checklist of a run whose receipt records a rollback
 * (deterministic): one item per restored placement + verification items.
 */
export function rollbackChecklistFor(run: DeployRun, provenance: DeployProvenance): OpsResult<OpsChecklist> {
  if (run.rollback === null) {
    return opsFail('validation', `run ${run.runId} carries no rollback receipt (nothing to roll back)`);
  }
  const items: {
    itemId: string;
    description: string;
    componentId: string | null;
    gateCommand: string | null;
    completedAt: string | null;
    completedBy: string | null;
  }[] = [];
  let index = 0;
  const push = (description: string, componentId: string | null): void => {
    index += 1;
    const slug = componentId !== null ? componentId.split(':')[1]! : 'procedure';
    items.push({
      itemId: `item:${index}:${slug}`,
      description,
      componentId,
      gateCommand: null,
      completedAt: null,
      completedBy: null,
    });
  };
  push(`Confirm the triggering health-check failure of ${run.rollback.triggeredByComponentId}`, run.rollback.triggeredByComponentId);
  for (const restored of run.rollback.restoredPlacements) {
    push(
      restored.toRevision === null
        ? `Confirm ${restored.componentId} is un-placed (fresh deploy reverted)`
        : `Confirm ${restored.componentId} serves prior revision ${restored.toRevision}`,
      restored.componentId,
    );
  }
  push('Confirm the post-rollback state digest equals the pre-deploy state digest', null);
  push('Notify the owning tenant of the completed rollback', null);
  return sealChecklist({
    recordVersion: 1,
    checklistId: `rollback:${run.runId.slice('run:'.length)}`,
    kind: 'rollback',
    title: `Rollback of run ${run.runId} in ${run.environmentId}`,
    planId: run.planId,
    planDigest: run.planDigest,
    runDigest: run.digest,
    environmentId: run.environmentId,
    items,
    provenance,
  });
}

/** Seal a checklist content (validates + neutrality-scans + digests). */
export function sealChecklist(content: ChecklistContent): OpsResult<OpsChecklist> {
  const parsed = ChecklistContentSchema.safeParse(content);
  if (!parsed.success) {
    return opsFail('validation', `checklist failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  const findings = scanProviderVocabulary(parsed.data);
  if (findings.length > 0) {
    return opsFail('provider-vocabulary-rejected', `checklist: ${findings.map((finding) => finding.excerpt).join('; ')}`);
  }
  return { ok: true, value: { ...parsed.data, digest: canonicalDigest(parsed.data as unknown as JsonValue) } };
}

/**
 * Mark one item complete (immutable update; typed refusal when the item is
 * already complete or unknown).
 */
export function completeChecklistItem(
  checklist: OpsChecklist,
  itemId: string,
  completedAt: string,
  completedBy: string,
): OpsResult<OpsChecklist> {
  const item = checklist.items.find((entry) => entry.itemId === itemId);
  if (item === undefined) return opsFail('validation', `unknown checklist item "${itemId}"`);
  if (item.completedAt !== null) return opsFail('duplicate-record', `checklist item "${itemId}" is already complete`);
  return sealChecklist({
    ...checklistContent(checklist),
    items: checklist.items.map((entry) =>
      entry.itemId === itemId ? { ...entry, completedAt, completedBy } : entry,
    ),
  });
}

/**
 * Admit a checklist for EXECUTION: every item complete + digest verified.
 * The typed refusal `recovery-not-reached`-style completion failure is
 * `validation` with the first incomplete item named.
 */
export function admitCompletedChecklist(checklist: OpsChecklist): OpsResult<OpsChecklist> {
  const verified = verifyChecklistDigest(checklist);
  if (!verified.ok) return verified;
  const incomplete = checklist.items.find((item) => item.completedAt === null || item.completedBy === null);
  if (incomplete !== undefined) {
    return opsFail('validation', `checklist "${checklist.checklistId}" item "${incomplete.itemId}" is not complete`);
  }
  return { ok: true, value: checklist };
}

/** Canonical JSON serialization (byte-stable). */
export function serializeChecklist(checklist: OpsChecklist): string {
  return canonicalJsonStringify(checklist as unknown as JsonValue);
}

export function deserializeChecklist(text: string): OpsResult<OpsChecklist> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return opsFail('validation', `serialized checklist is not valid JSON: ${(err as Error).message}`);
  }
  const revalidated = OpsChecklistSchema.safeParse(parsed);
  if (!revalidated.success) {
    return opsFail('validation', `checklist failed validation: ${revalidated.error.issues[0]?.message ?? 'unknown'}`);
  }
  return verifyChecklistDigest(revalidated.data);
}
