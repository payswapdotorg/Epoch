#!/usr/bin/env node
// W048 — the native toolchain audit (the honest environment record).
//
// Checks every prerequisite the per-OS packaging matrix needs on THIS
// machine and prints a machine-readable verdict. This script never fails
// the build: a missing toolchain is an ENVIRONMENT GAP, recorded in
// docs/journeys/desktop-*.md and the completion report — never a silent
// claim that a packaged binary ran.
//
// Linux native packaging needs: cargo + rustc (1.77+), webkit2gtk-4.1,
// libayatana-appindicator (tray), plus `appimagetool`/`linuxdeploy` for
// AppImage bundling (tauri-cli fetches these on demand). Windows NSIS and
// macOS DMG builds need their own OS + toolchains (cross-compiling a
// wry/webkit shell is not supported; the configs target native runners).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function commandVersion(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error !== undefined || result.status !== 0) return null;
  return result.stdout.trim().split('\n')[0] ?? null;
}

function pkgConfigCheck(module) {
  const result = spawnSync('pkg-config', ['--exists', module]);
  if (result.error !== undefined || result.status !== 0) return false;
  const version = spawnSync('pkg-config', ['--modversion', module], { encoding: 'utf8' });
  return version.status === 0 ? version.stdout.trim() : true;
}

const checks = {
  node: commandVersion('node'),
  pnpm: commandVersion('pnpm'),
  cargo: commandVersion('cargo'),
  rustc: commandVersion('rustc'),
  'webkit2gtk-4.1': pkgConfigCheck('webkit2gtk-4.1') || null,
  'libayatana-appindicator3-1': existsSync('/usr/lib/x86_64-linux-gnu/libayatana-appindicator3.so.1')
    || existsSync('/usr/lib/x86_64-linux-gnu/libayatana-appindicator3.so')
    || null,
};

console.log('[toolchain-audit] W048 native packaging prerequisites on this machine:');
for (const [name, value] of Object.entries(checks)) {
  console.log(`  ${value === null ? '✗' : '✓'} ${name}: ${value ?? 'ABSENT'}`);
}

const linuxNativeReady = checks.cargo !== null && checks.rustc !== null && checks['webkit2gtk-4.1'] !== null;
console.log('');
console.log(`[toolchain-audit] linux native build (AppImage/deb): ${linuxNativeReady ? 'READY' : 'NOT AVAILABLE (environment gap — config-level delivery, recorded honestly)'}`);
console.log('[toolchain-audit] windows NSIS + macOS DMG: cross-OS targets (configs committed; build requires the target OS runner)');
if (!linuxNativeReady) {
  console.log('[toolchain-audit] gap detail: cargo/rustc/webkit2gtk-4.1 unavailable in this environment — the src-tauri configuration, command surface and packaging matrix are delivered config-complete and validated structurally (see qa/desktop + docs/journeys/desktop-linux.md)');
}
process.exit(0);
