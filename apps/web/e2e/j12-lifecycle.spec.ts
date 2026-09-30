/**
 * J12 — Install -> launch -> work -> close -> relaunch -> update
 * (web SMOKE, production build).
 *
 * Web install = the production build; launch = `next start` on a private
 * port; work = a real journey action; close = the server process stops;
 * relaunch = a fresh server process; update = a REBUILD then relaunch.
 * The authoritative fixture state (world digest) resolves identically
 * across every phase — reload/relaunch always resolves authoritative
 * state.
 */
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { anchorsOf, digestTitle, signIn } from './helpers';

const PORT = 3101;
const APP_DIR = process.cwd();

function launch(): Promise<ChildProcess> {
  // Pre-flight: a leftover server from an aborted prior run would silently
  // absorb this run's traffic (its build assets may no longer exist on
  // disk) — fail LOUDLY instead of debugging a hydrated-nowhere page.
  return fetch(`http://localhost:${PORT}/`)
    .then((response) => {
      if (response.ok) {
        throw new Error(
          `port ${PORT} already serves a server (a leftover from an aborted run?) — stop it before relaunching`,
        );
      }
    })
    .catch((error) => {
      if (error instanceof TypeError) return; // connection refused: port free
      throw error;
    })
    .then(() => spawnServer());
}

function spawnServer(): Promise<ChildProcess> {
  // detached: the server tree (npx -> sh -> next-server) gets its OWN
  // process group so stop() can reap every member (killing only the npx
  // wrapper orphans the next-server child — a zombie that keeps the port
  // bound and serves a build whose assets a rebuild deleted).
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: APP_DIR,
    stdio: 'ignore',
    detached: true,
  });
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const probe = setInterval(() => {
      fetch(`http://localhost:${PORT}/`)
        .then((response) => {
          if (response.ok) {
            clearInterval(probe);
            resolve(server);
          } else if (Date.now() - started > 60_000) {
            clearInterval(probe);
            killGroup(server);
            reject(new Error('server did not become ready'));
          }
        })
        .catch(() => {
          if (Date.now() - started > 60_000) {
            clearInterval(probe);
            killGroup(server);
            reject(new Error('server did not become ready'));
          }
        });
    }, 500);
  });
}

function killGroup(server: ChildProcess): void {
  try {
    process.kill(-server.pid!, 'SIGTERM');
  } catch {
    // already gone
  }
}

function stop(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    killGroup(server);
    server.once('exit', done);
    setTimeout(() => {
      // Escalate: the group must die before the next phase binds the port.
      try {
        process.kill(-server.pid!, 'SIGKILL');
      } catch {
        // already gone
      }
      setTimeout(done, 1_000);
    }, 3_000);
  });
}

test.describe('J12 install / launch / work / close / relaunch / update (smoke)', () => {
  test('the product lifecycle survives close, relaunch and update with identical authoritative state', async ({ browser }) => {
    // Every launched server is reaped in the finally block: a mid-test
    // failure must never leak a bound port (the next run's launch would
    // silently hit the zombie instead of the fresh artifact).
    const servers: ChildProcess[] = [];
    try {
      // -- Launch (the production build artifact). ------------------------
      const server1 = await launch();
      servers.push(server1);
      const context1 = await browser.newContext({ baseURL: `http://localhost:${PORT}` });
      const page1 = await context1.newPage();

      // -- Work: sign in + a real journey action. -------------------------
      await signIn(page1, 'construction');
      await page1.goto('/understand');
      // The Understand surface renders several digest chips by design (the
      // world chip + the fixture evidence chip + the footer anchor); the
      // world chip only appears once world.snapshot resolves — wait for the
      // anchor-match pill BEFORE reading a digest (the chip's DOM position
      // is then unambiguous).
      await expect(page1.getByTestId('world-digest-match')).toBeVisible();
      const digest1 = await digestTitle(page1, 'digest');
      expect(digest1).toContain(anchorsOf('construction').worldDigest);
      await page1.getByTestId('evidence-note').fill('J12 launch-phase evidence');
      await page1.getByTestId('capture-evidence').click();
      await expect(page1.getByTestId('intake-success')).toBeVisible();
      await context1.close();

      // -- Close: the server process stops. -------------------------------
      await stop(server1);

      // -- Relaunch: a fresh process resolves the SAME authoritative state.
      const server2 = await launch();
      servers.push(server2);
      const context2 = await browser.newContext({ baseURL: `http://localhost:${PORT}` });
      const page2 = await context2.newPage();
      await signIn(page2, 'construction');
      const digest2 = await digestTitle(page2, 'digest');
      expect(digest2).toContain(anchorsOf('construction').worldDigest);
      expect(digest2).toBe(digest1);
      await context2.close();

      // -- Update: a rebuild + relaunch (the new artifact). ----------------
      await stop(server2);
      await new Promise<void>((resolve, reject) => {
        const build = spawn('npx', ['next', 'build'], { cwd: APP_DIR, stdio: 'ignore' });
        build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`rebuild failed: ${code}`))));
      });
      const server3 = await launch();
      servers.push(server3);
      const context3 = await browser.newContext({ baseURL: `http://localhost:${PORT}` });
      const page3 = await context3.newPage();
      await signIn(page3, 'construction');
      const digest3 = await digestTitle(page3, 'digest');
      expect(digest3).toContain(anchorsOf('construction').worldDigest);
      expect(digest3).toBe(digest1);
      await context3.close();
      await stop(server3);
    } finally {
      for (const server of servers) {
        await stop(server);
      }
    }
  });
});
