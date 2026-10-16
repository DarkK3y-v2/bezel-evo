//! The font catalogue: every family of the renderer's font database with
//! its faces, whether it is monospaced, a category for filtering and where
//! it comes from. The studio's font picker lists it
//! (D-2026-10-16-studio-redesign-fidelity-28), so what the user picks is
//! exactly what the renderer can draw, and a family the database lacks is
//! named together with the family drawn instead ([`FontCatalog::fallback`]).

use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::sync::Arc;

/// How a family looks, for the picker's filters.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FontCategory {
    /// Without serifs.
    Sans,
    /// With serifs.
    Serif,
    /// Every glyph as wide as the others.
    Mono,
    /// Script, decorative or symbol families.
    Display,
}

/// One face of a family: its weight (CSS 1..=1000) and whether it is italic
/// (oblique faces count as italic, as the renderer picks them for it).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct FontFace {
    /// CSS-like weight.
    pub weight: u16,
    /// Italic or oblique.
    pub italic: bool,
}

/// Where a family comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FontOrigin {
    /// Shipped with Bezel (the bundled themes' fonts): on every machine.
    Bundled,
    /// Installed on this machine.
    System,
}

/// A family of the font database.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FontFamily {
    /// The family name a theme uses (the face's first, English, name).
    pub name: String,
    /// Other names the renderer also finds the family by (localized ones).
    pub aliases: Vec<String>,
    /// Its faces, sorted, without duplicates.
    pub faces: Vec<FontFace>,
    /// Every face is monospaced.
    pub monospace: bool,
    /// For filtering.
    pub category: FontCategory,
    /// Bundled when any of its faces ships with Bezel.
    pub origin: FontOrigin,
}

type FontBytes = Arc<dyn AsRef<[u8]> + Sync + Send>;

/// A face shipped with Bezel, with its file, so a user interface can draw
/// the family's name in it on a machine where it is not installed.
#[derive(Clone)]
struct BundledFace {
    family: String,
    face: FontFace,
    data: FontBytes,
}

/// The families of a font database and the family drawn for one it lacks.
#[derive(Clone, Default)]
pub struct FontCatalog {
    /// Every family, sorted by name (case-insensitive).
    pub families: Vec<FontFamily>,
    /// The family the renderer draws a missing family with (none without fonts).
    pub fallback: Option<String>,
    bundled: Vec<BundledFace>,
}

impl std::fmt::Debug for FontCatalog {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FontCatalog")
            .field("families", &self.families)
            .field("fallback", &self.fallback)
            .field("bundled", &self.bundled.len())
            .finish()
    }
}

impl FontCatalog {
    /// The file of the bundled `face` of `family` (case-insensitive), the
    /// only files handed out: nothing installed and nothing from a path.
    /// Faces inside collections (index above 0) are not handed out.
    pub fn bundled_face(&self, family: &str, face: FontFace) -> Option<&[u8]> {
        self.bundled
            .iter()
            .find(|b| b.face == face && b.family.eq_ignore_ascii_case(family))
            .map(|b| (*b.data).as_ref())
    }

    /// The family a theme naming `family` gets: its own name as the
    /// database spells it, or the fallback when it is missing.
    pub fn resolve(&self, family: &str) -> Option<&str> {
        self.families
            .iter()
            .find(|f| {
                f.name.eq_ignore_ascii_case(family)
                    || f.aliases.iter().any(|a| a.eq_ignore_ascii_case(family))
            })
            .map(|f| f.name.as_str())
            .or(self.fallback.as_deref())
    }
}

/// The OS/2 table's PANOSE classification: 10 bytes at offset 32.
const PANOSE_OFFSET: usize = 32;
const PANOSE_LEN: usize = 10;

/// Words of a family name that make it monospaced.
const MONO_WORDS: [&str; 5] = ["mono", "code", "console", "courier", "typewriter"];
/// Words of a family name that make it a display, script or symbol family.
const DISPLAY_WORDS: [&str; 10] = [
    "script", "hand", "brush", "symbol", "emoji", "icons", "dings", "assets", "print", "ink free",
];
/// Words of well-known serif family names that do not say "serif".
const SERIF_WORDS: [&str; 22] = [
    "times",
    "georgia",
    "garamond",
    "cambria",
    "palatino",
    "baskerville",
    "constantia",
    "sylfaen",
    "roman",
    "bodoni",
    "didot",
    "caslon",
    "merriweather",
    "playfair",
    "lora",
    "century",
    "bookman",
    "minion",
    "book antiqua",
    "sitka",
    "simsun",
    "mincho",
];

