/**
 * @epoch/provenance — published contract types (v1).
 *
 * A typed, PROV-DM-adapted model of who did what, to which things, how, and
 * when (R5 evidence/provenance, R17 auditability): agents (who), activities
 * (how/when), and entities (what), connected by six core binary relations
 * (generation, usage, association, attribution, derivation, delegation).
 * The mapping surface is PROV-friendly — typed entities/activities/agents
 * with PROV-native relation structure — without importing a PROV library.
 *
 * Neutrality: node and statement identifiers are opaque strings owned by
 * their producing domain; `entityKind`/`activityKind` are open kebab-case
 * slugs, so domain packs describe their own vocabulary while the kernel
 * owns only the relational structure.
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { PROVENANCE_AGENT_KINDS, PROVENANCE_RELATIONS } from './version';

/** PROV-DM agent kinds, adapted (person, organization, software, hardware, system). */
export type ProvenanceAgentKind = (typeof PROVENANCE_AGENT_KINDS)[number];

/** The six core PROV-DM relations, adapted as a discriminating union tag. */
export type ProvenanceRelation = (typeof PROVENANCE_RELATIONS)[number];

/** Who: a person, organization, software agent, hardware device, or system. */
export interface ProvenanceAgent {
  readonly agentId: string;
  readonly agentKind: ProvenanceAgentKind;
  readonly displayName?: string | undefined;
}

/** How/when: a process or action performed over some period of time. */
export interface ProvenanceActivity {
  readonly activityId: string;
  /** Open kebab-case slug vocabulary owned by the describing domain. */
  readonly activityKind: string;
  readonly startedAt?: Timestamp | undefined;
  readonly endedAt?: Timestamp | undefined;
  readonly displayName?: string | undefined;
}

/**
 * What: a durable thing an activity used or generated — an artifact, an
 * evidence record, a requirement, a result. When the entity is
 * content-addressed (e.g. an evidence record), `digest` carries its exact
 * content address.
 */
export interface ProvenanceEntity {
  readonly entityId: string;
  /** Open kebab-case slug vocabulary owned by the describing domain. */
  readonly entityKind: string;
  /** Exact content address for content-addressed entities (e.g. evidence). */
  readonly digest?: Sha256Hex | undefined;
  readonly displayName?: string | undefined;
}

/**
 * The six core PROV-DM relations as a discriminated union of statements.
 * Identifier fields reference nodes declared in the same graph; validation
 * rejects unknown agents, unknown activities, and dangling entities.
 */
export type ProvenanceStatement =
  | {
      readonly relation: 'was-generated-by';
      readonly entityId: string;
      readonly activityId: string;
      readonly time?: Timestamp | undefined;
      readonly role?: string | undefined;
    }
  | {
      readonly relation: 'used';
      readonly activityId: string;
      readonly entityId: string;
      readonly time?: Timestamp | undefined;
      readonly role?: string | undefined;
    }
  | {
      readonly relation: 'was-associated-with';
      readonly activityId: string;
      readonly agentId: string;
      readonly role?: string | undefined;
    }
  | {
      readonly relation: 'was-attributed-to';
      readonly entityId: string;
      readonly agentId: string;
    }
  | {
      readonly relation: 'was-derived-from';
      readonly generatedEntityId: string;
      readonly usedEntityId: string;
      readonly activityId?: string | undefined;
    }
  | {
      readonly relation: 'acted-on-behalf-of';
      readonly subordinateAgentId: string;
      readonly responsibleAgentId: string;
      readonly activityId?: string | undefined;
    };

/**
 * A provenance graph: a closed bundle of agents, activities, and entities
 * plus the statements connecting them. Carries the `schemaVersion`
 * discriminator on its serialized form; its identity is the SHA-256 of its
 * canonical JSON serialization (see `computeProvenanceDigest`).
 */
export interface ProvenanceGraph {
  readonly schemaVersion: 1;
  readonly agents: readonly ProvenanceAgent[];
  readonly activities: readonly ProvenanceActivity[];
  readonly entities: readonly ProvenanceEntity[];
  readonly statements: readonly ProvenanceStatement[];
}

/** Issue codes reported by the provenance parse/validation surface. */
export type ProvenanceIssueCode =
  | 'version-mismatch'
  | 'schema'
  | 'duplicate-agent'
  | 'duplicate-activity'
  | 'duplicate-entity'
  | 'unknown-agent'
  | 'unknown-activity'
  | 'unknown-entity'
  | 'self-derivation'
  | 'derivation-cycle'
  | 'activity-time-order';

/** One typed, human-readable issue (entry points never throw). */
export interface ProvenanceIssue {
  readonly code: ProvenanceIssueCode;
  readonly message: string;
  readonly path?: readonly (string | number)[];
}
