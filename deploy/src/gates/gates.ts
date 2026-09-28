/**
 * @epoch/deploy-model — DEPLOY GATES (the verification battery as DATA).
 *
 * A plan may NOT promote without the verification battery green. The gate
 * is a typed, content-addressed POLICY record whose battery is an ordered
 * list of commands with expected exit codes — data, never code paths. The
 * Work Order's battery is pinned verbatim in
 * {@link referenceVerificationGatePolicy} (the same three commands the
 * reviewer runs). Gate OUTCOMES arrive as fixture {@link GateReport}
 * records (an executor input); the executor refuses to run — with the
 * typed `gate-skip-rejected` / `gate-failed-rejected` errors — unless
 * every required command has a report with the expected exit code.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import { DeployRecordVersionSchema, GateIdSchema } from '../primitives';
import { digestOf, fail, validationError, type DeployResult } from '../primitives';
import { DeployProvenanceSchema, type DeployProvenance } from '../provenance';
import { renderNeutralityFindings, scanProviderVocabulary } from '../neutrality';

// --------------------------------------------------------------------------------
// The gate policy record.
// --------------------------------------------------------------------------------

/** One battery command: the exact command string + expected exit code. */
export const GateCommandSchema = z
  .strictObject({
    command: z.string().min(1).max(256),
    expectExitCode: z.number().int().min(0).max(255),
    /** Budget for the command, in milliseconds (declaration, not call). */
    timeoutMs: z.number().int().min(1).max(3_600_000),
  })
  .readonly();
export type GateCommand = z.infer<typeof GateCommandSchema>;

const gatePolicyShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  gateId: GateIdSchema,
  description: z.string().min(1).max(256),
  /** Required gates are refusal points (the only supported value is true). */
  required: z.literal(true),
  /** The ordered battery (data — commands are never executed in-model). */
  battery: z.array(GateCommandSchema).min(1).readonly(),
  provenance: DeployProvenanceSchema,
});

/** A gate policy (content half). */
export const DeployGatePolicyContentSchema = gatePolicyShape.readonly();
export type DeployGatePolicyContent = z.infer<typeof DeployGatePolicyContentSchema>;

/** A sealed gate policy (content-addressed). */
export const DeployGatePolicySchema = gatePolicyShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type DeployGatePolicy = z.infer<typeof DeployGatePolicySchema>;

// --------------------------------------------------------------------------------
// Fixture gate reports (executor inputs).
// --------------------------------------------------------------------------------

/** One recorded battery-command outcome (fixture data: no command runs). */
export const GateReportSchema = z
  .strictObject({
    gateId: GateIdSchema,
    command: z.string().min(1).max(256),
    exitCode: z.number().int().min(0).max(255),
    completedAt: TimestampSchema,
    provenance: DeployProvenanceSchema,
  })
  .readonly();
export type GateReport = z.infer<typeof GateReportSchema>;

// --------------------------------------------------------------------------------
// The reference battery (the Work Order verification battery, verbatim).
// --------------------------------------------------------------------------------

/** The verification battery commands, verbatim from the W033 Work Order. */
export const REFERENCE_BATTERY_COMMANDS: readonly GateCommand[] = [
  { command: 'pnpm install', expectExitCode: 0, timeoutMs: 600_000 },
  { command: 'pnpm check', expectExitCode: 0, timeoutMs: 600_000 },
  {
    command: 'pnpm exec turbo run typecheck lint test build --concurrency=1 --force',
    expectExitCode: 0,
    timeoutMs: 3_600_000,
  },
];

/** The reference gate id (the one-and-only promoted gate of this model). */
export const REFERENCE_GATE_ID = 'gate:verification-battery' as const;

/**
 * The reference verification-battery gate policy — the Work Order battery
 * as a sealed record (deterministic: same provenance -> same digest).
 */
export function referenceVerificationGatePolicy(provenance: DeployProvenance): DeployResult<DeployGatePolicy> {
  return sealGatePolicy({
    recordVersion: 1,
    gateId: REFERENCE_GATE_ID,
    description: 'The Epoch verification battery: install, governance/boundary checks, and the full typecheck/lint/test/build turbo run.',
    required: true,
    battery: REFERENCE_BATTERY_COMMANDS,
    provenance,
  });
}

// --------------------------------------------------------------------------------
// Sealing + verification.
// --------------------------------------------------------------------------------