/// The category a family's name alone suggests.
fn by_name(name: &str) -> FontCategory {
    let n = name.to_lowercase();
    let has = |words: &[&str]| words.iter().any(|w| n.contains(w));
    if has(&MONO_WORDS) {
        FontCategory::Mono
    } else if n.contains("sans") {
        FontCategory::Sans
    } else if n.contains("serif") || has(&SERIF_WORDS) {
        FontCategory::Serif
    } else if has(&DISPLAY_WORDS) {
        FontCategory::Display
    } else {
        FontCategory::Sans
    }
}

/// The category of a family: monospaced faces are Mono; then the PANOSE
/// classification when it says something (Latin text: proportion and serif
/// style; script, decorative and pictorial kinds are Display); then the name.
pub fn category(name: &str, monospace: bool, panose: Option<[u8; PANOSE_LEN]>) -> FontCategory {
    if monospace {
        return FontCategory::Mono;
    }
    match panose {
        // Latin text: proportion 9 is monospaced; serif styles 2..=10 have
        // serifs, 11..=15 do not (normal, obtuse, perpendicular, flared, rounded).
        Some(p) if p[0] == 2 && p[3] == 9 => FontCategory::Mono,
        Some(p) if p[0] == 2 && (2..=10).contains(&p[1]) => FontCategory::Serif,
        Some(p) if p[0] == 2 && (11..=15).contains(&p[1]) => FontCategory::Sans,
        Some(p) if (3..=5).contains(&p[0]) => FontCategory::Display,
        _ => by_name(name),
    }
}

/// The PANOSE bytes of a font file's face, when it has an OS/2 table.
fn panose(data: &[u8], index: u32) -> Option<[u8; PANOSE_LEN]> {
    let face = ttf_parser::RawFace::parse(data, index).ok()?;
    let os2 = face.table(ttf_parser::Tag::from_bytes(b"OS/2"))?;
    os2.get(PANOSE_OFFSET..PANOSE_OFFSET + PANOSE_LEN)?
        .try_into()
        .ok()
}

/// What is gathered of one family while walking the database's faces.
#[derive(Default)]
struct Gathered {
    aliases: BTreeSet<String>,
    faces: BTreeSet<FontFace>,
    monospace: bool,
    panose: Option<[u8; PANOSE_LEN]>,
    bundled: bool,
}

fn face_of(info: &fontdb::FaceInfo) -> FontFace {
    FontFace {
        weight: info.weight.0,
        italic: info.style != fontdb::Style::Normal,
    }
}

