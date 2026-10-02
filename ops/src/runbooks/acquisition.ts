/**
 * @epoch/ops-kit — the ACQUISITION RUNBOOKS (W054, ACR-006).
 *
 * The production operational runbook entries for EXTERNAL ACQUISITION
 * (the ecosystem-discovery capability over the external-source adapter):
 * acquisition monitoring, the degradation states (source unconfigured,
 * provider failure, quota/credit exhaustion), recovery procedures and
 * the cost-guardrail posture — following the runbook conventions of
 * `./catalog.ts` EXACTLY (the closed incident-class / signal / action /
 * recovery vocabularies of `../version.ts`, topology component ids,
 * content-addressed sealing with the typed `OpsResult`).
 *
 * Provider NEUTRALITY (docs/operations/provider-neutrality-contract.md):
 * these records describe the acquisition capability in neutral
 * vocabulary (the external acquisition source / the scheduled
 * ecosystem-discovery run / the per-day run cap) — the concrete
 * provider, the environment variable names and the free-tier math live
 * in the operations guide (docs/operations/acquisition.md), which is
 * the operator-facing companion of this data.
 *
 * The records are DATA: `acquisitionRunbooks(provenance)` seals them
 * deterministically (same provenance -> same digests) through the same
 * validators as the reference catalog (RunbookContentSchema + the
 * provider-vocabulary scan).
 *
 * WIRING NOTE (W054 ownership boundary): `ops/src/index.ts` is outside
 * W054's owned surface (ops/src/runbooks/*), so this module is not yet
 * re-exported from the @epoch/ops-kit public API, and the deploy-tree
 * evidence suite (deploy/test/ops-runbooks.test.ts) still pins the FIVE
 * reference runbooks of the main catalog. Wiring this catalog into the
 * public API + simulator evidence is a serialized Tech Lead change
 * (recorded in the W054 PR); the records themselves are final data.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { scanProviderVocabulary } from '@epoch/deploy-model';
import type { DeployProvenance } from '@epoch/deploy-model';
import type { RunbookContent, RunbookRecord } from './schema';
import { RunbookContentSchema } from './schema';
import { opsFail, type OpsResult } from '../errors';

/**
 * The topology components the acquisition runbooks key on. The scheduled
 * ecosystem-discovery trigger executes inside the deployed web app
 * (cmp:web-app — the runtime host); discovery records live in the
 * capability-discovery plane referenced opaquely.
 */
export const ACQUISITION_RUNBOOK_COMPONENTS = {
  webApp: 'cmp:web-app',
} as const;

/** The acquisition runbook ids (stable, content-independent). */
export const ACQUISITION_RUNBOOK_IDS = [
  'rb:acquisition-source-unconfigured',
  'rb:acquisition-provider-degradation',
  'rb:acquisition-quota-exhaustion',
] as const;

/**
 * Seal the acquisition runbook catalog (three entries over two incident
 * classes). Deterministic: identical provenance -> identical digests.
 */
