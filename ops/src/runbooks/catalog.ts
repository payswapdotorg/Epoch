/**
 * @epoch/ops-kit — the RUNBOOK CATALOG (typed, versioned data).
 *
 * One runbook per incident class of the closed INCIDENT_CLASSES
 * vocabulary, referencing the reference topology's component ids (the
 * catalog documented in docs/operations/topology-catalog.md). The catalog
 * is DATA: `runbookCatalog(provenance)` seals the five reference runbooks
 * deterministically (same provenance -> same digests).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { scanProviderVocabulary } from '@epoch/deploy-model';
import type { DeployProvenance } from '@epoch/deploy-model';
import type { RunbookContent, RunbookRecord } from './schema';
import { RunbookContentSchema } from './schema';
import { opsFail, type OpsResult } from '../errors';

/** The reference component ids the catalog keys on (topology-catalog pairs). */
export const CATALOG_COMPONENTS = {
  agentProtocol: 'cmp:agent-protocol',
  tenancy: 'cmp:tenancy',
  eventLog: 'cmp:event-log',
  actionGateway: 'cmp:action-gateway',
  webApp: 'cmp:web-app',
} as const;

/**
 * Seal the runbook catalog (the five incident classes, in
 * INCIDENT_CLASSES order). Deterministic: identical provenance ->
 * identical digests.
 */
