// W048 — the frozen Application Gateway operation allowlist (Rust mirror).
//
// Defense in depth for the named negative (a): the webview bridge refuses
// unlisted operations in TypeScript (src/native/ipc/surface.ts), and this
// crate refuses to FORWARD anything but the 32 frozen operation names —
// the exact `APPLICATION_GATEWAY_OPERATION_NAMES` vocabulary pinned by
// @epoch/client-runtime (test/native-ipc-surface.test.ts pins the
// TypeScript side; this array mirrors it verbatim and is pinned by the
// config-surface test reading this file's source text).

/// The frozen 32-operation Application Gateway vocabulary (v1 contract).
/// THE ONLY operations `epoch_gateway_call` will forward.
pub const GATEWAY_OPERATIONS: [&str; 32] = [
    // identity/session.
    "session.issue",
    "session.validate",
    "session.revoke",
    // tenant/workspace/project context.
    "context.resolve",
    // world read projections.
    "world.snapshot",
    "world.entities",
    // evidence.
    "evidence.intake",
    "evidence.get",
    // agents / capability discovery.
    "discovery.run",
    // actions (the Action Gateway authority).
    "action.submit",
    "action.approve",
    "action.execute",
    "action.status",
    // constraints.
    "constraints.evaluate",
    // verification.
    "verification.validateChain",
    // solutions.
    "solution.sealVersion",
    "solution.approveBaseline",
    // program of work / domain schedule / BOQ.
    "program.build",
    "program.schedule",
    // delivery.
    "delivery.open",
    "delivery.observe",
    "delivery.close",
    // acquisition / procurement.
    "procurement.quote",
    "procurement.order",
    // actualization / forecast / outcome.
    "actualization.forecast",
    "outcome.learn",
    // authorized projections.
    "access.project",
    // supervision / alerts.
    "supervision.check",
    "alerts.raise",
    // marketplace / developer.
    "marketplace.entitlement",
    // events (READ only).
    "events.read",
    // recovery.
    "recovery.replay",
];

/// True when an operation is on the frozen forwarding surface.
pub fn is_gateway_operation(name: &str) -> bool {
    GATEWAY_OPERATIONS.contains(&name)
}
