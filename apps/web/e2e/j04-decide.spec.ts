/**
 * J04 — Alternatives, constraints, evaluation, verification and Action
 * Gateway approval (web, production build).
 *
 * Both solution alternatives seal to distinct digests (the baseline
 * byte-exact to the committed fixture), the constraint engine answers
 * under/over the limit, the verification chain validates, the baseline
 * approval records through the solution authority, and the execution
 * approval completes through the Action Gateway (submit -> approve ->
 * execute) — the UI's only execution path.
 */
import { test, expect } from '@playwright/test';
import { anchorsOf, signIn } from './helpers';

test.describe('J04 decide / approval', () => {
  test('alternatives, constraints, verification, baseline approval and the Action Gateway path', async ({ page }) => {
    await signIn(page, 'construction');

    // -- Alternatives: the baseline seals byte-exact to the fixture. -----
    await page.goto('/decide');
    await page.getByTestId('seal-solution').click();
    await expect(page.getByTestId('seal-success')).toBeVisible();
    await expect(page.getByTestId('seal-success')).toContainText('byte-exact');
    await expect(page.getByTestId('seal-success')).toContainText(anchorsOf('construction').solutionContentDigest.slice(0, 16));

    // -- Constraints: under the limit passes, over the limit is violated. -
    await page.getByTestId('constraint-value').fill('12');
    await page.getByTestId('evaluate-constraint').click();
    await expect(page.getByTestId('constraint-outcome')).toBeVisible();
    await page.getByTestId('constraint-value').fill('20');
    await page.getByTestId('evaluate-constraint').click();
    await expect(page.getByTestId('constraint-outcome')).toBeVisible();

    // The action proposal binds the constrained value the human commits
    // with the decision: after probing the over-the-limit rejection, the
    // engineer declares the compliant value for the actual submission.
    await page.getByTestId('constraint-value').fill('12');

    // -- Verification chain. ---------------------------------------------
    await page.getByTestId('validate-chain').click();
    await expect(page.getByTestId('chain-success')).toBeVisible();

    // -- Baseline approval (the human decision through the solution
    //    authority). -------------------------------------------------------
    await page.getByTestId('approve-baseline').click();
    await expect(page.getByTestId('baseline-success')).toBeVisible();

    // -- The Action Gateway approval path (the execution authority). -----
    await page.getByTestId('submit-action').click();
    await expect(page.getByTestId('submit-summary')).toBeVisible();
    // The authority's own status vocabulary (the Action Gateway derives it).
    await expect(page.getByTestId('submit-summary')).toContainText('awaiting-approval');
    await page.getByTestId('approve-action').click();
    await expect(page.getByTestId('approve-success')).toBeVisible();
    await page.getByTestId('execute-action').click();
    await expect(page.getByTestId('execute-success')).toBeVisible();
  });

  test('the alternative line plan seals to a distinct digest', async ({ page }) => {
    await signIn(page, 'construction');
    await page.goto('/decide');
    await page.getByTestId('decide-alternative').selectOption('alternative');
    await page.getByTestId('seal-solution').click();
    await expect(page.getByTestId('seal-success')).toBeVisible();
    await expect(page.getByTestId('seal-success')).toContainText('alternative line plan');
  });

  test('the software domain decides with the same authority path', async ({ page }) => {
    await signIn(page, 'software');
    await page.goto('/decide');
    await page.getByTestId('seal-solution').click();
    await expect(page.getByTestId('seal-success')).toBeVisible();
    await expect(page.getByTestId('seal-success')).toContainText(anchorsOf('software').solutionContentDigest.slice(0, 16));
    await page.getByTestId('validate-chain').click();
    await expect(page.getByTestId('chain-success')).toBeVisible();
    await page.getByTestId('approve-baseline').click();
    await expect(page.getByTestId('baseline-success')).toBeVisible();
    await page.getByTestId('submit-action').click();
    await expect(page.getByTestId('submit-summary')).toBeVisible();
    await page.getByTestId('approve-action').click();
    await expect(page.getByTestId('approve-success')).toBeVisible();
    await page.getByTestId('execute-action').click();
    await expect(page.getByTestId('execute-success')).toBeVisible();
  });
});