export function runbookCatalog(provenance: DeployProvenance): OpsResult<readonly RunbookRecord[]> {
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
    // 1. health-degradation — a placed component's probe observes failure.
    rb(
      'rb:health-degradation',
      'health-degradation',
      'Health degradation: a placed component fails its health check',
      [
        { kind: 'health-probe-failed', componentId: null, description: 'Any component of the environment observes a failed health probe.' },
      ],
      [
        { stepId: '1:quarantine-component:cmp:action-gateway', action: 'quarantine-component', componentId: CATALOG_COMPONENTS.actionGateway, expectedEffect: 'The degraded component stops serving traffic while the incident is contained.' },
        { stepId: '2:freeze-deploys:env', action: 'freeze-deploys', componentId: null, expectedEffect: 'No new deploy plans execute until recovery is verified.' },
        { stepId: '3:notify-operator:env', action: 'notify-operator', componentId: null, expectedEffect: 'The on-call operator acknowledges the incident.' },
      ],
      [
        { stepId: '1:pin-prior-revision:cmp:action-gateway', action: 'pin-prior-revision', componentId: CATALOG_COMPONENTS.actionGateway, expectedEffect: 'The last known-good revision of the degraded component is identified from the deploy receipts.' },
        { stepId: '2:restore-placement-revision:cmp:action-gateway', action: 'restore-placement-revision', componentId: CATALOG_COMPONENTS.actionGateway, expectedEffect: 'The environment placement is restored to the pinned prior revision (the deploy-model rollback path).' },
        { stepId: '3:re-run-health-probe:cmp:action-gateway', action: 're-run-health-probe', componentId: CATALOG_COMPONENTS.actionGateway, expectedEffect: 'The health probe is re-run against the restored revision and observed healthy.' },
        { stepId: '4:clear-quarantine:cmp:action-gateway', action: 'clear-quarantine', componentId: CATALOG_COMPONENTS.actionGateway, expectedEffect: 'The component resumes serving once the probe observes healthy.' },
      ],
      [
        { kind: 'component-healthy', componentId: CATALOG_COMPONENTS.actionGateway, description: 'The re-run probe observes the component healthy.' },
        { kind: 'placement-revision-restored', componentId: CATALOG_COMPONENTS.actionGateway, description: 'The placement carries the prior known-good revision.' },
        { kind: 'operator-notified', componentId: null, description: 'The operator notification was emitted.' },
      ],
    ),
    // 2. gate-violation — a promotion was attempted without green gates.
    rb(
      'rb:gate-violation',
      'gate-violation',
      'Gate violation: a promotion was attempted while the verification battery was not green',
      [
        { kind: 'gate-report-missing', componentId: null, description: 'A required battery command has no green report (a skipped gate).' },
      ],
      [
        { stepId: '1:freeze-deploys:env', action: 'freeze-deploys', componentId: null, expectedEffect: 'All deploy execution is frozen before any further promotion.' },
        { stepId: '2:notify-operator:env', action: 'notify-operator', componentId: null, expectedEffect: 'The violating plan id and missing command are reported to the operator.' },
      ],
      [
        { stepId: '1:re-run-verification-battery:env', action: 're-run-verification-battery', componentId: null, expectedEffect: 'The full verification battery is re-run from a clean checkout and observed green.' },
      ],
      [
        { kind: 'all-gates-green', componentId: null, description: 'Every battery command has a green report again.' },
        { kind: 'operator-notified', componentId: null, description: 'The operator notification was emitted.' },
      ],
    ),
    // 3. capacity-exhaustion — observed load exceeds a declared envelope.
    rb(
      'rb:capacity-exhaustion',
      'capacity-exhaustion',
      'Capacity exhaustion: a component exceeds its declared capacity envelope',
      [
        { kind: 'capacity-exhausted', componentId: null, description: 'A component observes load above its declared capacity replicas.' },
      ],
      [
        { stepId: '1:quarantine-component:cmp:web-app', action: 'quarantine-component', componentId: CATALOG_COMPONENTS.webApp, expectedEffect: 'Excess intake is shed at the degraded edge while capacity is corrected.' },
        { stepId: '2:freeze-deploys:env', action: 'freeze-deploys', componentId: null, expectedEffect: 'No capacity-affecting deploys run during the incident.' },
        { stepId: '3:notify-operator:env', action: 'notify-operator', componentId: null, expectedEffect: 'The operator is notified with the observed/declared figures.' },
      ],
      [
        { stepId: '1:scale-out-component:cmp:web-app', action: 'scale-out-component', componentId: CATALOG_COMPONENTS.webApp, expectedEffect: 'The component scales back within its declared capacity envelope (topology-declared replicas).' },
        { stepId: '2:re-run-health-probe:cmp:web-app', action: 're-run-health-probe', componentId: CATALOG_COMPONENTS.webApp, expectedEffect: 'The health probe is re-run at the corrected capacity and observed healthy.' },
        { stepId: '3:clear-quarantine:cmp:web-app', action: 'clear-quarantine', componentId: CATALOG_COMPONENTS.webApp, expectedEffect: 'Normal intake resumes within the envelope.' },
      ],
      [
        { kind: 'capacity-within-envelope', componentId: CATALOG_COMPONENTS.webApp, description: 'Observed load is within the declared replica envelope.' },
        { kind: 'component-healthy', componentId: CATALOG_COMPONENTS.webApp, description: 'The re-run probe observes the component healthy.' },
        { kind: 'operator-notified', componentId: null, description: 'The operator notification was emitted.' },
      ],
    ),
    // 4. integrity-mismatch — a record fails digest verification (tamper).
    rb(
      'rb:integrity-mismatch',
      'integrity-mismatch',
      'Integrity mismatch: a deployed record fails its digest verification',
      [
        { kind: 'digest-mismatch-observed', componentId: null, description: 'A topology/plan/receipt digest does not verify against its content.' },
      ],
      [
        { stepId: '1:freeze-deploys:env', action: 'freeze-deploys', componentId: null, expectedEffect: 'All deploy execution freezes on the first digest mismatch.' },
        { stepId: '2:quarantine-component:cmp:event-log', action: 'quarantine-component', componentId: CATALOG_COMPONENTS.eventLog, expectedEffect: 'The component carrying the unverifiable record is quarantined.' },
        { stepId: '3:notify-operator:env', action: 'notify-operator', componentId: null, expectedEffect: 'The mismatching digest pair is reported to the operator.' },
      ],
      [
        { stepId: '1:verify-record-digests:cmp:event-log', action: 'verify-record-digests', componentId: CATALOG_COMPONENTS.eventLog, expectedEffect: 'The full record chain is re-verified from the sealed topology down to the receipts.' },
        { stepId: '2:pin-prior-revision:cmp:event-log', action: 'pin-prior-revision', componentId: CATALOG_COMPONENTS.eventLog, expectedEffect: 'The last revision whose records verified end-to-end is pinned.' },
        { stepId: '3:restore-placement-revision:cmp:event-log', action: 'restore-placement-revision', componentId: CATALOG_COMPONENTS.eventLog, expectedEffect: 'The placement is restored to the verified prior revision.' },
        { stepId: '4:re-run-health-probe:cmp:event-log', action: 're-run-health-probe', componentId: CATALOG_COMPONENTS.eventLog, expectedEffect: 'The restored revision is probed and observed healthy.' },
        { stepId: '5:clear-quarantine:cmp:event-log', action: 'clear-quarantine', componentId: CATALOG_COMPONENTS.eventLog, expectedEffect: 'The component resumes serving verified records.' },
      ],
      [
        { kind: 'record-digests-verified', componentId: CATALOG_COMPONENTS.eventLog, description: 'The record chain verifies end-to-end again.' },
        { kind: 'placement-revision-restored', componentId: CATALOG_COMPONENTS.eventLog, description: 'The placement carries the verified prior revision.' },
        { kind: 'component-healthy', componentId: CATALOG_COMPONENTS.eventLog, description: 'The re-run probe observes the component healthy.' },
        { kind: 'operator-notified', componentId: null, description: 'The operator notification was emitted.' },
      ],
    ),
    // 5. rollout-stall — a deploy plan stalls mid-execution.
    rb(
      'rb:rollout-stall',
      'rollout-stall',
      'Rollout stall: a deploy plan stops making progress mid-execution',
      [
        { kind: 'deploy-step-stalled', componentId: null, description: 'A plan step exceeds its execution budget without an outcome.' },
      ],
      [
        { stepId: '1:freeze-deploys:env', action: 'freeze-deploys', componentId: null, expectedEffect: 'No further steps of the stalled plan (or others) execute.' },
        { stepId: '2:notify-operator:env', action: 'notify-operator', componentId: null, expectedEffect: 'The stalled step id and plan digest are reported to the operator.' },
      ],
      [
        { stepId: '1:verify-record-digests:cmp:agent-protocol', action: 'verify-record-digests', componentId: CATALOG_COMPONENTS.agentProtocol, expectedEffect: 'The stalled plan and its topology are re-verified (a digest fault is the common stall cause).' },
        { stepId: '2:resume-deploy-steps:env', action: 'resume-deploy-steps', componentId: null, expectedEffect: 'The plan resumes from the last sealed outcome (the replay path — never from scratch).' },
        { stepId: '3:re-run-health-probe:cmp:agent-protocol', action: 're-run-health-probe', componentId: CATALOG_COMPONENTS.agentProtocol, expectedEffect: 'The resumed rollout is probed at the promoted component and observed healthy.' },
      ],
      [
        { kind: 'deploy-steps-resumed', componentId: null, description: 'The stalled plan resumed from its verified prefix.' },
        { kind: 'record-digests-verified', componentId: CATALOG_COMPONENTS.agentProtocol, description: 'The plan and topology digests verify.' },
        { kind: 'component-healthy', componentId: CATALOG_COMPONENTS.agentProtocol, description: 'The resumed rollout observes the component healthy.' },
        { kind: 'operator-notified', componentId: null, description: 'The operator notification was emitted.' },
      ],
    ),
  ];

  const sealed: RunbookRecord[] = [];
  for (const content of catalog) {
    const parsed = RunbookContentSchema.safeParse(content);
    if (!parsed.success) {
      return opsFail('validation', `runbook catalog entry "${content.runbookId}" failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
    }
    const findings = scanProviderVocabulary(parsed.data);
    if (findings.length > 0) {
      return opsFail('provider-vocabulary-rejected', `runbook "${content.runbookId}": ${findings.map((finding) => finding.excerpt).join('; ')}`);
    }
    sealed.push({ ...parsed.data, digest: canonicalDigest(parsed.data as unknown as JsonValue) });
  }
  return { ok: true, value: sealed };
}
