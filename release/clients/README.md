# release/clients — the client release identity records (W050)

The typed release-identity record set for the six client platforms of
the ACR-005 productization program. This is the `release/clients/*`
owned surface of W050 (spec/work-items.md) implementing the release
identity rule of `spec/productization-architecture.md`:

> Every artifact records source commit, version/profile, target platform
> and checksum.

## The manifest

`release-manifest.json` carries one record per platform:

| Platform | Artifact | Build status |
| --- | --- | --- |
| `web` | Next.js production build (`next build` → `next start`) | **built-in-sandbox** — the CI battery builds it at every push/PR; the W047 journey battery ran the production build through J01-J12 |
| `desktop-linux` | Tauri 2 AppImage + deb | config-delivered — no cargo/webkit2gtk in this sandbox (declared gap) |
| `desktop-windows` | Tauri 2 NSIS installer | config-delivered — no Windows/MSVC host (declared gap) |
| `desktop-macos` | Tauri 2 DMG + app bundle | config-delivered — no macOS/Xcode host (declared gap) |
| `mobile-android` | Expo Android release build (APK/AAB) | config-delivered — no Android SDK in this sandbox (declared gap) |
| `mobile-ios` | Expo iOS release build (TestFlight-ready) | config-delivered — no Xcode in this sandbox (declared gap) |

Each record binds the artifact identity with verifiable data:

- `sourceCommit` — the exact commit the artifact definitions ship at;
- `version` / `profile` — the product version and production profile;
- `artifact.definitionFiles` — the committed files that define the
  artifact (the packaging/build configuration of that platform);
- `artifact.checksums` — the sha256 of every definition file (recomputes
  over any checkout — the binding evidence);
- `artifact.definitionTreeSha` — the git tree SHA of the platform's app
  tree at the source commit (`git rev-parse <commit>:apps/<app>` — the
  content-addressed identity of the whole client tree);
- `buildStatus` — the honest build record: actually built here/in CI, or
  config-delivered with the environment gap declared, never silent (the
  W048/W049 sandbox-honesty doctrine);
- `journeys` — the platform's journey record under `docs/journeys/`.

## Regenerating

The manifest is a pure function of the tree at the source commit
(deterministic — re-running at the same commit is byte-identical):

```bash
python3 release/clients/generate-manifest.py <commit> --out release/clients/release-manifest.json
```

## Verification

`qa/cross-platform/cross-platform.test.ts` (X-06) validates the record
set on every battery run: six-platform coverage, precise 40-hex source
commit, checksums that recompute over the working tree, git tree
identities (when the commit is present), and non-null environment gaps
on every config-delivered platform.

This tree is DATA + its generator — the typed release-readiness MODEL of
the kernel program remains `release/` (W035); nothing here contacts a
distribution channel or executes a build.
