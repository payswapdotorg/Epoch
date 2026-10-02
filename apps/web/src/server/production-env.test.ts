/**
 * W051 (ACR-006) — the production environment contract tests: profile
 * detection, fail-safe defaults, validation issues (never thrown),
 * production critical gating, and the secret-free redaction invariant.
 */
import { describe, expect, it } from 'vitest';
import { readProductionEnvironment, redactedEnvironment } from './production-env';

describe('readProductionEnvironment (the typed environment contract)', () => {
  it('empty source => development profile, everything local, no issues', () => {
    const env = readProductionEnvironment({});
    expect(env.profile).toBe('development');
    expect(env.database.configured).toBe(false);
    expect(env.objectStore.configured).toBe(false);
    expect(env.rateLimit.configured).toBe(false);
    expect(env.apify.configured).toBe(false);
    expect(env.issues).toEqual([]);
    expect(env.criticalIssues).toEqual([]);
  });

  it('profile detection: explicit development|preview|production honored; unknown fails safe', () => {
    expect(readProductionEnvironment({ EPOCH_DEPLOYMENT_PROFILE: 'preview' }).profile).toBe('preview');
    expect(readProductionEnvironment({ EPOCH_DEPLOYMENT_PROFILE: 'production' }).profile).toBe('production');
    const bogus = readProductionEnvironment({ EPOCH_DEPLOYMENT_PROFILE: 'prodction' });
    expect(bogus.profile).toBe('development');
    expect(bogus.issues.length).toBe(1);
    expect(bogus.issues[0]).toContain('EPOCH_DEPLOYMENT_PROFILE');
  });

  it('database configuration: postgres URLs accepted, others rejected with an issue', () => {
    const good = readProductionEnvironment({ EPOCH_DATABASE_URL: 'postgresql://u:p@host/db?sslmode=require' });
    expect(good.database.configured).toBe(true);
    const bad = readProductionEnvironment({ EPOCH_DATABASE_URL: 'mysql://nope' });
    expect(bad.database.configured).toBe(false);
    expect(bad.issues.some((issue) => issue.includes('EPOCH_DATABASE_URL'))).toBe(true);
  });

  it('object store: complete vs partial configuration', () => {
    const complete = readProductionEnvironment({
      EPOCH_OBJECT_STORE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      EPOCH_OBJECT_STORE_BUCKET: 'epoch-evidence',
      EPOCH_OBJECT_STORE_ACCESS_KEY_ID: 'key',
      EPOCH_OBJECT_STORE_SECRET_ACCESS_KEY: 'secret',
    });
    expect(complete.objectStore.configured).toBe(true);
    expect(complete.objectStore.region).toBe('auto');
    const partial = readProductionEnvironment({
      EPOCH_OBJECT_STORE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      EPOCH_OBJECT_STORE_BUCKET: 'epoch-evidence',
    });
    expect(partial.objectStore.configured).toBe(false);
    expect(partial.issues.some((issue) => issue.includes('partially configured'))).toBe(true);
  });

  it('rate limit: both URL and token required; budgets default; overrides parse', () => {
    const partial = readProductionEnvironment({ EPOCH_RATE_LIMIT_REST_URL: 'https://x.upstash.io' });
    expect(partial.rateLimit.configured).toBe(false);
    const complete = readProductionEnvironment({
      EPOCH_RATE_LIMIT_REST_URL: 'https://x.upstash.io',
      EPOCH_RATE_LIMIT_REST_TOKEN: 'tok',
      EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW: '10',
      EPOCH_RATE_LIMIT_IP_WINDOW_MS: '30000',
    });
    expect(complete.rateLimit.configured).toBe(true);
    expect(complete.budgets.ip).toEqual({ requestsPerWindow: 10, windowMs: 30_000 });
    expect(complete.budgets.tenant).toEqual({ requestsPerWindow: 600, windowMs: 60_000 });
    const badBudget = readProductionEnvironment({ EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW: 'zero' });
    expect(badBudget.budgets.ip.requestsPerWindow).toBe(120);
    expect(badBudget.issues.some((issue) => issue.includes('EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW'))).toBe(true);
  });

  it('PRODUCTION fails closed without durable persistence/object storage (critical issues)', () => {
    const env = readProductionEnvironment({ EPOCH_DEPLOYMENT_PROFILE: 'production' });
    expect(env.criticalIssues.length).toBe(2);
    expect(env.criticalIssues[0]).toContain('EPOCH_DATABASE_URL');
    expect(env.criticalIssues[1]).toContain('EPOCH_OBJECT_STORE');
  });

  it('production WITH durable bindings has no critical issues', () => {
    const env = readProductionEnvironment({
      EPOCH_DEPLOYMENT_PROFILE: 'production',
      EPOCH_DATABASE_URL: 'postgresql://u:p@h/db',
      EPOCH_OBJECT_STORE_ENDPOINT: 'https://a.r2.cloudflarestorage.com',
      EPOCH_OBJECT_STORE_BUCKET: 'b',
      EPOCH_OBJECT_STORE_ACCESS_KEY_ID: 'k',
      EPOCH_OBJECT_STORE_SECRET_ACCESS_KEY: 's',
    });
    expect(env.criticalIssues).toEqual([]);
  });

  it('preview degrades (no critical issues) when providers are absent', () => {
    const env = readProductionEnvironment({ EPOCH_DEPLOYMENT_PROFILE: 'preview' });
    expect(env.criticalIssues).toEqual([]);
  });

  it('REDACTION: the redacted projection carries NO secret values (by construction)', () => {
    const env = readProductionEnvironment({
      EPOCH_DATABASE_URL: 'postgresql://user:SECRET-PASSWORD@dbhost.example/db',
      EPOCH_OBJECT_STORE_ENDPOINT: 'https://a.r2.cloudflarestorage.com',
      EPOCH_OBJECT_STORE_BUCKET: 'b',
      EPOCH_OBJECT_STORE_ACCESS_KEY_ID: 'SECRET-KEY-ID',
      EPOCH_OBJECT_STORE_SECRET_ACCESS_KEY: 'SECRET-ACCESS-KEY',
      EPOCH_RATE_LIMIT_REST_URL: 'https://x.upstash.io',
      EPOCH_RATE_LIMIT_REST_TOKEN: 'SECRET-TOKEN',
      EPOCH_APIFY_TOKEN: 'SECRET-APIFY',
      EPOCH_APIFY_ACTOR_ID: 'actor',
    });
    const redacted = JSON.stringify(redactedEnvironment(env));
    expect(redacted).not.toContain('SECRET-PASSWORD');
    expect(redacted).not.toContain('SECRET-KEY-ID');
    expect(redacted).not.toContain('SECRET-ACCESS-KEY');
    expect(redacted).not.toContain('SECRET-TOKEN');
    expect(redacted).not.toContain('SECRET-APIFY');
    expect(redacted).not.toContain('dbhost.example');
    expect(JSON.parse(redacted)).toEqual({
      profile: 'development',
      database: { configured: true, kind: 'postgres' },
      objectStore: { configured: true, kind: 's3' },
      rateLimit: { configured: true, kind: 'upstash' },
      acquisition: { configured: true, kind: 'apify' },
      issues: [],
      criticalIssues: [],
    });
  });
});
