/**
 * The sandbox ISOLATION CHECK (the W030 security/isolation core):
 * a DETERMINISTIC, PURE predicate over a sandbox subject description
 * and an isolation profile. Fail-closed — the verdict is `conforms`
 * ONLY when every check passes; ANY violation is a typed
 * {@link IsolationViolation} carrying the closed code vocabulary.
 *
 * The checks (in this exact order — deterministic violation lists):
 *
 * 1. `trust-class-exceeds-ceiling` — the subject's trust class is
 *    above the profile's maximum (numeric rank over t0..t4).
 * 2. `flavor-not-admitted` — the subject's flavor is outside the
 *    admitted flavor set.
 * 3. `data-handling-not-admitted` — the subject's data-handling
 *    classification is outside the admitted set.
 * 4. `host-function-not-legal` — a grant names a host function
 *    outside the MIRRORED W008 host-function vocabulary.
 * 5. `resource-scope-not-legal` — a grant names a (resource, access)
 *    pair outside the MIRRORED W008 legal-scope table.
 * 6. `grant-exceeds-trust-ceiling` — a grant exceeds the MIRRORED
 *    W008 trust-class ceiling table (verdict AGREEMENT with the REAL
 *    W008 grantExceedsCeiling is pinned by the parity test).
 * 7. `capability-binding-missing` — the subject carries grants but
 *    no capability bindings to ground them.
 * 8. `listing-required` — the profile requires a marketplace listing
 *    reference and the subject carries none.
 *
 * Zero wall-clock, zero randomness, zero I/O. Two identical inputs
 * always produce byte-identical verdicts.
 */
import type { IsolationViolation } from './errors';
import type { IsolationProfile } from './policy';
import type { SandboxSubject } from './subject';
import {
  SANDBOX_GRANT_CEILINGS,
  SANDBOX_HOST_FUNCTIONS,
  SANDBOX_LEGAL_RESOURCE_SCOPES,
} from './version';

/** The check verdict: `conforms` or the typed violation list. */
export interface IsolationVerdict {
  readonly verdict: 'conforms' | 'violation';
  readonly violations: readonly IsolationViolation[];
}

/** The numeric rank of a trust-class token (t0 = 0 … t4 = 4). */
function trustClassRank(trustClass: string): number {
  return Number.parseInt(trustClass.slice(1), 10);
}

/** The scope key of a (resource, access) pair. */
function scopeKey(scope: { readonly resource: string; readonly access: string }): string {
  return `${scope.resource}.${scope.access}`;
}

/** The mirror of W008's grantExceedsCeiling: the first offender of a grant against its trust-class ceiling. */
function grantExceedsCeiling(
  grant: { readonly hostFunctions: readonly string[]; readonly resourceScopes: readonly { readonly resource: string; readonly access: string }[] },
  trustClass: string,
): { readonly hostFunction?: string; readonly resourceScope?: string } {
  const ceiling = SANDBOX_GRANT_CEILINGS.find((entry) => entry.trustClass === trustClass);
  if (ceiling === undefined) return {};
  const ceilingFunctions = ceiling.hostFunctions as readonly string[];
  for (const fn of grant.hostFunctions) {
    if (!ceilingFunctions.includes(fn)) {
      return { hostFunction: fn };
    }
  }
  for (const scope of grant.resourceScopes) {
    if (!ceiling.resourceScopes.some((allowed) => scopeKey(allowed) === scopeKey(scope))) {
      return { resourceScope: scopeKey(scope) };
    }
  }
  return {};
}

/**
 * Check one sandbox subject against one isolation profile.
 * Deterministic and total: the verdict lists EVERY violation in the
 * fixed check order (never throws, never clocks, never I/O).
 */
export function checkIsolation(
  subject: SandboxSubject,
  profile: IsolationProfile,
): IsolationVerdict {
  const violations: IsolationViolation[] = [];

  // 1. Trust-class ceiling.
  if (trustClassRank(subject.trustClass) > trustClassRank(profile.maxTrustClass)) {
    violations.push({
      code: 'trust-class-exceeds-ceiling',
      detail: `subject trust class "${subject.trustClass}" exceeds the profile maximum "${profile.maxTrustClass}"`,
      path: 'trustClass',
    });
  }

  // 2. Flavor admission.
  if (!profile.allowedFlavors.includes(subject.flavor as never)) {
    violations.push({
      code: 'flavor-not-admitted',
      detail: `subject flavor "${subject.flavor}" is outside the admitted flavor set [${profile.allowedFlavors.join(', ')}]`,
      path: 'flavor',
    });
  }

  // 3. Data-handling admission.
  if (!profile.allowedDataHandling.includes(subject.dataHandling as never)) {
    violations.push({
      code: 'data-handling-not-admitted',
      detail: `subject data-handling "${subject.dataHandling}" is outside the admitted set [${profile.allowedDataHandling.join(', ')}]`,
      path: 'dataHandling',
    });
  }

  // 4-6. Grant conformance (host functions, resource scopes, trust ceilings).
  for (let grantIndex = 0; grantIndex < subject.grants.length; grantIndex += 1) {
    const grant = subject.grants[grantIndex]!;
    const grantPath = `grants[${grantIndex}]`;
    for (const fn of grant.hostFunctions) {
      if (!(SANDBOX_HOST_FUNCTIONS as readonly string[]).includes(fn)) {
        violations.push({
          code: 'host-function-not-legal',
          detail: `grant names host function "${fn}" outside the W008 vocabulary`,
          path: `${grantPath}.hostFunctions`,
        });
      }
    }
    for (const scope of grant.resourceScopes) {
      const legal = SANDBOX_LEGAL_RESOURCE_SCOPES.some(
        (allowed) => scopeKey(allowed) === scopeKey(scope),
      );
      if (!legal) {
        violations.push({
          code: 'resource-scope-not-legal',
          detail: `grant names resource scope "${scopeKey(scope)}" outside the W008 legal table`,
          path: `${grantPath}.resourceScopes`,
        });
      }
    }
    const exceeding = grantExceedsCeiling(grant, subject.trustClass);
    if (exceeding.hostFunction !== undefined) {
      violations.push({
        code: 'grant-exceeds-trust-ceiling',
        detail: `grant host function "${exceeding.hostFunction}" exceeds the "${subject.trustClass}" ceiling (the W008 table)`,
        path: `${grantPath}.hostFunctions`,
      });
    } else if (exceeding.resourceScope !== undefined) {
      violations.push({
        code: 'grant-exceeds-trust-ceiling',
        detail: `grant resource scope "${exceeding.resourceScope}" exceeds the "${subject.trustClass}" ceiling (the W008 table)`,
        path: `${grantPath}.resourceScopes`,
      });
    }
  }

  // 7. Capability-binding grounding.
  if (subject.grants.length > 0 && subject.bindings.length === 0) {
    violations.push({
      code: 'capability-binding-missing',
      detail: 'the subject carries grants but no capability bindings to ground them',
      path: 'bindings',
    });
  }

  // 8. Marketplace listing requirement.
  if (profile.requireMarketplaceListing && subject.listingId === undefined) {
    violations.push({
      code: 'listing-required',
      detail: 'the isolation profile requires a marketplace listing reference and the subject carries none',
      path: 'listingId',
    });
  }

  return violations.length === 0
    ? { verdict: 'conforms', violations: [] }
    : { verdict: 'violation', violations };
}
