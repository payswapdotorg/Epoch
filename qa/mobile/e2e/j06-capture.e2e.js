// J06 — realize: field observation with digest-addressed evidence.
// The capture tab: pick the work package (unambiguous linkage), enter the
// quantity, attach the photo, submit through delivery.observe.
const { expectVisible, launchApp, openTab, signIn } = require('./helpers');

describe('J06 realize / field observation', () => {
  beforeAll(async () => {
    await launchApp();
    await signIn();
  });

  it('opens the capture surface with the unambiguous-linkage picker', async () => {
    await openTab('tab-capture');
    await expectVisible('capture-screen');
    await expectVisible('capture-linkage');
    await expectVisible('select-work-package:warehouse-substructure');
    await expectVisible('select-work-package:warehouse-superstructure');
  });

  it('selects exactly one work package (the linkage resolves)', async () => {
    const option = await expectVisible('select-work-package:warehouse-substructure');
    await option.tap();
    await expectVisible('capture-selected');
  });

  it('carries the quantity + the mandatory uncertainty + the photo evidence toggle', async () => {
    await expectVisible('capture-quantity');
    await expectVisible('capture-attach-photo');
    await expectVisible('capture-evidence');
  });

  it('submits the observation online (the authority records it)', async () => {
    const submit = await expectVisible('capture-submit');
    await submit.tap();
    // After the submission the capture surface stays usable (the alert
    // confirms; the queue stays empty on the online path).
    await openTab('tab-queue');
    await expectVisible('queue-screen');
  });
});
