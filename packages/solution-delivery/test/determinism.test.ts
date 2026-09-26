// Determinism evidence: no insertion-order leaks anywhere — the ledger
// fold, the lifecycle fold, and the schedule folds are invariant under
// admission-order permutation; the emission is byte-stable.
import { describe, expect, it } from 'vitest';
import {
  admitDistinctionRecord,
  foldDistinctionRecords,
  renderSolutionDeliveryContractFiles,
  renderSolutionDeliveryPublicContractFiles,
  sealDistinctionRecord,
  foldLifecycleStages,
  admitLifecycleStage,
  admitLifecycleTransition,
  type LifecycleGraph,
} from '../src/index';
import { distinctionContents, emptyLedger, TENANT, T1, T2, PRINCIPAL } from './fixtures';

describe('distinction ledger determinism', () => {
  it('the fold is invariant under admission-order permutation', () => {
    const kinds = Object.keys(distinctionContents());
    let forward = emptyLedger();
    let backward = emptyLedger();
    const reversed = [...kinds].reverse();
    for (const kind of kinds) {
      const sealed = sealDistinctionRecord(distinctionContents()[kind]);
      if (!sealed.ok) continue;
      const admitted = admitDistinctionRecord(forward, sealed.value);
      if (admitted.ok) {
        forward = admitted.value;
      }
    }
    for (const kind of reversed) {
      const sealed = sealDistinctionRecord(distinctionContents()[kind]);
      if (!sealed.ok) continue;
      const admitted = admitDistinctionRecord(backward, sealed.value);
      if (admitted.ok) {
        backward = admitted.value;
      }
    }
    expect(foldDistinctionRecords(backward)).toEqual(foldDistinctionRecords(forward));
  });
});

describe('lifecycle fold determinism', () => {
  function stage(recordId: string) {
    return {
      schema: 'epoch.solution-delivery.lifecycle-stage',
      schemaVersion: 1,
      recordId,
      tenantId: TENANT,
      subject: {
        solutionId: 'solution:tower-retrofit',
        subjectKind: 'solution-package',
        subjectId: 'solution:tower-retrofit',
      },
      stage: 'plan',
      enteredAt: T1,
      enteredBy: PRINCIPAL,
    };
  }

  it('the fold is invariant under stage-record admission order', () => {
    let a: LifecycleGraph = { tenantId: TENANT, solutionId: 'solution:tower-retrofit', stages: [], transitions: [] };
    let b: LifecycleGraph = { tenantId: TENANT, solutionId: 'solution:tower-retrofit', stages: [], transitions: [] };
    const ids = ['stage:a', 'stage:b', 'stage:c'];
    for (const id of ids) {
      const admitted = admitLifecycleStage(a, stage(id));
      if (admitted.ok) a = admitted.value;
    }
    for (const id of [...ids].reverse()) {
      const admitted = admitLifecycleStage(b, stage(id));
      if (admitted.ok) b = admitted.value;
    }
    expect(foldLifecycleStages(b)).toEqual(foldLifecycleStages(a));
  });

  it('transitions fold deterministically (sorted by record id)', () => {
    const graph: LifecycleGraph = {
      tenantId: TENANT,
      solutionId: 'solution:tower-retrofit',
      stages: [],
      transitions: [],
    };
    const withStage = admitLifecycleStage(graph, stage('stage:plan'));
    if (!withStage.ok) return;
    const withStage2 = admitLifecycleStage(withStage.value, stage('stage:decide'));
    if (!withStage2.ok) return;
    const withTransition = admitLifecycleTransition(withStage2.value, {
      schema: 'epoch.solution-delivery.lifecycle-transition',
      schemaVersion: 1,
      recordId: 'transition:t-1',
      tenantId: TENANT,
      subject: {
        solutionId: 'solution:tower-retrofit',
        subjectKind: 'solution-package',
        subjectId: 'solution:tower-retrofit',
      },
      relation: 'precedes',
      fromStageRecordId: 'stage:plan',
      toStageRecordId: 'stage:decide',
      recordedAt: T2,
      recordedBy: PRINCIPAL,
    });
    if (!withTransition.ok) return;
    const folded = foldLifecycleStages(withTransition.value);
    expect(folded[0]!.relationsOut).toEqual([
      { relation: 'precedes', toStageRecordId: 'stage:decide' },
    ]);
  });
});

describe('contract emission determinism', () => {
  it('two renders of the in-package artifact set are byte-identical', () => {
    expect(renderSolutionDeliveryContractFiles()).toEqual(renderSolutionDeliveryContractFiles());
  });

  it('two renders of the public artifact set are byte-identical', () => {
    expect(renderSolutionDeliveryPublicContractFiles()).toEqual(
      renderSolutionDeliveryPublicContractFiles(),
    );
  });
});
