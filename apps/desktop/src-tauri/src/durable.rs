// W048 — the durable local-projection store (client-runtime records only).
//
// A single JSON map file (`epoch-durable.json`) under the per-OS app-data
// directory, holding the client-runtime projection records the product
// persists across relaunches (J12): the sessions mirror, the offline queue
// and the projection cache. NEVER semantic state — the gateway owns
// semantic truth; these are projections (the no-second-store discipline,
// audited by test/native-offline-replay.test.ts on the TypeScript side).
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

pub struct DurableStore {
    path: PathBuf,
    entries: Map<String, Value>,
}

impl DurableStore {
    /// Open (or initialize) the store at `<data_dir>/epoch-durable.json`.
    pub fn new(data_dir: &Path) -> Self {
        let path = data_dir.join("epoch-durable.json");
        let entries = fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(text.as_str()).ok())
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default();
        Self { path, entries }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        self.entries.get(key).and_then(|value| value.as_str()).map(str::to_string)
    }

    pub fn set(&mut self, key: &str, value: &str) {
        self.entries.insert(key.to_string(), Value::String(value.to_string()));
        self.persist();
    }

    pub fn delete(&mut self, key: &str) -> bool {
        let existed = self.entries.remove(key).is_some();
        if existed {
            self.persist();
        }
        existed
    }

    /// Every key, sorted ascending (deterministic listing — the TS side
    /// asserts sorted order on restore).
    pub fn keys(&self) -> Vec<String> {
        let mut keys: Vec<String> = self.entries.keys().cloned().collect();
        keys.sort();
        keys
    }

    pub fn clear(&mut self) {
        self.entries.clear();
        self.persist();
    }

    /// Persist atomically: serialize, write the temp file, then rename.
    fn persist(&self) {
        if let Some(parent) = self.path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let tmp = self.path.with_extension("json.tmp");
        if let Ok(text) = serde_json::to_string(&Value::Object(self.entries.clone())) {
            if fs::write(&tmp, text).is_ok() {
                let _ = fs::rename(&tmp, &self.path);
            }
        }
    }
}