export function acquisitionRunbooks(provenance: DeployProvenance): OpsResult<readonly RunbookRecord[]> {
  const rb = (
    runbookId: string,
    incidentClass: RunbookContent['incidentClass'],
    title: string,
    detection: RunbookContent['detection'],
    containment: RunbookContent['containment'],
    mitigation: RunbookContent['mitigation'],
    recoveryVerification: RunbookContent['recoveryVerification'],
  ): RunbookContent => ({
    recordVersion: 1,
    runbookId,
    incidentClass,
    title,
    detection,
    containment,
    mitigation,
    recoveryVerification,
    provenance,
  });

  const catalog: readonly RunbookContent[] = [
    // A. The acquisition source is UNCONFIGURED (credentials absent) —
    //    the documented graceful degradation state (optional capability).
    rb(
      'rb:acquisition-source-unconfigured',
      'health-degradation',
      'Acquisition source unconfigured: external discovery runs without the external source',
      [
        { kind: 'health-probe-degraded', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'Readiness reports the external acquisition binding as disabled: the scheduled ecosystem-discovery run records the acquisition leg in the disabled state (credentials for the external source absent) while the product otherwise serves.' },
      ],
      [
        // No containment needed: disabled is the SAFE state for an
        // optional capability — awareness is the only step.
        { stepId: '1:notify-operator:env', action: 'notify-operator', componentId: null, expectedEffect: 'The operator is notified that external acquisition is disabled and that discovery runs on the fixture reference source only (documented, expected degradation — not a product outage).' },
      ],
      [
        { stepId: '1:re-run-health-probe:cmp:web-app', action: 're-run-health-probe', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, expectedEffect: 'After the operator provisions the acquisition credentials through the deployment platform encrypted environment, the next readiness check reports the acquisition binding as configured and the next scheduled run records acquisition provenance in the run history.' },
      ],
      [
        { kind: 'component-degraded-but-serving', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'The product serves with discovery on the fixture reference source (the optional external capability degraded-and-surfaced, per the environment contract fail-safe precedence).' },
        { kind: 'component-healthy', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'After provisioning, a scheduled run completes with the acquisition leg enabled and provenance recorded.' },
        { kind: 'operator-notified', componentId: null, description: 'The operator notification was emitted.' },
      ],
    ),
    // B. The acquisition PROVIDER fails or returns malformed data —
    //    the run degrades, never the product; the next run recovers.
    rb(
      'rb:acquisition-provider-degradation',
      'health-degradation',
      'Acquisition provider degradation: the external source fails and the acquisition leg degrades',
      [
        { kind: 'health-probe-degraded', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'A scheduled ecosystem-discovery run records the acquisition leg in the degraded state with a TYPED provider failure (unauthorized, payment-required, not-found, rate-limited, timeout, malformed-response or unavailable) — never a raw provider error.' },
      ],
      [
        { stepId: '1:notify-operator:env', action: 'notify-operator', componentId: null, expectedEffect: 'The operator is notified with the typed failure code, the acquisition run id, the fetched-at instant and the raw-result digest from the run history record (full provenance, no secret values).' },
      ],
      [
        { stepId: '1:re-run-health-probe:cmp:web-app', action: 're-run-health-probe', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, expectedEffect: 'The next scheduled run (within the per-day quota) re-attempts the acquisition: the failed refresh left no partial state — the previous cached dataset survives and the re-attempt replaces it atomically on success.' },
        { stepId: '2:verify-record-digests:cmp:web-app', action: 'verify-record-digests', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, expectedEffect: 'The recovery run provenance is digest-verified: the raw-result digest, the content-addressed acquisition run id and every ingested candidate digest re-derive (untrusted observations are content-addressed, so recovery is provable).' },
      ],
      [
        { kind: 'component-degraded-but-serving', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'The product serves throughout: the degraded acquisition leg never blocks the scheduled run (the fixture reference source still feeds discovery).' },
        { kind: 'component-healthy', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'A subsequent scheduled run completes with the acquisition leg enabled and fresh provenance recorded.' },
        { kind: 'record-digests-verified', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'The recovery run record and its ingested candidates verify against their digests.' },
        { kind: 'operator-notified', componentId: null, description: 'The operator notification was emitted.' },
      ],
    ),
    // C. The per-day run cap or the provider credit is exhausted —
    //    the cost guardrail held (this is the system working).
    rb(
      'rb:acquisition-quota-exhaustion',
      'capacity-exhaustion',
      'Acquisition quota exhaustion: the per-day acquisition run cap or the provider credit is exhausted',
      [
        { kind: 'capacity-exhausted', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'A scheduled ecosystem-discovery run records the acquisition leg as degraded with the typed quota-exceeded failure (the per-day run cap refused the refresh) or the payment-required failure (the monthly platform credit is exhausted). The guardrail held: no uncontrolled cost is possible.' },
      ],
      [
        { stepId: '1:notify-operator:env', action: 'notify-operator', componentId: null, expectedEffect: 'The operator is notified with the observed/declared figures: runs used vs the per-day cap, the deterministic reset instant (the next epoch-day boundary) and the credit-conservation estimate against the free-tier monthly allowance.' },
      ],
      [
        { stepId: '1:scale-out-component:cmp:web-app', action: 'scale-out-component', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, expectedEffect: 'The operator either waits for the deterministic epoch-day reset (the default posture — the counter resets at the next UTC day boundary) or explicitly raises the per-day run cap through the environment contract after re-checking the free-tier monthly-credit math (a deliberate, recorded cost decision — never an emergency action).' },
        { stepId: '2:re-run-health-probe:cmp:web-app', action: 're-run-health-probe', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, expectedEffect: 'The next scheduled run after the reset (or the cap change) re-attempts the acquisition within the new quota; the run history records the outcome and the quota view.' },
      ],
      [
        { kind: 'capacity-within-envelope', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'Observed acquisition runs are within the declared per-day cap (the deterministic counter and the run history agree).' },
        { kind: 'component-healthy', componentId: ACQUISITION_RUNBOOK_COMPONENTS.webApp, description: 'A scheduled run completes with the acquisition leg enabled (or intentionally disabled), the product healthy throughout.' },
        { kind: 'operator-notified', componentId: null, description: 'The operator notification with the observed/declared figures was emitted.' },
      ],
    ),
  ];

  const sealed: RunbookRecord[] = [];
  for (const content of catalog) {
    const parsed = RunbookContentSchema.safeParse(content);
    if (!parsed.success) {
      return opsFail('validation', `acquisition runbook entry "${content.runbookId}" failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
    }
    const findings = scanProviderVocabulary(parsed.data);
    if (findings.length > 0) {
      return opsFail('provider-vocabulary-rejected', `acquisition runbook "${content.runbookId}": ${findings.map((finding) => finding.excerpt).join('; ')}`);
    }
    sealed.push({ ...parsed.data, digest: canonicalDigest(parsed.data as unknown as JsonValue) });
  }
  return { ok: true, value: sealed };
}
