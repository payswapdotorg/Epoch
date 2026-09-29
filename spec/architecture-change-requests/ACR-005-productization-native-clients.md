# ACR-005 — Productization, Native Clients & Journey Validation

## Status
EFFECTIVE — approved 2026-09-29.

## Intent
Turn the completed Epoch semantic/kernel program and typed reference clients into one usable product that can be launched on the web, installed on Linux/Windows/macOS, installed on Android/iOS, and used through representative end-to-end engineering journeys.

This adds no semantic authority. It productizes existing authorities through a shared client runtime, persistence/transport adapters, real client hosts, release artifacts, and mandatory journey validation.

## Architecture
- Web = canonical experience.
- Desktop = power client for Linux/Windows/macOS.
- Mobile = field client for Android/iOS.
- All clients share semantic contracts and Experience Protocol.
- Local caches/queues are session/projection/replay state only.
- World/Solution/Delivery/Verification/Learning authority remains in Epoch's existing kernel/services.

## Platform choices
Web continues the existing Next.js/React application.
Desktop uses Tauri 2 around the W017 typed desktop shell.
Mobile uses Expo + React Native around the W018 typed mobile shell.

Platform tooling is replaceable implementation detail and must not enter Epoch semantic contracts.

## Shared runtime
Client -> Application Gateway -> existing authoritative Epoch services/contracts -> authoritative state -> projection.

PostgreSQL is the durable authority; object storage holds bytes/evidence/assets by reference/digest. Existing event/workflow infrastructure stays behind provider-neutral seams.

## Product acceptance
Client source tests are necessary but insufficient. W047-W049 must build/run the actual product surface, execute the required journeys, record defects, fix P0/P1/P2 issues within scope, add regression evidence, and rerun. W050 performs final cross-platform validation and release closure.

## Security and authority
UI/native code never grants authorization. Actions always pass through the Action Gateway. External artifacts remain sandboxed. No client may become a second semantic ledger.

## Work orders
W046 Shared Product Runtime + Application Gateway.
W047 Web Product + Browser Journey Validation.
W048 Desktop Native Product + Desktop Journey Validation.
W049 Mobile Native Product + Mobile Journey Validation.
W050 Cross-Platform Release + Journey Closure.

No semantic subsystem outside this map is authorized by ACR-005.
