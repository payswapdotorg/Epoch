// J09 — agent supervision / intervention (field subset): the supervisor
// reads the supervision pass + the pending actions and intervenes through
// the approval surface.
const { expectVisible, launchApp, openTab, signIn } = require('./helpers');

describe('J09 agent supervision / intervention (field subset)', () => {
  beforeAll(async () => {
    await launchApp();
    await signIn();
  });

  it('the supervision pass renders over the fixture program + delivery', async () => {
    await openTab('tab-status');
    await expectVisible('status-supervision');
    await expectVisible('status-supervision-state');
  });

  it('the pending actions project for intervention (action.status)', async () => {
    await openTab('tab-approvals');
    await expectVisible('approvals-list');
    await expectVisible('approvals-notice');
  });
});
