/**
 * @epoch/application-gateway — the pg driver static anchor (SERVICE LAYER
 * ONLY; ACR-006 post-credential deployment fix, 2026-10-03).
 *
 * The frozen binding seam (postgres-binding.ts) loads the driver through a
 * DYNAMIC expression import (import(PG_DRIVER_MODULE)) — deliberately kept
 * external by webpack (/* webpackIgnore: true *\/) so the driver binds only
 * at the service-layer seam (the W046 pin-5 boundary). That dynamic
 * expression is INVISIBLE to the serverless file tracer: the first real
 * production boot answered readyz "Cannot find module 'pg'" (and, after the
 * driver itself was force-included, "Cannot find module 'pg-types'" — the
 * pnpm isolated layout places the driver's dependency closure outside the
 * traced tree).
 *
 * This module is the STATIC anchor: deployment importers (apps/web) import
 * the driver constructor through it, and with the deployment platform
 * keeping pg EXTERNAL (serverExternalPackages), webpack emits a real static
 * require('pg') in the server bundle — which the file tracer follows,
 * carrying the driver's FULL require tree (pg-connection-string, pg-pool,
 * pg-protocol, pg-types, pgpass, pg-cloudflare, postgres-*) into the
 * serverless function. The anchor imports the driver ONLY here, in the
 * service layer — exactly the W046 pin-5 boundary (the driver still never
 * appears outside services/application-gateway).
 *
 * The seam's duck-typed structural binding is unchanged; the anchor exists
 * for module-graph traceability, not for a second binding.
 */
import { Pool } from 'pg';

/**
 * The driver's Pool constructor, statically imported (the traceability
 * anchor). Callers must NOT construct pools from this — pools are created
 * exclusively by `connectPostgresPool` at the frozen seam.
 */
export const PG_DRIVER_POOL_CTOR: typeof Pool = Pool;
