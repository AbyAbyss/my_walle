//! QuickJS-backed JS plugins — full `phantom.*` API can be layered here.

use serde_json::Value;

/// Runs a plugin script with JSON `input`. Returns JSON or an error string.
/// Phase 3 extension point: embed `rquickjs` and inject permission-gated `phantom` bindings.
pub fn run_plugin_script(
    _script: &str,
    input: Value,
    _allowed_apis: &[&str],
) -> Result<Value, String> {
    let _ = input;
    Err(
        "JS plugin sandbox: install scripts should use manifest shell commands; embedded QuickJS hook is reserved for marketplace builds."
            .into(),
    )
}
