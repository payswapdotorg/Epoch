// W048 — the platform-safe secure store (W048 pin 5).
//
// Session tokens and credential-shaped values go through the OS keychain
// — Secret Service on Linux, Credential Manager on Windows, Keychain on
// macOS (the `keyring` crate) — NEVER the durable store, never a plaintext
// config file. The service/user pair is fixed: every entry this app owns
// lives under service "Epoch Desktop".
use keyring::Entry;

/// The fixed keychain service name for every Epoch Desktop entry.
const SERVICE: &str = "Epoch Desktop";

fn entry(key: &str) -> Result<Entry, keyring::Error> {
    Entry::new(SERVICE, key)
}

/// Read one secure value (None when the entry does not exist).
pub fn get(key: &str) -> Result<Option<String>, keyring::Error> {
    match entry(key) {
        Ok(entry) => match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error),
        },
        Err(error) => Err(error),
    }
}

/// Write one secure value (create or overwrite).
pub fn set(key: &str, value: &str) -> Result<(), keyring::Error> {
    entry(key)?.set_password(value)
}

/// Delete one secure value; true when an entry was removed.
pub fn delete(key: &str) -> Result<bool, keyring::Error> {
    match entry(key)?.delete_credential() {
        Ok(()) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(error),
    }
}

/// The fixed service name (the wipe command walks the keys the durable
/// store owns — keychain entries are addressed by the same key set).
pub fn service_name() -> &'static str {
    SERVICE
}
