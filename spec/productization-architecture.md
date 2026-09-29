# Epoch Productization Architecture

## Product
One Epoch product, three client families:
- Web — canonical.
- Desktop — Tauri 2 power client.
- Mobile — Expo/React Native field client.

Lifecycle remains Understand -> Decide -> Plan -> Acquire -> Realize -> Observe/Actualize -> Verify -> Forecast -> Close -> Learn.

## Topology
```
Epoch authoritative services
        |
Application Gateway
        |
 +------+------+------+
 |             |      |
Web         Desktop  Mobile
Next.js     Tauri2   Expo/RN
 |             |      |
 +------- shared client contracts ---+
                |
     PostgreSQL / object bytes
```

The Application Gateway composes existing authorities; it is not a new semantic authority.

## Shared client capabilities
Identity/session, tenant/workspace/project context, world/evidence, agents/capability discovery, constraints, solutions/approval, Program of Work/domain schedule/BOQ, acquisition/delivery, realization/observation, verification, actualization/forecast, outcomes, marketplace/developer, notifications and recovery.

Every operation maps to an existing Epoch authority.

## Persistence
PostgreSQL = authoritative durable state.
Object storage = evidence/assets/bytes.
Client cache/queue = content-addressed projection/replay state only.

No platform may create a competing semantic database.

## Desktop
Tauri 2 host around W017. Native concerns: windows, filesystem pickers, safe credential storage, notifications, offline/session cache, updates, packaging.

Targets: Linux AppImage + Debian-family package; Windows installer; macOS DMG/app bundle suitable for signing/notarization.

## Mobile
Expo + React Native host around W018. Native concerns: camera/evidence capture, offline queue, reconnect/sync, secure credential storage, notifications.

Targets: Android APK/AAB; iOS simulator/device build and TestFlight-ready production configuration.

## Web
Continue the existing canonical Next.js/React application. Productize lifecycle navigation, World View, agents/capability discovery, Solution Navigator, delivery/domain projections, marketplace/developer surfaces, and recovery states.

## Release identity
Every artifact records source commit, version/profile, target platform and checksum.

## Cross-device continuity
A user can inspect the same project across web/desktop/mobile, capture on mobile and inspect on web/desktop, and approve where permitted. The authoritative state is always resolved through Epoch.

## Forbidden drift
No client-owned lifecycle, no UI authority, no direct durable mutation, no provider/model semantics in kernel contracts, no Action Gateway bypass, no platform-specific semantic fork.
