// J04 — approval subset: the Action Gateway approval flow on the built app.
// Submit a field review proposal, approve it through the gateway, and read
// the status — the ONLY approval route (the surface holds no credentials).
const { by, element, waitFor } = require('detox');
const { expectVisible, launchApp, openTab, signIn } = require('./helpers');

describe('J04 approval subset (Action Gateway)', () => {
  beforeAll(async () => {
    await launchApp();
    await signIn();
  });

  it('opens the approvals surface with the authority notice', async () => {
    await openTab('tab-approvals');
    await expectVisible('approvals-screen');
    await expectVisible('approvals-notice');
  });

  it('submits the field review proposal through the gateway', async () => {
    const submit = await expectVisible('approvals-submit-proposal');
    await submit.tap();
    // The action list now carries the submitted action (deterministic id:
    // action:field-review-1 on the first submission).
    await expectVisible('approvals-list');
    await expectVisible('action-action:field-review-1');
  });

  it('approves the pending action through action.approve ONLY', async () => {
    // The first pending action row's Approve button (deterministic id).
    const approveButton = element(by.id('approve-action:field-review-1'));
    await waitFor(approveButton).toBeVisible().withTimeout(10000);
    await approveButton.tap();
    await expectVisible('approvals-notice');
  });
});
