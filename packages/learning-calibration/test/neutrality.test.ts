// PROVIDER NEUTRALITY (architecture lock rule 13): no vendor, brand,
// marketplace, ERP, PM tool, or API surface can enter a
// learning-calibration record — unknown structural fields are the typed
// `vendor-fields-rejected`; the closed vocabularies carry no provider
// entries; the package surface speaks no vendor names.
import { describe, expect, it } from 'vitest';
import { sealComparisonFactInput as sealFact } from '../src/references';
import { sealOutcomeLearningCandidate } from '../src/eligibility';
import { sealDatasetRow, assembleDataset } from '../src/dataset';
import { sealCalibrationMetricSet } from '../src/metrics';
import {
  sealModelRevisionProposal,
  sealModelRevision,
} from '../src/model-registry';
import { sealLearningEvent } from '../src/events';
import {
  LEARNING_EVENT_DISCRIMINATORS,
  LEARNING_EXCLUSION_REASONS,
  LEARNING_VARIANCE_CLASSES,
} from '../src/version';
import {
  BAND_THRESHOLDS,
  PACK_REF,
  SOLUTION_ID,
  TENANT,
  candidateContent,
  candidateFamilyPool,
  comparisonFactContent,
  eligibleCandidateFamily,
  proposalContent,
  revisionDraftContent,
  T3,
} from './fixtures';
import { expectError, unwrap } from './helpers';

const SCOPE = { tenantId: TENANT, solutionId: SOLUTION_ID };

const VENDOR_FIELD = { vendorAccountId: 'acct-12345' };

describe('vendor fields cannot enter any learning-calibration record (strict objects)', () => {
  it('a comparison-fact input with a vendor field is vendor-fields-rejected', () => {
    const error = expectError(
      sealFact({ ...comparisonFactContent(), ...VENDOR_FIELD }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a candidate with a vendor field is vendor-fields-rejected', () => {
    const error = expectError(
      sealOutcomeLearningCandidate({ ...candidateContent(), ...VENDOR_FIELD }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a dataset-row content with a vendor field is vendor-fields-rejected', () => {
    const dataset = unwrap(
      assembleDataset(SCOPE, candidateFamilyPool(), eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    const row = { ...dataset.rows[0]!, ...VENDOR_FIELD };
    const error = expectError(sealDatasetRow(row));
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a proposal with a vendor field is vendor-fields-rejected', () => {
    const error = expectError(
      sealModelRevisionProposal({ ...proposalContent(), ...VENDOR_FIELD }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a model-revision draft with a vendor field is vendor-fields-rejected', () => {
    const error = expectError(
      sealModelRevision({ ...revisionDraftContent(), ...VENDOR_FIELD }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a learning event with a vendor field is vendor-fields-rejected', () => {
    const error = expectError(
      sealLearningEvent({
        schemaVersion: 1,
        streamId: 'stream:learning-tower-retrofit',
        sequence: 1,
        tenantId: TENANT,
        actor: 'principal:delivery-lead',
        causalParent: null,
        payload: {
          discriminator: 'learning:dataset-assembled',
          data: {
            solutionId: SOLUTION_ID,
            datasetId: 'dataset:tower-retrofit-00000000',
            datasetDigest: 'a'.repeat(64),
            eligibleCount: 1,
            excludedCount: 0,
            assembledAt: T3,
          },
        },
        occurredAt: T3,
        ...VENDOR_FIELD,
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a metric-set content with a vendor field is vendor-fields-rejected', () => {
    const dataset = unwrap(
      assembleDataset(SCOPE, candidateFamilyPool(), eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    const metricSet = { ...dataset.rows[0]!, vendorMetricTag: 'vendor' };
    const error = expectError(sealCalibrationMetricSet(metricSet as never));
    expect(error.code).toBe('vendor-fields-rejected');
  });
});

describe('the closed vocabularies carry no provider entries', () => {
  const PROVIDER_TOKENS = [
    'vendor',
    'provider',
    'jira',
    'sap',
    'salesforce',
    'aws',
    'azure',
    'shopify',
    'erp',
    'api',
  ] as const;

  it('no vocabulary member names a vendor/brand/marketplace/ERP/PM tool', () => {
    const vocabularies: readonly string[] = [
      ...LEARNING_EVENT_DISCRIMINATORS,
      ...LEARNING_EXCLUSION_REASONS,
      ...LEARNING_VARIANCE_CLASSES,
    ];
    for (const member of vocabularies) {
      for (const token of PROVIDER_TOKENS) {
        expect(member.toLowerCase()).not.toContain(token);
      }
    }
  });

  it('the pack reference carries a neutral qualified name (never a vendor id)', () => {
    expect(PACK_REF.packId).toMatch(/^epoch\.[a-z0-9.-]+$/);
    expect(PACK_REF.packId).not.toMatch(/vendor|provider|jira|sap/i);
  });
});
