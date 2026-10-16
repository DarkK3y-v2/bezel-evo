# Fonts in Bezel Evo (D-32)

Studio and Light share the renderer and the same three font sources. The theme
format stays unchanged: portable fonts use the existing `font.asset` reference.

- **Included with Bezel:** Inter and JetBrains Mono are embedded in the binary.
  These families cannot be copied into a theme, including through IPC.
- **My fonts:** drop `.ttf`, `.otf` or `.ttc` files directly into
  `%APPDATA%\Bezel Evo\fonts`. This is shared per Windows user, independently
  of the installation directory and the Windows font installation. The picker
  opens this fixed folder (creating it if absent). Studio and Light poll file
  size/modification metadata at most once every two seconds and rebuild shaping
  and rendered text caches when it changes. The picker refreshes on opening;
  **Reload fonts** also refreshes an already open list. Replacing a file must
  change its size or modification time. Subfolders and symlinks are ignored.
- **Theme fonts:** the picker lists font assets held by the open document.
  **Include in theme** copies the catalogued file for the highlighted family
  and nearest available style, then sets `font.asset` on the selected text.
  Confirm the redistribution licence notice first; Bezel cannot grant a font
  licence. A collection is copied whole and all its families appear in the list.
  Theme assets take priority over identically named installed/user fonts.

**Remove font from theme** detaches that file from every font reference in one
undoable edit, keeping each family name, weight and slant. The renderer then
resolves by family name. Bytes stay in the editing session for undo; saving or
exporting prunes unused assets, so the removed file is not redistributed.
Changing just the style keeps the asset; choosing a system/user/bundled entry
clears it. Saving/reopening includes used font files without requiring Windows
font installation on the destination PC.

## Limits and diagnostics

The folder loader validates every face with `ttf-parser` before loading it. Files
above 32 MiB, malformed fonts and collections above 256 faces are skipped with
`bezel_render` warnings. At most the first 128 font filenames (sorted) and 256 MiB
of valid font data are loaded from a folder. Exceeding these limits is diagnosed.
Reads are bounded even if a file grows while it is read. Font data is parsed as
data; the folder action opens only the fixed directory, never a font executable.
IPC copies only files selected by family/style from the renderer catalog, or
validated font assets from the current document; it accepts no source file path.
