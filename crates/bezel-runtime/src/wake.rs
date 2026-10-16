//! Generation-based wakeups never hold the engine lock while sleeping.
use std::{
    sync::{Arc, Condvar, Mutex},
    time::Duration,
};
#[derive(Clone, Default)]
pub struct Wake(Arc<(Mutex<u64>, Condvar)>);
impl Wake {
    pub fn version(&self) -> u64 {
        *self
            .0
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
    pub fn notify(&self) {
        let mut version = self
            .0
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        *version = version.wrapping_add(1);
        drop(version);
        self.0.1.notify_all();
    }
    pub fn wait(&self, version: u64, timeout: Duration) {
        let value = self
            .0
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        drop(
            self.0
                .1
                .wait_timeout_while(value, timeout, |current| *current == version)
                .unwrap_or_else(std::sync::PoisonError::into_inner),
        );
    }
}
