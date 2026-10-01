// W048 — the remote-gateway forwarder (`epoch_gateway_call`).
//
// Remote mode: the serialized GatewayRequestEnvelope crosses the Tauri IPC
// seam and this forwarder POSTs it to the configured HTTPS endpoint. Two
// gates run BEFORE any network I/O:
//
//   1. the frozen 32-operation allowlist (operations.rs — the named
//      negative (a), enforced on BOTH sides of the seam);
//   2. the endpoint configuration (`epoch-gateway.json` in the app-data
//      dir; absent => the typed connector-unavailable error, never a
//      silent fallback).
//
// Every failure returns the SERIALIZED GatewayCallResult contract the
// TypeScript transport parses (`{ ok: false, error: GatewayError }`), so
// the webview maps it through the same typed taxonomy as the gateway's
// own errors — never a bare Rust panic, never a silent open.
use crate::operations::is_gateway_operation;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Duration;

/// The typed serialized GatewayCallResult this forwarder always answers with.
pub type ForwardedResult = Value;

pub struct GatewayForwarder {
    config_path: PathBuf,
}

/// One parsed request envelope (the fields the forwarder gates on).
struct RequestGate {
    operation: String,
    correlation_id: String,
}

impl GatewayForwarder {
    pub fn new(data_dir: &Path) -> Self {
        Self { config_path: data_dir.join("epoch-gateway.json") }
    }

    /// Forward one request envelope, or answer with the typed error.
    pub fn call(&self, request: &Value) -> ForwardedResult {
        let gate = match read_gate(request) {
            Some(gate) => gate,
            None => return malformed_request(),
        };
        // Gate 1: the frozen vocabulary (defense in depth).
        if !is_gateway_operation(gate.operation.as_str()) {
            return typed_error(
                "validation",
                "operation-unknown",
                &format!(
                    "the native host refuses to forward operation \"{}\" — only the frozen 32-operation Application Gateway vocabulary crosses this seam (named negative a)",
                    gate.operation
                ),
                &gate.operation,
                &gate.correlation_id,
                false,
            );
        }
        // Gate 2: the endpoint configuration.
        let endpoint = match self.endpoint() {
            Some(endpoint) => endpoint,
            None => {
                return typed_error(
                    "transient",
                    "connector-unavailable",
                    "no remote gateway endpoint is configured (epoch-gateway.json in the app-data dir) — configure a deployed gateway or use the embedded mode",
                    &gate.operation,
                    &gate.correlation_id,
                    true,
                )
            }
        };

        let client = match reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
        {
            Ok(client) => client,
            Err(error) => {
                return typed_error(
                    "transient",
                    "connector-unavailable",
                    &format!("the gateway HTTP client could not start ({error})"),
                    &gate.operation,
                    &gate.correlation_id,
                    true,
                )
            }
        };
        match client.post(&endpoint).json(request).send() {
            Ok(response) => {
                let status = response.status();
                match response.json::<Value>() {
                    Ok(body) => {
                        // The endpoint answers with the serialized
                        // GatewayCallResult contract — pass it through
                        // verbatim (ok outcome envelope or typed error).
                        if is_call_result(&body) {
                            body
                        } else {
                            typed_error(
                                "unrecoverable",
                                "response-malformed",
                                &format!(
                                    "the gateway endpoint answered {} with a non-contract body (expected the serialized GatewayCallResult)",
                                    status
                                ),
                                &gate.operation,
                                &gate.correlation_id,
                                false,
                            )
                        }
                    }
                    Err(error) => typed_error(
                        "unrecoverable",
                        "response-malformed",
                        &format!("the gateway endpoint answer was not valid JSON ({error})"),
                        &gate.operation,
                        &gate.correlation_id,
                        false,
                    ),
                }
            }
            Err(error) => typed_error(
                "transient",
                "network-unavailable",
                &format!("the remote gateway is unreachable ({error})"),
                &gate.operation,
                &gate.correlation_id,
                true,
            ),
        }
    }

    /// The configured endpoint (None when unconfigured/unreadable).
    fn endpoint(&self) -> Option<String> {
        let text = std::fs::read_to_string(&self.config_path).ok()?;
        let config = serde_json::from_str::<Value>(text.as_str()).ok()?;
        let endpoint = config.get("endpoint")?.as_str()?;
        if endpoint.starts_with("https://") {
            Some(endpoint.to_string())
        } else {
            None
        }
    }
}

/// Read the gate fields off the request envelope (operation + correlation).
fn read_gate(request: &Value) -> Option<RequestGate> {
    let operation = request.get("operation")?.as_str()?.to_string();
    let correlation_id = request
        .get("correlation")
        .and_then(|correlation| correlation.get("correlationId"))
        .and_then(|id| id.as_str())
        .unwrap_or("corr:unattributed")
        .to_string();
    Some(RequestGate { operation, correlation_id })
}

/// True when the payload carries the GatewayCallResult discriminant.
fn is_call_result(body: &Value) -> bool {
    matches!(body.get("ok"), Some(Value::Bool(_))) && (body.get("value").is_some() || body.get("error").is_some())
}

fn malformed_request() -> Value {
    typed_error(
        "validation",
        "request-envelope-malformed",
        "the gateway call must carry the serialized GatewayRequestEnvelope (schemaVersion/contractVersion/operation/correlation fields)",
        "gateway",
        "corr:unattributed",
        false,
    )
}

/// Build the serialized `{ ok: false, error: GatewayError }` contract.
fn typed_error(
    class: &str,
    code: &str,
    message: &str,
    operation: &str,
    correlation_id: &str,
    retryable: bool,
) -> Value {
    json!({
        "ok": false,
        "error": {
            "schemaVersion": 1,
            "class": class,
            "code": code,
            "message": message,
            "operation": operation,
            "correlationId": correlation_id,
            "retryable": retryable
        }
    })
}
