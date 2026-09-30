// The shared detox spec helpers: the app launch + the journey harness
// conventions. Every spec imports these so the testIDs stay in ONE place.
const { by, element, waitFor } = require('detox');

/** Launch the app (fresh or relaunching with the given args). */
async function launchApp(launchArgs = {}) {
  const { device } = require('detox');
  await device.launchApp({ newInstance: true, launchArgs });
}

/** Sign in through the onboarding surface (J01). */
async function signIn() {
  const signInButton = element(by.id('onboard-sign-in'));
  await waitFor(signInButton).toBeVisible().withTimeout(15000);
  await signInButton.tap();
  const root = element(by.id('app-root'));
  await waitFor(root).toBeVisible().withTimeout(15000);
}

/** Navigate to one field tab. */
async function openTab(tabId) {
  const tab = element(by.id(tabId));
  await waitFor(tab).toBeVisible().withTimeout(10000);
  await tab.tap();
}

/** Wait for a visible element by testID (the standard expectation helper). */
async function expectVisible(testId, timeout = 15000) {
  const target = element(by.id(testId));
  await waitFor(target).toBeVisible().withTimeout(timeout);
  return target;
}

/** Read the text of an element by testID (detox matchers expose text via the element tree). */
async function readText(testId) {
  const target = element(by.id(testId));
  await waitFor(target).toBeVisible().withTimeout(10000);
  const attributes = await target.getAttributes();
  if (attributes && typeof attributes.text === 'string') {
    return attributes.text;
  }
  if (attributes && Array.isArray(attributes.elements)) {
    const text = attributes.elements.map((entry) => entry.text || '').join(' ');
    return text.trim();
  }
  return '';
}

module.exports = { by, element, waitFor, launchApp, signIn, openTab, expectVisible, readText };
