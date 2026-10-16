//! Holder descriptions shared by connector ownership checks and scripted adapters.

/// The processes that have a device open, each as `"<command> (PID <pid>)"`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Holders {
    /// This process, when it has the device open itself.
    pub this: Option<String>,
    /// The other processes, by PID.
    pub others: Vec<String>,
}