/** The content half of a sealed gate policy. */
export function gatePolicyContent(policy: DeployGatePolicy): Omit<DeployGatePolicy, 'digest'> {
  const { digest: _digest, ...rest } = policy;
  void _digest;
  return rest;
}

/** Validate + neutrality-scan + seal a gate policy content. */
export function sealGatePolicy(content: DeployGatePolicyContent): DeployResult<DeployGatePolicy> {
  const parsed = DeployGatePolicyContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: validationError('gate policy', parsed.error) };
  const findings = scanProviderVocabulary(parsed.data);
  if (findings.length > 0) {
    return {
      ok: false,
      error: fail('provider-vocabulary-rejected', `gate policy: ${renderNeutralityFindings(findings)}`),
    };
  }
  return { ok: true, value: { ...parsed.data, digest: digestOf(parsed.data as unknown as JsonValue) } };
}

/** Verify a sealed gate policy's digest (typed `digest-mismatch`). */
export function verifyGatePolicyDigest(policy: DeployGatePolicy): DeployResult<DeployGatePolicy> {
  const expected = digestOf(gatePolicyContent(policy) as unknown as JsonValue);
  return expected === policy.digest
    ? { ok: true, value: policy }
    : { ok: false, error: fail('digest-mismatch', `gate policy "${policy.gateId}": digest does not match content (tampered policy)`, ['digest']) };
}

/** Canonical JSON serialization. */
export function serializeGatePolicy(policy: DeployGatePolicy): string {
  return canonicalJsonStringify(policy as unknown as JsonValue);
}

/** Parse + digest-verify a serialized gate policy (total). */
export function deserializeGatePolicy(text: string): DeployResult<DeployGatePolicy> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: fail('validation', `serialized gate policy is not valid JSON: ${(err as Error).message}`) };
  }
  const typed = DeployGatePolicySchema.safeParse(parsed);
  if (!typed.success) return { ok: false, error: validationError('gate policy', typed.error) };
  return verifyGatePolicyDigest(typed.data);
}

// --------------------------------------------------------------------------------
// Gate evaluation (the refusal point).
// --------------------------------------------------------------------------------

/** Validate fixture gate reports against a policy. REFUSAL SEMANTICS:
 *  - a battery command with NO matching report -> `gate-skip-rejected`;
 *  - a matching report with the wrong exit code -> `gate-failed-rejected`;
 *  - a report that matches no battery command -> `unknown-gate`.
 * Green means: every battery command has a report with the expected exit
 * code and no foreign reports exist. */
export function evaluateGateReports(
  policy: DeployGatePolicy,
  reports: readonly GateReport[],
): DeployResult<{ readonly green: true; readonly commandCount: number }> {
  const seen = new Set<string>();
  for (const report of reports) {
    const key = `${report.gateId}\u0000${report.command}`;
    if (report.gateId !== policy.gateId) {
      return { ok: false, error: fail('unknown-gate', `report references gate "${report.gateId}" but the plan gates on "${policy.gateId}"`, ['gateReports']) };
    }
    if (seen.has(key)) {
      return { ok: false, error: fail('duplicate-record', `duplicate gate report for command "${report.command}"`, ['gateReports']) };
    }
    seen.add(key);
    if (!policy.battery.some((entry) => entry.command === report.command)) {
      return { ok: false, error: fail('unknown-gate', `report for command "${report.command}" matches no battery command of "${policy.gateId}"`, ['gateReports']) };
    }
  }
  for (const entry of policy.battery) {
    const report = reports.find((candidate) => candidate.command === entry.command);
    if (report === undefined) {
      return {
        ok: false,
        error: fail('gate-skip-rejected', `required gate command skipped: "${entry.command}" has no green report`, ['gateReports']),
      };
    }
    if (report.exitCode !== entry.expectExitCode) {
      return {
        ok: false,
        error: fail(
          'gate-failed-rejected',
          `gate command "${entry.command}" exited ${report.exitCode}, expected ${entry.expectExitCode} (battery not green)`,
          ['gateReports'],
        ),
      };
    }
  }
  return { ok: true, value: { green: true, commandCount: policy.battery.length } };
}

/** Helper: build fixture gate reports for a green run (all exit 0). */
export function greenGateReports(
  policy: DeployGatePolicy,
  completedAt: string,
  provenance: (command: string) => DeployProvenance,
): GateReport[] {
  return policy.battery.map((entry) => ({
    gateId: policy.gateId,
    command: entry.command,
    exitCode: entry.expectExitCode,
    completedAt,
    provenance: provenance(entry.command),
  }));
}