/// The catalogue of `db`: `bundled` are the ids of the faces shipped with
/// Bezel, `fallback` the family drawn for a missing one.
pub(crate) fn catalog(
    db: &fontdb::Database,
    bundled: &HashSet<fontdb::ID>,
    fallback: Option<String>,
) -> FontCatalog {
    let mut families: BTreeMap<String, (String, Gathered)> = BTreeMap::new();
    let mut files = Vec::new();
    for info in db.faces() {
        let Some((name, _)) = info.families.first() else {
            continue;
        };
        let shipped = bundled.contains(&info.id);
        let (_, family) = families.entry(name.to_lowercase()).or_insert_with(|| {
            (
                name.clone(),
                Gathered {
                    monospace: true,
                    ..Gathered::default()
                },
            )
        });
        family.faces.insert(face_of(info));
        family.monospace &= info.monospaced;
        family.bundled |= shipped;
        family.aliases.extend(
            info.families
                .iter()
                .skip(1)
                .map(|(n, _)| n.clone())
                .filter(|n| !n.eq_ignore_ascii_case(name)),
        );
        if family.panose.is_none() {
            family.panose = db.with_face_data(info.id, panose).flatten();
        }
        if let (true, fontdb::Source::Binary(data), 0) = (shipped, &info.source, info.index) {
            files.push(BundledFace {
                family: name.clone(),
                face: face_of(info),
                data: data.clone(),
            });
        }
    }
    FontCatalog {
        families: families
            .into_values()
            .map(|(name, g)| FontFamily {
                category: category(&name, g.monospace, g.panose),
                aliases: g.aliases.into_iter().collect(),
                faces: g.faces.into_iter().collect(),
                monospace: g.monospace,
                origin: if g.bundled {
                    FontOrigin::Bundled
                } else {
                    FontOrigin::System
                },
                name,
            })
            .collect(),
        fallback,
        bundled: files,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testkit::{FAMILY, FONT};
    use crate::{SkiaRenderer, SystemFonts};

    fn latin(serif: u8, proportion: u8) -> Option<[u8; PANOSE_LEN]> {
        Some([2, serif, 5, proportion, 0, 0, 0, 0, 0, 0])
    }

    #[test]
    fn the_category_comes_from_monospacing_then_panose_then_the_name() {
        assert_eq!(category("Anything", true, latin(11, 3)), FontCategory::Mono);
        assert_eq!(category("Plain", false, latin(11, 9)), FontCategory::Mono);
        assert_eq!(category("Plain", false, latin(2, 3)), FontCategory::Serif);
        assert_eq!(category("Plain", false, latin(10, 3)), FontCategory::Serif);
        assert_eq!(category("Plain", false, latin(11, 3)), FontCategory::Sans);
        assert_eq!(category("Plain", false, latin(15, 3)), FontCategory::Sans);
        for kind in 3..=5 {
            let p = Some([kind, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            assert_eq!(category("Plain", false, p), FontCategory::Display);
        }
        // "Any" (0) and "no fit" (1) say nothing: the name decides.
        assert_eq!(
            category("Times New Roman", false, latin(0, 0)),
            FontCategory::Serif
        );
        assert_eq!(category("Noto Serif", false, None), FontCategory::Serif);
        assert_eq!(category("Noto Sans", false, None), FontCategory::Sans);
        assert_eq!(category("PT Sans Serif", false, None), FontCategory::Sans);
        assert_eq!(category("Fira Code", false, None), FontCategory::Mono);
        assert_eq!(category("Courier New", false, None), FontCategory::Mono);
        assert_eq!(category("Segoe Script", false, None), FontCategory::Display);
        assert_eq!(category("Wingdings", false, None), FontCategory::Display);
        assert_eq!(category("Inter", false, None), FontCategory::Sans);
    }

    #[test]
    fn panose_is_read_from_the_os2_table() {
        // JetBrains Mono NL: Latin text, monospaced proportion.
        let p = panose(FONT, 0).expect("the test font has an OS/2 table");
        assert_eq!((p[0], p[3]), (2, 9));
        assert_eq!(panose(b"not a font", 0), None);
    }

    #[test]
    fn the_catalogue_lists_the_bundled_family_with_its_face_and_file() {
        let renderer = SkiaRenderer::with_fonts(vec![FONT.to_vec()], SystemFonts::Skip);
        let catalog = renderer.font_catalog();
        assert_eq!(catalog.families.len(), 1);
        let family = &catalog.families[0];
        assert_eq!(family.name, FAMILY);
        assert_eq!(
            family.faces,
            vec![FontFace {
                weight: 400,
                italic: false
            }]
        );
        assert!(family.monospace);
        assert_eq!(family.category, FontCategory::Mono);
        assert_eq!(family.origin, FontOrigin::Bundled);
        assert_eq!(catalog.fallback.as_deref(), Some(FAMILY));
        let regular = FontFace {
            weight: 400,
            italic: false,
        };
        assert_eq!(
            catalog.bundled_face("jetbrains mono nl", regular),
            Some(FONT)
        );
        assert_eq!(
            catalog.bundled_face(
                FAMILY,
                FontFace {
                    weight: 700,
                    italic: false
                }
            ),
            None
        );
        assert_eq!(catalog.bundled_face("Nope", regular), None);
        assert!(format!("{catalog:?}").contains("bundled: 1"));
    }

    #[test]
    fn a_missing_family_resolves_to_the_fallback_the_renderer_draws() {
        let renderer = SkiaRenderer::with_fonts(vec![FONT.to_vec()], SystemFonts::Skip);
        let catalog = renderer.font_catalog();
        assert_eq!(catalog.resolve("JETBRAINS MONO NL"), Some(FAMILY));
        assert_eq!(catalog.resolve("Comic Sans MS"), Some(FAMILY));
        assert_eq!(FontCatalog::default().resolve("Inter"), None);
    }

    #[test]
    fn faces_of_one_family_are_gathered_and_an_installed_copy_is_not_bundled() {
        let mut db = fontdb::Database::new();
        let ids: Vec<_> = db
            .load_font_source(fontdb::Source::Binary(Arc::new(FONT.to_vec())))
            .into_iter()
            .collect();
        db.load_font_source(fontdb::Source::Binary(Arc::new(FONT.to_vec())));
        let none = HashSet::new();
        let system = catalog(&db, &none, None);
        assert_eq!(system.families.len(), 1);
        assert_eq!(system.families[0].faces.len(), 1, "duplicates are merged");
        assert_eq!(system.families[0].origin, FontOrigin::System);
        let regular = FontFace {
            weight: 400,
            italic: false,
        };
        assert_eq!(system.bundled_face(FAMILY, regular), None);
        let shipped = catalog(&db, &ids.into_iter().collect(), None);
        assert_eq!(shipped.families[0].origin, FontOrigin::Bundled);
        assert_eq!(shipped.bundled_face(FAMILY, regular), Some(FONT));
    }
}
