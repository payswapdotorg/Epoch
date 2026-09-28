/**
 * W033 evidence — PROVIDER NEUTRALITY: the typed
 * `provider-vocabulary-rejected` refusal at every admission door, and the
 * clean scan over the reference records.
 */
import { describe, expect, it } from 'vitest';
import {
  PROVIDER_VOCABULARY_TOKENS,
  REFERENCE_BATTERY_COMMANDS,
  environmentStateFromTopology,
  scanProviderVocabulary,
  sealComponent,
  sealEnvironment,
  sealGatePolicy,
  unwrapOrThrow,
} from '@epoch/deploy-model';
import { sealIncidentTrace, sealRunbook } from '@epoch/ops-kit';
import type { RunbookContent } from '@epoch/ops-kit';
import {
  ON_CALL,
  RELEASE_MANAGER,
  T0,
  TENANT_LABS,
  T3,
  provenanceOf,
  referenceTopology,
} from './helpers';

describe('provider-vocabulary-rejected (the active blocklist)', () => {
  it('provider-vocabulary-rejected: a component carrying cloud-vendor vocabulary is refused', () => {
    const result = sealComponent({
      recordVersion: 1,
      componentId: 'cmp:edge-cache',
      kind: 'service',
      name: 'Edge cache on AWS',
      workspacePath: 'services/edge-cache',
      dependsOn: [],
      health: { checkKind: 'readiness', timeoutMs: 5_000, intervalMs: 10_000 },
      capacity: { replicas: 2 },
      provenance: provenanceOf(RELEASE_MANAGER, 'catalog-component', T0),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('provider-vocabulary-rejected');
  });

  it('provider-vocabulary-rejected: orchestrator vocabulary in a name is refused', () => {
    const result = sealComponent({
      recordVersion: 1,
      componentId: 'cmp:control-plane',
      kind: 'service',
      name: 'Kubernetes control plane',
      workspacePath: 'services/control-plane',
      dependsOn: [],
      health: { checkKind: 'readiness', timeoutMs: 5_000, intervalMs: 10_000 },
      capacity: { replicas: 3 },
      provenance: provenanceOf(RELEASE_MANAGER, 'catalog-component', T0),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('provider-vocabulary-rejected');
  });

  it('provider-vocabulary-rejected: infrastructure-tooling vocabulary in a workspace path is refused', () => {
    const result = sealComponent({
      recordVersion: 1,
      componentId: 'cmp:infra-config',
      kind: 'package',
      name: 'Infrastructure config',
      workspacePath: 'terraform/live',
      dependsOn: [],
      health: { checkKind: 'readiness', timeoutMs: 5_000, intervalMs: 10_000 },
      capacity: { replicas: 1 },
      provenance: provenanceOf(RELEASE_MANAGER, 'catalog-component', T0),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('provider-vocabulary-rejected');
  });

  it('provider-vocabulary-rejected: vendor vocabulary in an environment record is refused', () => {
    const result = sealEnvironment({
      recordVersion: 1,
      environmentId: 'env:prod2',
      tier: 'prod',
      displayName: 'Production on Azure',
      tenantIds: [TENANT_LABS],
      provisionedAt: T0,
      provenance: provenanceOf(RELEASE_MANAGER, 'catalog-environment', T0),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('provider-vocabulary-rejected');
  });

  it('provider-vocabulary-rejected: provider address forms are refused as VALUES', () => {
    const result = sealComponent({
      recordVersion: 1,
      componentId: 'cmp:object-store',
      kind: 'service',
      name: 'Object store adapter target arn:aws:s3:::epoch-artifacts',
      workspacePath: 'services/object-store',
      dependsOn: [],
      health: { checkKind: 'readiness', timeoutMs: 5_000, intervalMs: 10_000 },
      capacity: { replicas: 2 },
      provenance: provenanceOf(RELEASE_MANAGER, 'catalog-component', T0),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('provider-vocabulary-rejected');
  });

  it('provider-vocabulary-rejected: a gate policy naming provider tooling is refused', () => {
    const result = sealGatePolicy({
      recordVersion: 1,
      gateId: 'gate:skewed-battery',
      description: 'Runs the deploy through docker build before promotion.',
      required: true,
      battery: REFERENCE_BATTERY_COMMANDS,
      provenance: provenanceOf(RELEASE_MANAGER, 'catalog-gate', T3),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('provider-vocabulary-rejected');
  });

  it('provider-vocabulary-rejected: a runbook step naming provider vocabulary is refused', () => {
    const runbook: RunbookContent = {
      recordVersion: 1,
      runbookId: 'rb:vendor-escape',
      incidentClass: 'rollout-stall',
      title: 'A runbook that must never admit',
      detection: [{ kind: 'deploy-step-stalled', componentId: null, description: 'A step stalled.' }],
      containment: [],
      mitigation: [
        {
          stepId: '1:notify-operator:env',
          action: 'notify-operator',
          componentId: null,
          expectedEffect: 'Page the operator through the Azure duty channel.',
        },
      ],
      recoveryVerification: [{ kind: 'operator-notified', componentId: null, description: 'The operator was paged.' }],
      provenance: provenanceOf(ON_CALL, 'catalog-runbook', T3),
    };
    const result = sealRunbook(runbook);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('provider-vocabulary-rejected');
  });

  it('provider-vocabulary-rejected: an incident trace carrying vendor vocabulary is refused', () => {
    const topology = referenceTopology();
    const state = unwrapOrThrow(environmentStateFromTopology(topology, 'env:prod', TENANT_LABS, { baselineAt: T0 }));
    const content = {
      recordVersion: 1 as const,
      traceId: 'trace:vendor-escape',
      incidentClass: 'rollout-stall' as const,
      environmentId: 'env:prod',
      tenantId: TENANT_LABS,
      topologyDigest: topology.digest,
      initialState: state,
      signals: [{ kind: 'deploy-step-stalled' as const, componentId: null, observedAt: T3 }],
      events: [{ kind: 'step-stalled-observed' as const, stepId: '3:promote:cmp:tenancy', observedAt: T3 }],
      priorRevisions: [],
      recoveryProbes: [],
      provenance: provenanceOf(ON_CALL, 'catalog-trace', T3),
    };
    // The neutral trace admits...
    expect(sealIncidentTrace(content).ok).toBe(true);
    // ...and the SAME trace poisoned with a provider-named detail is refused.
    const poisoned = sealIncidentTrace({
      ...content,
      signals: [
        { kind: 'deploy-step-stalled' as const, componentId: null, observedAt: T3, detail: 'stalled inside the eks node group' },
      ],
    });
    expect(poisoned.ok).toBe(false);
    if (!poisoned.ok) expect(poisoned.error.code).toBe('provider-vocabulary-rejected');
  });
});

describe('the neutrality scan itself', () => {
  it('neutrality-scan-token-boundaries: tokens never match inside unrelated words', () => {
    expect(scanProviderVocabulary({ name: 'Lawson and Barnes' })).toHaveLength(0);
    expect(scanProviderVocabulary({ note: 'barnyard reconstruction' })).toHaveLength(0);
    expect(scanProviderVocabulary({ key: 'awsRegion', value: 'eu-west-1' })).toHaveLength(1);
    expect(scanProviderVocabulary({ key: 'region', value: 'docker://registry/epoch' })).toHaveLength(1);
  });

  it('neutrality-scan-clean-on-reference-records: every reference record scans clean', () => {
    const topology = referenceTopology();
    expect(scanProviderVocabulary(topology)).toHaveLength(0);
    expect(PROVIDER_VOCABULARY_TOKENS).toContain('aws');
    expect(PROVIDER_VOCABULARY_TOKENS).toContain('kubernetes');
    expect(PROVIDER_VOCABULARY_TOKENS).toContain('terraform');
  });
});
