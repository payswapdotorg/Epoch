// J01 — onboarding / project entry (Android + iOS built applications).
// The field principal signs in: the session issues through the gateway,
// persists in the secure store, and the field shell renders.
const { openTab, expectVisible, launchApp, signIn } = require('./helpers');

describe('J01 onboarding / project entry', () => {
  beforeAll(async () => {
    await launchApp();
  });

  it('shows the onboarding surface with the honest boot mode', async () => {
    await expectVisible('onboard-screen');
    await expectVisible('onboard-sign-in');
    await expectVisible('onboard-transport');
  });

  it('signs in and lands on the field shell with the session header', async () => {
    await signIn();
    await expectVisible('app-root');
    await expectVisible('app-title');
    await expectVisible('app-session');
    await expectVisible('network-badge');
  });

  it('the project tab resolves the context and the world digest', async () => {
    await openTab('tab-project');
    await expectVisible('project-screen');
    await expectVisible('project-context');
    await expectVisible('project-world-digest');
    await expectVisible('project-work-packages');
  });
});
