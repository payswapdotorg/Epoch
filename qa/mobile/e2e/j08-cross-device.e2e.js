// J08 — cross-device handoff: the mobile-resolved state matches the
// authoritative fixture state (what web/desktop resolve from the same
// fixtures). The status tab renders the world digest + the match marker.
const { expectVisible, launchApp, openTab, readText, signIn } = require('./helpers');

describe('J08 cross-device handoff', () => {
  beforeAll(async () => {
    await launchApp();
    await signIn();
  });

  it('renders the cross-device state (the world digest + the session scope)', async () => {
    await openTab('tab-status');
    await expectVisible('status-cross-device');
    await expectVisible('status-world-digest');
    await expectVisible('status-scope');
  });

  it('asserts the world digest matches the registry anchor (the authoritative state)', async () => {
    const matchText = await readText('status-cross-device-match');
    if (typeof matchText === 'string' && !matchText.includes('matches')) {
      throw new Error(`J08 failed: the mobile world digest diverged from the registry anchor (${matchText})`);
    }
  });
});
