/**
 * @epoch/web — the readiness endpoint (W051, ACR-006).
 *
 * The secret-free readiness projection (spec/production-operations.md):
 * binding kinds + presence booleans, migration state, degraded flags
 * and environment issues. NEVER exposes secret values (the redacted
 * projection is enforced by construction in production-env.ts).
 *
 * `ready=false` when the environment has production-critical issues
 * (the same fail-closed rule the binding layer enforces at boot) or
 * when the product runtime cannot build (the response carries the
 * failure class, never the raw error/secret).
 */
import { NextResponse } from 'next/server';
import { getProductionBindings, degradedFlags } from '@/server/production-binding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const bindings = await getProductionBindings();
    const environment = bindings.environment;
    const ready = environment.criticalIssues.length === 0;
    return NextResponse.json({
      ok: true,
      ready,
      profile: environment.profile,
      bindings: {
        persistence: bindings.redacted.database,
        objectStore: bindings.redacted.objectStore,
        rateLimit: bindings.redacted.rateLimit,
        acquisition: bindings.redacted.acquisition,
      },
      degraded: degradedFlags(environment),
      issues: environment.issues,
      criticalIssues: environment.criticalIssues,
    });
  } catch (cause) {
    // The fail-closed boot path (production critical issues) or a build
    // failure: report NOT READY with the failure class only.
    return NextResponse.json(
      {
        ok: true,
        ready: false,
        profile: process.env['EPOCH_DEPLOYMENT_PROFILE'] ?? 'development',
        error: cause instanceof Error ? cause.name : 'UnknownError',
        message: cause instanceof Error ? cause.message.slice(0, 300) : 'the production bindings failed to build',
      },
      { status: 503 },
    );
  }
}
