/**
 * J08 — Cross-device handoff (web, production build).
 *
 * Two browser contexts (two devices): the first signs in and captures the
 * session reference; the second resumes the SAME session through the
 * handoff surface — the session scope is validated by the authority, and
 * the world projection resolves to the SAME authoritative digest on both
 * devices (no second semantic ledger; the projection cache admits the
 * server projection by digest).
 */
import { test, expect } from '@playwright/test';
import { anchorsOf, digestTitle, sessionRefOf, signIn } from './helpers';

test.describe('J08 cross-device handoff', () => {
  test('the second device resumes the session and resolves the same world digest', async ({ browser }) => {
    // -- Device 1: sign in, capture the session ref + the digest. ---------
    const device1 = await browser.newContext();
    const page1 = await device1.newPage();
    await signIn(page1, 'construction');
    const sessionRef = await sessionRefOf(page1);
    expect(sessionRef).toMatch(/^session:/);
    const digest1 = await digestTitle(page1, 'digest');
    expect(digest1).toContain(anchorsOf('construction').worldDigest);

    // -- Device 2: resume the SAME session reference. ---------------------
    const device2 = await browser.newContext();
    const page2 = await device2.newPage();
    await page2.goto('/');
    await expect(page2.getByTestId('entry-domain')).toBeVisible();
    await page2.getByTestId('handoff-session').fill(sessionRef);
    await page2.getByTestId('handoff-domain').selectOption('construction');
    await page2.getByTestId('handoff-resume').click();
    await expect(page2.getByTestId('project-summary')).toBeVisible();
    await expect(page2.getByTestId('project-summary')).toContainText('tenant:nordstrand');

    // The SAME session scope on both devices.
    expect(await sessionRefOf(page2)).toBe(sessionRef);
    // The SAME authoritative world digest on both devices.
    const digest2 = await digestTitle(page2, 'digest');
    expect(digest2).toContain(anchorsOf('construction').worldDigest);
    expect(digest2).toBe(digest1);

    await device1.close();
    await device2.close();
  });
});
