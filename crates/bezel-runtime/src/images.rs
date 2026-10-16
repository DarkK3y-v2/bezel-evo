//! Latest immutable frames; cloning a snapshot never takes the engine mutex.
use crate::{element_preview, invalid, wire};
use bezel_core::{Result, domain::frame::Frame, ports::RuntimeImages};
use bezel_power::diagnostics::{LightEvent, light};
use std::{
    collections::BTreeMap,
    sync::{Arc, RwLock},
};
pub(crate) struct Snapshot {
    pub frame: Arc<Frame>,
    pub sequence: u64,
    pub next_ms: u32,
}
#[derive(Default)]
pub struct Images(RwLock<BTreeMap<String, Arc<Snapshot>>>);
impl Images {
    pub(crate) fn publish(&self, key: &str, snapshot: Snapshot) {
        self.0
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .insert(key.into(), Arc::new(snapshot));
    }
    pub fn latest(&self, key: &str, after: u64, max: u32) -> Result<wire::Image> {
        if max == 0 || max > 2320 {
            return Err(invalid("invalid canvas bound"));
        }
        let snapshot = self
            .0
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .get(key)
            .cloned();
        light(LightEvent::Canvas, 0, 0.0, "request");
        let Some(snapshot) = snapshot else {
            return Ok(wire::Image {
                sequence: 0,
                next_ms: 16,
                frame: None,
            });
        };
        Ok(wire::Image {
            sequence: snapshot.sequence,
            next_ms: snapshot.next_ms.min(33),
            frame: if after == snapshot.sequence {
                None
            } else {
                Some(element_preview::fit_within(
                    snapshot.frame.as_ref().clone(),
                    max,
                ))
            },
        })
    }
}
impl RuntimeImages for Images {
    fn image(&self, metadata: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        let answer = (|| {
            if metadata.len() > wire::MAX_METADATA {
                return Err(invalid("image metadata limit"));
            }
            let request: wire::RuntimeMessage =
                serde_json::from_slice(metadata).map_err(|_| invalid("invalid image request"))?;
            if request.runtime != 2 {
                return Err(invalid("runtime version"));
            }
            let wire::RuntimeOp::Image { after, max, .. } = request.op else {
                return Err(invalid("not an image request"));
            };
            self.latest(&request.scene, after, max)
        })();
        let (reply, pixels) = match answer {
            Ok(image) => {
                let (value, pixels) = wire::image(image.frame, image.sequence, image.next_ms);
                (wire::Reply { value, error: None }, pixels)
            }
            Err(e) => (
                wire::Reply {
                    value: serde_json::Value::Null,
                    error: Some(e.to_string()),
                },
                Vec::new(),
            ),
        };
        Ok((
            serde_json::to_vec(&reply).map_err(|_| invalid("image response"))?,
            pixels,
        ))
    }
}
