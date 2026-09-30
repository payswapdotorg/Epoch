// J11 — recovery from session/authority failures on the built app: sign
// out (the session revokes), relaunch, sign in again (the re-auth path).
const { expectVisible, launchApp, openTab, signIn } = require('./helpers');

describe('J11 recovery (session / re-authentication)', () => {
  beforeAll(async () => {
    await launchApp();
    await signIn();
  });

  it('signs out — the session revokes through the gateway', async () => {
    await openTab('tab-status');
    const signOut = await expectVisible('status-sign-out');
    await signOut.tap();
    // The onboarding surface returns (the re-authentication entry point).
    await expectVisible('onboard-screen');
  });

  it('re-authenticates (the typed re-authenticate recovery action path)', async () => {
    await signIn();
    await expectVisible('app-root');
    await expectVisible('app-session');
  });
});
