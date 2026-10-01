// W048 — the packaged-Tauri-app journey spec (WebdriverIO + tauri-driver).
//
// Runs against the REAL packaged binary's webview (see
// wdio.desktop.conf.ts for the build + run protocol). Asserts the same
// visible-UI journeys the dev-server web E2E asserts: J01 onboarding +
// project entry (the registry-verified world digest), J02 world
// inspection, and J07 offline enqueue/reconnect/drain.
//
// This spec executes ONLY on a provisioned machine (tauri-driver + the
// built binary); it is delivered config-complete and recorded honestly in
// docs/journeys/desktop-*.md when the toolchain is absent.
describe('the packaged Epoch desktop application (W048 journeys)', () => {
  it('J01 — launches, onboards and enters the project with the registry-verified digest', async () => {
    // The packaged webview loads the static export; the product composes
    // over the embedded fixture-backed gateway.
    await $('header[aria-label="Session bar"], header').waitForDisplayed({ timeout: 60_000 });
    const authenticate = await $('button=Authenticate');
    await authenticate.waitForDisplayed({ timeout: 60_000 });
    await authenticate.click();
    await browser.waitUntil(
      async () => (await browser.getUrl()) !== undefined && (await $$('*[aria-label="Session state"]')).length > 0,
      { timeout: 60_000 },
    );
    const sessionState = await $('*[aria-label="Session state"]');
    await sessionState.waitForDisplayed({ timeout: 60_000 });
    const stateText = await sessionState.getText();
    if (!stateText.includes('active')) {
      throw new Error(`the session did not activate after authentication (state bar: ${stateText})`);
    }

    const enter = await $('button=Enter project');
    await enter.waitForDisplayed({ timeout: 30_000 });
    await enter.click();
    await browser.waitUntil(
      async () => (await $$('*=world digest matches the fixture registry')).length > 0,
      { timeout: 60_000 },
    );
  });

  it('J02 — inspects the world entities', async () => {
    const understand = await $('nav[aria-label="Journey sections"] button*=Understand');
    await understand.waitForDisplayed({ timeout: 30_000 });
    await understand.click();
    const inspect = await $('button=Inspect world');
    await inspect.waitForDisplayed({ timeout: 30_000 });
    await inspect.click();
    await browser.waitUntil(
      async () => (await $$('h3*=World entities')).length > 0,
      { timeout: 60_000 },
    );
  });

  it('J07 — goes offline, enqueues, reconnects and drains', async () => {
    const offline = await $('nav[aria-label="Journey sections"] button*=Offline');
    await offline.waitForDisplayed({ timeout: 30_000 });
    await offline.click();
    const goOffline = await $('button=Go offline');
    await goOffline.waitForDisplayed({ timeout: 30_000 });
    await goOffline.click();
    const enqueue = await $('button=Enqueue sample observation');
    await enqueue.waitForDisplayed({ timeout: 30_000 });
    await enqueue.click();
    await browser.waitUntil(
      async () => (await $$('*=pending')).length > 0,
      { timeout: 30_000 },
    );
    const goOnline = await $('button=Go online');
    await goOnline.waitForDisplayed({ timeout: 30_000 });
    await goOnline.click();
    const drain = await $('button=Drain queue');
    await drain.waitForDisplayed({ timeout: 30_000 });
    await drain.click();
    await browser.waitUntil(
      async () => (await $$('*=No pending intents')).length > 0,
      { timeout: 60_000 },
    );
  });
});
