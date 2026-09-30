/**
 * @epoch/web — the browser journey helpers (W047).
 *
 * Shared E2E primitives: sign-in through the VISIBLE client (never direct
 * API calls), fixture anchor loading for digest assertions, and journey
 * record collection (evidence pointers for docs/journeys/web.md).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

export type Domain = 'construction' | 'software';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/** The committed registry anchors of one domain (journey evidence). */
export function anchorsOf(domain: Domain): {
  worldDigest: string;
  solutionContentDigest: string;
  programContentDigest: string;
  deliveryContentDigest: string;
  evidenceDigest: string;
  objectBytesDigest: string;
  fixtureId: string;
} {
  const registry = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'qa', 'fixtures', 'registry.json'), 'utf8'),
  ) as {
    domains: Array<{
      domain: Domain;
      fixtureId: string;
      worldDigest: string;
      solutionContentDigest: string;
      programContentDigest: string;
      deliveryContentDigest: string;
      evidenceDigest: string;
      objectBytesDigest: string;
    }>;
  };
  const entry = registry.domains.find((candidate) => candidate.domain === domain);
  if (entry === undefined) throw new Error(`no registry anchors for ${domain}`);
  return entry;
}

/** The delivery-lead principal of one domain. */
export function leadPrincipalOf(domain: Domain): string {
  return domain === 'construction' ? 'principal:delivery-lead' : 'principal:tech-lead';
}

/**
 * Sign in through the VISIBLE client (the entry surface): pick the
 * environment, pick the principal, pick the session duration, click.
 */
export async function signIn(
  page: Page,
  domain: Domain,
  options?: { readonly ttl?: '8h' | '1h' | '1m' },
): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('entry-domain')).toBeVisible();
  await page.getByTestId('entry-domain').selectOption(domain);
  await page.getByTestId('entry-principal').selectOption(leadPrincipalOf(domain));
  if (options?.ttl !== undefined) {
    const value = options.ttl === '8h' ? '28800000' : options.ttl === '1h' ? '3600000' : '60000';
    await page.getByTestId('entry-ttl').selectOption(value);
  }
  await page.getByTestId('sign-in').click();
  // The project + navigator surface (the J01 acceptance).
  await expect(page.getByTestId('project-summary')).toBeVisible();
  await expect(page.getByTestId('navigator-links')).toBeVisible();
}

/**
 * The full digest from a digest chip (title attribute).
 *
 * Several digest chips may render on one surface by design (the content
 * region + the status region both carry the authoritative world digest);
 * this helper resolves deterministically to the FIRST chip in DOM order.
 * Specs needing a specific chip scope their own locator instead.
 */
export async function digestTitle(page: Page, testId: string): Promise<string> {
  const title = await page.getByTestId(testId).first().getAttribute('title');
  expect(title).not.toBeNull();
  return (title ?? '').split(': ').pop() ?? '';
}

/** The active session reference from the status footer (J08 handoff). */
export async function sessionRefOf(page: Page): Promise<string> {
  const ref = await page.locator('[data-handoff-ref] code').textContent();
  expect(ref).not.toBeNull();
  return ref ?? '';
}

/** Journey step notes (collected into the record). */
export class JourneyNotes {
  private readonly entries: string[] = [];
  note(step: string, outcome: string): void {
    this.entries.push(`${step}: ${outcome}`);
  }
  render(): readonly string[] {
    return [...this.entries];
  }
}
