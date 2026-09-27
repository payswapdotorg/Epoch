/**
 * @epoch/adapter-ifc — the deterministic NEUTRAL projection: building
 * model fixtures -> REAL W002 assertion inputs.
 *
 * This module TRANSLATES the provider layer's parsed models into the
 * world-model graph's OWN input records (architecture: "External
 * standards map into the model" — mapped INTO, never the reverse; the
 * world model stays the semantic authority). The standard's entity and
 * relationship classes are mapped to neutral construction-domain type
 * keys by the provider seam; the projection carries REAL
 * `AssertionInput` documents (validated by the world-model's own
 * schemas at runtime — a frozen runtime dependency of this adapter).
 *
 * Determinism (pinned by test/determinism.test.ts): the projection is a
 * PURE function of (tenant, model, observedAt) — neutral entity ids are
 * content-derived, provider row order never leaks (entity inputs sort
 * by entityId, relations by (source, target, type)), and identical
 * inputs project byte-identically (identical digests).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex, type Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { AssertionInput } from '@epoch/world-model';
import type { ProviderModel } from './provider/payload';
import { neutralEntityClassOf, neutralRelationClassOf } from './provider/payload';
import type { BuildingModelObservation, BuildingModelProjection, BuildingModelSourceRef } from './types';
import { IFC_ADAPTER_RECORD_VERSION } from './version';

/** The neutral building-model identity derived from a fixture (`bim:<slug>`). */
export function modelIdOf(model: ProviderModel): string {
  return `bim:${model.file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-')}`;
}

/** The provider model's content digest (canonical JSON, content-addressed). */
export function modelDigestOf(model: ProviderModel): Sha256Hex {
  return canonicalDigest(model as unknown as JsonValue);
}

/** The neutral source reference of a model (the W006 exact-revision convention). */
export function sourceRefOf(model: ProviderModel): BuildingModelSourceRef {
  const digest = modelDigestOf(model);
  return {
    artifactId: modelIdOf(model),
    revision: `content-${digest.slice(0, 12)}`,
    digest,
  };
}

/** Neutral entity ids (opaque; the standard's refs ride as DATA, never as shape). */
function elementEntityId(modelId: string, providerRef: string): string {
  return `entity:${modelId}-elem-${providerRef.replace(/^#/, 'e')}`;
}

/** The evidence every projected input carries: the exact model revision (W006 conventions). */
function modelEvidence(digest: Sha256Hex, modelId: string): AssertionInput['provenance']['evidence'] {
  return [
    {
      id: `model:${digest}`,
      kind: 'external',
      digest,
      locator: `model:${modelId}`,
      description: 'The exact content-addressed building-model fixture the assertion was projected from.',
    },
  ];
}

/** Input of {@link projectModel} (the projection is total and pure). */
export interface ProjectionInput {
  readonly tenantId: TenantId;
  readonly model: ProviderModel;
  readonly observedAt: Timestamp;
}

/**
 * Project a parsed building model INTO the world-model graph as REAL W002
 * assertion inputs: one entity epoch per element (neutral construction
 * type key + adapted properties), one relation statement per typed
 * relationship. Entity inputs first (sorted by entityId), then relation
 * inputs (sorted by source, target, type) — provider row order never
 * leaks. Every input carries the adapter actor, the exact source digest
 * as external evidence, and imported confidence.
 */
export function projectModel(input: ProjectionInput): BuildingModelProjection {
  const modelId = modelIdOf(input.model);
  const source = sourceRefOf(input.model);
  const actor = {
    id: 'adapter:building-model-semantic',
    role: 'external-provider' as const,
    displayName: 'Building Model semantic adapter (reference)',
  };
  const provenance = {
    actor,
    method: 'building-model-projection',
    evidence: modelEvidence(source.digest, modelId),
  };
  const confidence = {
    distribution: { kind: 'point' as const, value: 1 },
    method: 'imported' as const,
    rationale: 'Direct mapping of the exact content-addressed building-model fixture.',
  };
  const validity = { from: input.observedAt };

  const entityInputs: AssertionInput[] = input.model.elements.map((element) => ({
    statement: {
      kind: 'entity' as const,
      entityId: elementEntityId(modelId, element.ref),
      entityType: neutralEntityClassOf(element.entityClass),
      properties: {
        ...(element.name !== undefined ? { displayName: element.name } : {}),
        providerElementClass: element.entityClass,
        ...element.properties,
      },
    },
    provenance,
    confidence,
    validity,
    at: input.observedAt,
  }));
  entityInputs.sort((a, b) => {
    const ea = a.statement as { entityId: string };
    const eb = b.statement as { entityId: string };
    return ea.entityId < eb.entityId ? -1 : ea.entityId > eb.entityId ? 1 : 0;
  });

  const relationInputs: AssertionInput[] = [];
  for (const relation of input.model.relations) {
    for (const related of relation.related) {
      relationInputs.push({
        statement: {
          kind: 'relation' as const,
          relationType: neutralRelationClassOf(relation.relationClass),
          source: elementEntityId(modelId, related),
          target: elementEntityId(modelId, relation.relating),
        },
        provenance,
        confidence,
        validity,
        at: input.observedAt,
      });
    }
  }
  relationInputs.sort((a, b) => {
    const sa = a.statement as { source: string; target: string; relationType: string };
    const sb = b.statement as { source: string; target: string; relationType: string };
    return sa.source < sb.source
      ? -1
      : sa.source > sb.source
        ? 1
        : sa.target < sb.target
          ? -1
          : sa.target > sb.target
            ? 1
            : sa.relationType < sb.relationType
              ? -1
              : 1;
  });

  const assertionInputs = [...entityInputs, ...relationInputs];
  const content = {
    schemaVersion: IFC_ADAPTER_RECORD_VERSION,
    tenantId: input.tenantId,
    modelId,
    source,
    observedAt: input.observedAt,
    assertionInputs,
  };
  return { ...content, projectionDigest: canonicalDigest(content as unknown as JsonValue) };
}

/**
 * The source-category observation record: the typed observation of the
 * external artifact (deterministic, content-addressed).
 */
export function observeModel(input: ProjectionInput): BuildingModelObservation {
  const modelId = modelIdOf(input.model);
  const source = sourceRefOf(input.model);
  const content = {
    schemaVersion: IFC_ADAPTER_RECORD_VERSION,
    tenantId: input.tenantId,
    modelId,
    source,
    elementCount: input.model.elements.length,
    relationCount: input.model.relations.length,
    observedAt: input.observedAt,
    provenance: {
      actor: {
        id: 'adapter:building-model-source',
        role: 'external-provider' as const,
        displayName: 'Building Model source adapter (reference)',
      },
      method: 'building-model-observation',
      evidence: modelEvidence(source.digest, modelId),
    },
    confidence: {
      distribution: { kind: 'point' as const, value: 1 },
      method: 'imported' as const,
      rationale: 'Direct observation of the exact content-addressed building-model fixture.',
    },
  };
  return { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** Re-verify a projection's digest (tamper detection; total). */
export function verifyProjection(projection: BuildingModelProjection): boolean {
  const { projectionDigest, ...content } = projection;
  return canonicalDigest(content as unknown as JsonValue) === projectionDigest;
}

/** Re-verify an observation's digest (tamper detection; total). */
export function verifyObservation(observation: BuildingModelObservation): boolean {
  const { contentDigest, ...content } = observation;
  return canonicalDigest(content as unknown as JsonValue) === contentDigest;
}
