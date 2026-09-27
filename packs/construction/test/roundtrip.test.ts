// Round-trip serialization + digest verification for EVERY public type:
// the sealed profile, the vocabulary bundle (every vocabulary family), the
// work templates, the BOQ view, the programme view, the delivery-link
// index, and the outcome views.
import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_OUTCOME_TYPES,
  BoqViewSchema,
  ConstructionOutcomeViewSchema,
  ConstructionProgrammeViewSchema,
  DeliveryLinkIndexSchema,
  constructionPackProfile,
  constructionVocabularyBundle,
  constructionWorkTemplates,
  foldDeliveryLinks,
  projectBoq,
  projectConstructionOutcomes,
  projectConstructionProgramme,
  sealConstructionProfile,
  SealedConstructionProfileSchema,
  verifyBoqView,
  verifyConstructionProgrammeView,
  verifyConstructionProfile,
  verifyVocabularyBundle,
  verifyWorkTemplate,
} from '../src/index';
import { outcomeRecords, warehouseChain } from './fixtures';

describe('round-trip: every public type survives JSON serialization + digest verification', () => {
  const chain = warehouseChain();

  it('the sealed pack profile round-trips', () => {
    const sealed = sealConstructionProfile(constructionPackProfile(chain.solution.tenantId));
    const json = JSON.parse(JSON.stringify(sealed));
    expect(SealedConstructionProfileSchema.safeParse(json).success).toBe(true);
    const verified = verifyConstructionProfile(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(sealed);
    }
  });

  it('the vocabulary bundle round-trips (all six vocabulary families)', () => {
    const bundle = constructionVocabularyBundle();
    const json = JSON.parse(JSON.stringify(bundle));
    const verified = verifyVocabularyBundle(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value.entityBindings).toEqual(bundle.entityBindings);
      expect(verified.value.measurementMethods).toEqual(bundle.measurementMethods);
      expect(verified.value.costClassifications).toEqual(bundle.costClassifications);
      expect(verified.value.verificationMethods).toEqual(bundle.verificationMethods);
      expect(verified.value.constraintDescriptors).toEqual(bundle.constraintDescriptors);
      expect(verified.value.outcomeTypes).toEqual(bundle.outcomeTypes);
    }
  });

  it('every work template round-trips', () => {
    for (const template of constructionWorkTemplates()) {
      const verified = verifyWorkTemplate(JSON.parse(JSON.stringify(template)));
      expect(verified.ok, template.templateId).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(template);
      }
    }
  });

  it('the BOQ view round-trips through its schema AND its digest verification', () => {
    const boq = projectBoq({
      solution: chain.solution,
      program: chain.program,
      acquisitions: chain.acquisitions,
      delivery: chain.delivery,
      worldEntities: chain.worldEntities,
    });
    if (!boq.ok) {
      throw new Error('fixture BOQ failed to project');
    }
    const json = JSON.parse(JSON.stringify(boq.value));
    expect(BoqViewSchema.safeParse(json).success).toBe(true);
    const verified = verifyBoqView(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(boq.value);
    }
  });

  it('the programme view round-trips through its schema AND its digest verification', () => {
    const programme = projectConstructionProgramme(chain.program);
    if (!programme.ok) {
      throw new Error('fixture programme failed to project');
    }
    const json = JSON.parse(JSON.stringify(programme.value));
    expect(ConstructionProgrammeViewSchema.safeParse(json).success).toBe(true);
    const verified = verifyConstructionProgrammeView(json);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(programme.value);
    }
  });

  it('the delivery-link index round-trips through its schema', () => {
    const links = foldDeliveryLinks({
      solution: chain.solution,
      program: chain.program,
      acquisitions: chain.acquisitions,
      delivery: chain.delivery,
    });
    if (!links.ok) {
      throw new Error('fixture links failed to fold');
    }
    const json = JSON.parse(JSON.stringify(links.value));
    expect(DeliveryLinkIndexSchema.safeParse(json).success).toBe(true);
    expect(json).toEqual(links.value);
  });

  it('the outcome views round-trip through their schema', () => {
    const views = projectConstructionOutcomes(outcomeRecords(), CONSTRUCTION_OUTCOME_TYPES);
    for (const view of views) {
      const parsed = ConstructionOutcomeViewSchema.safeParse(JSON.parse(JSON.stringify(view)));
      expect(parsed.success, view.recordId).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toEqual(view);
      }
    }
  });
});
