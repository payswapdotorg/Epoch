/**
 * @epoch/web shell typed error taxonomy (W014).
 *
 * Every shell entry point is TOTAL (the Epoch discipline): errors are
 * values, never exceptions. `ShellError` is the shell's own typed taxonomy;
 * it deliberately reuses the mirrored authorization denial codes where the
 * semantics coincide (tenant isolation, principal state) so cross-cutting
 * rejections speak one vocabulary.
 */

/** One issue reported by a shell validation. */
export interface ShellIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed shell error taxonomy (values, never thrown). */
export type ShellErrorCode =
  | 'validation'
  | 'unknown-route'
  | 'duplicate-route'
  | 'unknown-mount'
  | 'duplicate-mount'
  | 'duplicate-feature'
  | 'cross-tenant-denied'
  | 'missing-tenant-context';

/** The typed shell error union. */
export type ShellError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ShellIssue[];
    }
  | {
      readonly code: 'unknown-route';
      readonly message: string;
      readonly routeId: string;
    }
  | {
      readonly code: 'duplicate-route';
      readonly message: string;
      readonly routeId: string;
    }
  | {
      readonly code: 'unknown-mount';
      readonly message: string;
      readonly mountId: string;
    }
  | {
      readonly code: 'duplicate-mount';
      readonly message: string;
      readonly mountId: string;
    }
  | {
      readonly code: 'duplicate-feature';
      readonly message: string;
      readonly featureId: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly tenantOfContext: string | null;
      readonly tenantOfSubject: string | null;
    }
  | {
      readonly code: 'missing-tenant-context';
      readonly message: string;
    };

/** Result of a shell operation: a value or a typed error. */
export type ShellResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ShellError };

/** Construct an ok result. */
export function shellOk<T>(value: T): ShellResult<T> {
  return { ok: true, value };
}

/** Construct a typed `validation` error from collected issues. */
export function validationError(message: string, issues: readonly ShellIssue[]): ShellError {
  return { code: 'validation', message, issues: [...issues] };
}

/** Construct a typed `unknown-route` error. */
export function unknownRouteError(routeId: string): ShellError {
  return {
    code: 'unknown-route',
    message: `Unknown route id '${routeId}' — the id is not present in the route registry.`,
    routeId,
  };
}

/** Construct a typed `duplicate-route` error. */
export function duplicateRouteError(routeId: string): ShellError {
  return {
    code: 'duplicate-route',
    message: `Route id '${routeId}' is already registered (a route id is unique forever).`,
    routeId,
  };
}

/** Construct a typed `unknown-mount` error. */
export function unknownMountError(mountId: string): ShellError {
  return {
    code: 'unknown-mount',
    message: `Unknown mount id '${mountId}' — the shell does not expose this mounting point.`,
    mountId,
  };
}

/** Construct a typed `duplicate-mount` error. */
export function duplicateMountError(mountId: string): ShellError {
  return {
    code: 'duplicate-mount',
    message: `Mount id '${mountId}' is already registered (a mount id is unique forever).`,
    mountId,
  };
}

/** Construct a typed `duplicate-feature` error. */
export function duplicateFeatureError(featureId: string): ShellError {
  return {
    code: 'duplicate-feature',
    message: `Feature id '${featureId}' is already registered (a feature id is unique forever).`,
    featureId,
  };
}

/** Construct a typed `cross-tenant-denied` error (the R12 boundary). */
export function crossTenantDeniedError(
  tenantOfContext: string | null,
  tenantOfSubject: string | null,
): ShellError {
  return {
    code: 'cross-tenant-denied',
    message:
      `Cross-tenant access rejected (tenant isolation, R12): context tenant ` +
      `'${tenantOfContext ?? 'none'}' may not access subject tenant ` +
      `'${tenantOfSubject ?? 'none'}'.`,
    tenantOfContext,
    tenantOfSubject,
  };
}

/** Construct a typed `missing-tenant-context` error. */
export function missingTenantContextError(message: string): ShellError {
  return { code: 'missing-tenant-context', message };
}
