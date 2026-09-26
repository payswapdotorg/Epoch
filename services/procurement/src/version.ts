/**
 * Procurement-runtime service contract versions and closed vocabularies.
 *
 * The service is the thin typed HOST FACADE over the @epoch/procurement
 * kernel (the W037 division of ownership): it owns requirement intake,
 * the SupplierPort adapter seam, authorization/tenancy gating,
 * idempotent replay handling and the procurement:* event streams —
 * never new contract authorities (the typed procurement contract is the
 * kernel's; the runtime reuses its error taxonomy and documents, never
 * forks, it).
 *
 * Neutrality (architecture lock rule 13): no field, id or vocabulary
 * names a supplier vendor, brand, marketplace, ERP or API surface. The
 * host is provider-neutral by construction; concrete supplier systems
 * are adapters behind the SupplierPort seam (ONE in-memory reference
 * adapter ships with this package).
 */

/** Version of the procurement-runtime host surface. */
export const PROCUREMENT_RUNTIME_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by runtime snapshots. */
export const RUNTIME_RECORD_VERSION = 1 as const;

/** Health statuses of the runtime host (typed liveness data). */
export const RUNTIME_HEALTH_STATUSES = ['healthy', 'degraded'] as const;

/** One runtime health status. */
export type RuntimeHealthStatus = (typeof RUNTIME_HEALTH_STATUSES)[number];

/** The runtime intake admission kinds. */
export const INTAKE_ADMISSION_KINDS = ['admitted', 'duplicate-intake-returned'] as const;

/** One intake admission kind. */
export type IntakeAdmissionKind = (typeof INTAKE_ADMISSION_KINDS)[number];
