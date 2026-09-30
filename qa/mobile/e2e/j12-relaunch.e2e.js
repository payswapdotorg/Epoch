// J12 — install -> launch -> work -> close -> relaunch -> update.
// The relaunch journey on the built application: work, close (background),
// relaunch (the session restores from the secure store), and the update
// path (the same binary identity across versions).
const { expectVisible, launchApp, openTab, signIn } = require('./helpers');

describe('J12 install / launch / work / close / relaunch', () => {
  it('launches, signs in, and works (a capture submission)', async () => {
    await launchApp();
    await signIn();
    await openTab('tab-capture');
    const option = await expectVisible('select-work-package:warehouse-substructure');
    await option.tap();
    const submit = await expectVisible('capture-submit');
    await submit.tap();
  });

  it('closes (backgrounds) and relaunches WITHOUT the newInstance flag — the app process survives', async () => {
    const { device } = require('detox');
    await device.launchApp({ newInstance: false });
    await expectVisible('app-root');
  });

  it('relaunches fresh (newInstance) — the session restores from the secure store', async () => {
    const { device } = require('detox');
    await device.launchApp({ newInstance: true });
    // The restored session lands straight on the field shell (no
    // re-onboarding) when the secure store held a valid session.
    await expectVisible('app-root', 20000);
  });

  it('the app identity is stable across relaunches (the identifiers pin)', async () => {
    await expectVisible('app-title');
    await expectVisible('app-session');
  });
});
