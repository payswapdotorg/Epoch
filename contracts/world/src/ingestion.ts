import type { PropertyName, TypeKey } from './primitives';

/**
 * External standards ingestion contract surface.
 *
 * External standards map INTO the world model, never the reverse
 * (architecture-lock rule: no provider semantics in kernel types). A
 * mapping is pure data: it declares how named external entity/relation
 * shapes translate to registered Epoch type keys and property names. The
 * world model validates mappings (targets must be registered types) and
 * stores them for lookup; it never executes mapping logic. Concrete
 * provider adapters (Git, IFC, MCP, FMI, ...) arrive in later Work Orders
 * (W007/W029) and sit behind this surface.
 */

/** Maps an external entity shape onto a registered Epoch entity type. */
export interface ExternalEntityTypeMapping {
  /** External type name (opaque to the kernel). */
  readonly external: string;
  /** Registered Epoch entity type key. */
  readonly target: TypeKey;
  /** Optional external-property -> Epoch-property renames. */
  readonly propertyMap?: Readonly<Record<string, PropertyName>> | undefined;
}

/** Maps an external relation shape onto a registered Epoch relation type. */
export interface ExternalRelationTypeMapping {
  /** External relation name (opaque to the kernel). */
  readonly external: string;
  /** Registered Epoch relation type key. */
  readonly target: TypeKey;
  /** Optional external-property -> Epoch-property renames. */
  readonly propertyMap?: Readonly<Record<string, PropertyName>> | undefined;
}

/**
 * A registered external-standard mapping. `id` is a stable opaque mapping
 * identifier; `standard` names the external standard or provider ontology
 * (opaque; `epoch` is reserved and rejected).
 */
export interface ExternalMapping {
  readonly id: string;
  readonly standard: string;
  readonly standardVersion?: string | undefined;
  readonly description?: string | undefined;
  readonly entityTypes: readonly ExternalEntityTypeMapping[];
  readonly relationTypes: readonly ExternalRelationTypeMapping[];
}
