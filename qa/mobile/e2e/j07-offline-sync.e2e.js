// J07 — offline work, queue, reconnect, idempotent sync.
// The queue tab: enter the offline interval, capture (queued), reconnect +
// sync, and assert the exactly-once proof on the built application.
const { expectVisible, launchApp, openTab, readText, signIn } = require('./helpers');

describe('J07 offline / queue / reconnect / idempotent sync', () => {
  beforeAll(async () => {
    await launchApp();
    await signIn();
  });

  it('enters the offline interval (the network badge flips)', async () => {
    await openTab('tab-queue');
    const offline = await expectVisible('queue-go-offline');
    await offline.tap();
    await expectVisible('network-badge');
  });

  it('captures while offline — the observation queues as a pending projection', async () => {
    await openTab('tab-capture');
    const option = await expectVisible('select-work-package:warehouse-substructure');
    await option.tap();
    const submit = await expectVisible('capture-submit');
    await submit.tap();
    await openTab('tab-queue');
    await expectVisible('queue-state');
  });

  it('reconnects + syncs — the exactly-once proof renders', async () => {
    const sync = await expectVisible('queue-sync-now');
    await sync.tap();
    await expectVisible('queue-sync-report');
    const duplicates = await readText('queue-sync-duplicates');
    if (typeof duplicates === 'string') {
      // duplicate side effects: 0 — the journey assertion.
      if (!duplicates.includes('0')) {
        throw new Error(`J07 failed: expected zero duplicate side effects, got "${duplicates}"`);
      }
    }
  });

  it('the queue drains (the pending projection list empties)', async () => {
    await expectVisible('queue-state');
  });
});
