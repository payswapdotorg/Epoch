/**
 * @epoch/web — the liveness endpoint (W051, ACR-006).
 *
 * Cheap and dependency-free: the process is up and serving. Readiness
 * (bindings, migrations, degradation flags) lives at /api/readyz.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOOTED_AT_EPOCH_MS = Date.now();

export function GET(): NextResponse {
  return NextResponse.json({
    ok: true,
    profile: process.env['EPOCH_DEPLOYMENT_PROFILE'] ?? 'development',
    uptimeMs: Date.now() - BOOTED_AT_EPOCH_MS,
  });
}
