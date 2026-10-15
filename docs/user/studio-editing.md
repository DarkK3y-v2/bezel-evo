# Editing in Studio

Object properties follow a consistent
order: name/type, position and size, content/data, appearance, membership,
playback/animation and layer/object actions. Sections are separated by horizontal lines and can be collapsed; they retain
their state while editing; irrelevant sections are omitted. Sensor bindings,
clock/weather configuration and image assets are separate from visual styling.

Right-click an object in the canvas or Layers for cut/copy/paste, grouping,
ordering, visibility and locking actions. Arrow keys move the selection (Shift
moves by 10 px). Multi-object alignment uses the first selected object as its
fixed reference; single-object alignment uses the canvas. Layers accept drops into groups, card faces and the root level.
Shapes support shared or individual corner radii; media covers have shared or individual corner radii and
text-gap controls. Each card trigger can return to an explicit face after its
configured delay. Deselect the card and its objects to test automatic playback.

In **Themes**, **Save as .bezeltheme...** opens a file dialog to save the current
layout and its available assets wherever you choose (also Ctrl+Shift+S).
The top **Save** button saves to the current location or the internal library.
A background video referenced only in screen storage stays a screen reference;
it is not downloaded from the display when saving a theme.

See [Your first theme](first-theme.md) for the starting workflow and
[the fork history](../../FORK.md) for implementation and validation details.
