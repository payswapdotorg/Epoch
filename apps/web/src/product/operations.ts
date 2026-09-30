/**
 * @epoch/web — THE UI operation surface registry (W047).
 *
 * The frozen declaration of every Application Gateway operation the web
 * product's UI affordances map to. Pin (a): every UI affordance that
 * implies execution maps to a Gateway operation (or is a read-only
 * projection); the operation-surface test asserts this registry is a
 * SUBSET of the frozen @epoch/client-runtime vocabulary — the web app can
 * never invent, fork or bypass an authority path.
 */
import type { GatewayOperationName } from '@epoch/client-runtime';

/** One UI operation surface entry: what the affordance is, and its kind. */
export interface UiOperationSurfaceEntry {
  readonly operation: GatewayOperationName;
  readonly surface: string;
  readonly mutating: boolean;
}

/**
 * The complete UI operation surface (frozen order). Every entry maps to a
 * real gateway operation; the registry is the single place the web app
 * names operations outside typed envelope builders.
 */
export const UI_OPERATION_SURFACE: readonly UiOperationSurfaceEntry[] = [
  { operation: 'session.issue', surface: 'sign-in / session issuance', mutating: true },
  { operation: 'session.validate', surface: 'reload / session revalidation', mutating: false },
  { operation: 'session.revoke', surface: 'sign-out', mutating: true },
  { operation: 'context.resolve', surface: 'project entry / navigator context', mutating: false },
  { operation: 'world.snapshot', surface: 'World View (authoritative digest)', mutating: false },
  { operation: 'world.entities', surface: 'World View (entity projection)', mutating: false },
  { operation: 'evidence.intake', surface: 'unknowns / evidence capture', mutating: true },
  { operation: 'evidence.get', surface: 'unknowns / evidence lookup', mutating: false },
  { operation: 'discovery.run', surface: 'capability / role discovery', mutating: true },
  { operation: 'action.submit', surface: 'Action Gateway approval (submit)', mutating: true },
  { operation: 'action.approve', surface: 'Action Gateway approval (approve)', mutating: true },
  { operation: 'action.execute', surface: 'Action Gateway approval (execute)', mutating: true },
  { operation: 'action.status', surface: 'Action Gateway status / supervision', mutating: false },
  { operation: 'constraints.evaluate', surface: 'decide (constraint check)', mutating: false },
  { operation: 'verification.validateChain', surface: 'decide / verify (chain)', mutating: false },
  { operation: 'solution.sealVersion', surface: 'decide (alternatives)', mutating: true },
  { operation: 'solution.approveBaseline', surface: 'decide (baseline approval)', mutating: true },
  { operation: 'program.build', surface: 'plan (program of work)', mutating: true },
  { operation: 'program.schedule', surface: 'plan (BOQ / domain schedule)', mutating: false },
  { operation: 'delivery.open', surface: 'realize (open delivery)', mutating: true },
  { operation: 'delivery.observe', surface: 'realize / observe (field observation)', mutating: true },
  { operation: 'delivery.close', surface: 'close (delivery closing)', mutating: true },
  { operation: 'procurement.quote', surface: 'acquire (quote)', mutating: true },
  { operation: 'procurement.order', surface: 'acquire (purchase order)', mutating: true },
  { operation: 'actualization.forecast', surface: 'observe / forecast (rolling forecast)', mutating: false },
  { operation: 'outcome.learn', surface: 'learn (outcome registration)', mutating: true },
  { operation: 'access.project', surface: 'authorized projections', mutating: false },
  { operation: 'supervision.check', surface: 'observe / verify (supervision pass)', mutating: false },
  { operation: 'alerts.raise', surface: 'supervision (alert)', mutating: true },
  { operation: 'marketplace.entitlement', surface: 'marketplace entitlement', mutating: false },
  { operation: 'events.read', surface: 'event stream (read-only)', mutating: false },
  { operation: 'recovery.replay', surface: 'offline queue drain (idempotent replay)', mutating: true },
] as const;

/** The operation names the UI surface declares. */
export const UI_OPERATIONS: readonly GatewayOperationName[] = UI_OPERATION_SURFACE.map(
  (entry) => entry.operation,
);
