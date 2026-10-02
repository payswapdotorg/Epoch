# The Client Release Process (W050)

How a client release of the Epoch product is identified, validated and
recorded. This is the client-side companion of the typed kernel release
model ([`release-process.md`](./release-process.md) — W035): the kernel
model governs release READINESS as typed data; this process governs the
IDENTITY of the shipped client artifacts
(`spec/productization-architecture.md` — "Every artifact records source
commit, version/profile, target platform and checksum").

## The release identity record set

`release/clients/release-manifest.json` carries one record per platform
(web, desktop-linux, desktop-windows, desktop-macos, mobile-android,
mobile-ios). Each record binds:

1. **The source commit** — the exact 40-hex SHA the artifact
   definitions ship at (never a branch name, never "latest").
2. **The version + profile** — the product version and the production
   profile.
3. **The artifact definition** — the committed files that define the
   artifact, each with its sha256 (`checksums`), plus the git tree SHA
   of the platform's app tree (`definitionTreeSha` =
   `git rev-parse <commit>:apps/<app>` — the content-addressed identity
   of the whole client tree).
4. **The honest build status** — `built-in-sandbox` (the artifact was
   actually built and validated: web, via the CI battery + the W047
   journey battery) or `config-delivered` (the packaging definition is
   complete but the toolchain is absent from the sandbox — the
   environment gap is DECLARED in the record, never hidden; the
   W048/W049 sandbox-honesty doctrine).
5. **The journey record** — the per-platform evidence under
   `docs/journeys/`.

## Cutting a client release

1. Land the client trees (the standard battery: governance / boundary /
   typecheck / lint / test / build — the cross-platform harness
   `qa/cross-platform` rides the apps/web battery and MUST be green).
2. Freeze the definition commit `H` (the commit carrying the artifact
   definitions the release ships).
3. Generate the manifest deterministically:

   ```bash
   python3 release/clients/generate-manifest.py H --out release/clients/release-manifest.json
   ```

4. Commit the manifest. The record's `sourceCommit` is `H` — the
   manifest commit cites its own definition baseline (the
   two-commit stamp: definitions at `H`, the stamped record set on top).
5. Verify: the X-06 check of the cross-platform battery re-validates
   the record set on every run (six platforms, precise SHAs, checksums
   recomputed over the working tree, git tree identities).

## Building the artifacts

- **web** — `pnpm build` in `apps/web` (the Next.js production build);
  the journey battery runs it through J01-J12 (`docs/journeys/web.md`).
- **desktop** — `pnpm tauri:build:linux|windows|macos` in `apps/desktop`
  (requires the Rust toolchain + platform webview dependencies; the
  runbook is `qa/desktop/wdio.desktop.conf.ts` and the honest toolchain
  audit is recorded in `docs/journeys/desktop-linux.md`).
- **mobile** — `eas build --platform android|ios` with the committed
  production profiles (`apps/mobile/eas.json`; the detox E2E harness is
   `qa/mobile/`).

Platforms whose packaging toolchains are absent from the executing
environment ship `config-delivered` with the gap declared — the record
never claims a build that did not happen.

## What this process deliberately does NOT do

Nothing in `release/clients/` contacts a distribution channel, signs a
binary or executes a build — the record set is DATA. The typed
readiness MODEL of the kernel program remains `release/` (W035), and
the deployment authority remains the W033 model; this process binds
client artifact identity only.

---

## W063 — the desktop installable-artifact stamp

The W050 process above remains binding. W063 re-stamps the desktop records with the REAL
artifacts. The per-platform recipes:

- **Linux** (built-in-sandbox): rustup stable + the 300-deb user-space prefix (the recipe is
  recorded verbatim in `docs/journeys/desktop-linux.md`); the deb via the tauri-bundler internal
  path; the AppImage via linuxdeploy with the W063 never-fatal gtk module installer + the custom
  AppRun hook wrapper. The AppImage bundles the full stack EXCEPT the webkit pair (the
  process/library coherence contract; the deb's Depends is the same contract).
- **Windows** (built-in-sandbox-cross): mingw-w64 gnu (gcc 14-win32); every build-local deviation
  enumerated in the manifest + `docs/journeys/desktop-windows.md`; the makensis bridge recorded
  there; UNSIGNED honestly. The CANONICAL msvc recipe: the windows-latest job of
  `.github/workflows/release-desktop-native.yml`.
- **macOS** (ci-recipe-delivered): the macos-14 job of the same workflow; Linux cannot produce a
  DMG (hard platform boundary).

Regeneration: `python3 release/clients/generate-manifest.py <head> --out release/clients/release-manifest.json`.
The two-commit stamp (definitions H1, then the manifest regenerated at H1) remains the W050 rule.
