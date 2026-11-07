---
name: Spinda Stop
description: Competitive Pokémon tools with a readable bitmap field-guide voice.
colors:
  primary: "#a61020"
  signal-red: "#bd1d2c"
  paper: "#f2f0eb"
  surface: "#ffffff"
  surface-quiet: "#e8e6e0"
  ink: "#111111"
  ink-soft: "#484a4b"
  divider: "#bbb9b3"
  link: "#1d4e91"
  link-deep: "#173b6b"
  success: "#315e46"
  selection: "#f7dadd"
  focus: "#005fcc"
typography:
  display:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "clamp(1.35rem, 2.75vw, 2.25rem)"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: "2px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "10px 14px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "44px"
    size: "1rem"
---

# Design System: Spinda Stop

## Overview

**Creative North Star: “O Espécime Bitmap”.**

Spinda Stop reads like a competitive field guide: find a species, inspect its exact form, then move into team and battle analysis. Bitmap headlines give the catalog a recognizable voice; plain sans-serif keeps long names, labels, tables, and calculations easy to scan. Paper, ink, and a restrained red signal make the interface feel collected and purposeful without turning each screen into a game mockup.

The former FireRed/GBA hypothesis survives in the existing Pokémon sprites and the short bitmap display voice. Its game-like panels and green-heavy palette no longer lead the product. Rankings stay attributed to their source and period, and a general Pokédex entry never implies availability or legality in Pokémon Champions.

**Key Characteristics:**
- Bitmap display type paired with readable sans-serif data.
- Search and comparison actions lead each workflow.
- Flat rows, rules, and exact-form sprites replace repeated floating cards.

## Colors

Warm neutral paper and near-black ink carry most of the interface. Red marks primary actions, selected competitive data, and emphasis; blue is reserved for navigation and links. Type badges tint the existing type colors at low opacity so each type remains recognizable without making the page noisy.

### Primary
- **Signal Red** (`#a61020`): primary action, selected result, and important ranking position.
- **Red Register** (`#bd1d2c`): softer signal and the 20% badge tint source.

### Secondary
- **Atlas Blue** (`#1d4e91`): links and secondary navigation.
- **Deep Blue** (`#173b6b`): link text on light surfaces.
- **Field Green** (`#315e46`): success states where the existing status needs it.
- **Archive Gold** (`#815b12`): restrained accent for secondary competitive metadata.
- **Signal Tint** (`#f7dadd`): pale selection surface for selected species, options, and results.

### Neutral
- **Paper** (`#f2f0eb`): application canvas.
- **White Stock** (`#ffffff`): forms and primary reading surfaces.
- **Quiet Stock** (`#e8e6e0`): grouping behind filters and sprite wells.
- **Ink** (`#111111`): titles, primary text, and structural rules.
- **Soft Ink** (`#484a4b`): secondary text.
- **Divider** (`#bbb9b3`): row and section rules.
- **Focus Blue** (`#005fcc`): keyboard focus outline.

**The Signal Rule.** Red marks a meaningful next action or selected result; it does not decorate every surface.

## Typography

**Display Font:** Press Start 2P (with `ui-monospace`, `monospace` fallbacks)
**Body Font:** Inter (with system sans-serif fallbacks)

**Character:** Display type is pixel-shaped and deliberate; body type stays neutral and open for dense competitive data. The normal text base is `1rem`; controls keep at least `1rem` text.

### Hierarchy
- **Display** (400, `clamp(1.35rem, 2.75vw, 2.25rem)`, 1.55): route titles and the Home headline.
- **Title** (400, `1rem`, 1.55): section headings with short functional labels.
- **Body** (400, `1rem`, 1.55): descriptions, form labels, lists, and table content; keep paragraphs near 70ch.
- **Label** (600–700, `1rem`): filters, controls, and source context.

**The Readable Data Rule.** Keep species, forms, moves, source periods, and calculation inputs in the body face. Bitmap type is a display voice, not a compact data font.

## Layout

The page canvas uses a centered reading width up to 1,450px. Home pairs a real search form with the Spinda signature, then exposes existing destinations as a ruled index. The Dex keeps filters above a three-column desktop species list, with two columns at narrower widths. Species sheets give the exact form and sprite the lead. Usage puts the source-backed ranking beside its selected Pokémon; team building keeps six positions visible beside one active editor; damage puts both sets, active moves, field, and result in one workbench. Speed, rooms, and tournaments retain their existing tables, bracket, and action flows while using the same paper-and-rule system.

At 760px and below, the page narrows to the viewport, the damage workbench stacks, the Usage browser moves after results, and the community workspace becomes one column. At 420px, the home index becomes two columns and the builder slots use a two-column layout. Avoid fixed content widths that create horizontal page overflow.

## Elevation & Depth

Surfaces are flat at rest. Hierarchy comes from alignment, whitespace, ink rules, pale grouping, and the active red signal. A shadow is reserved for an existing transient menu; do not add elevation to every panel.

**The Flat-by-Default Rule.** A data region earns a border or tint only when it helps separate a task, state, or input group.

## Shapes

Use square corners with a `2px` radius. Strong rules belong to the outer edge of a workbench or selected region; thin lines divide peer rows. Interactive controls have at least a `44px` target, visible keyboard focus, and a distinct pressed state on touch.

## Components

### Buttons
- **Shape:** square, `2px` radius; `44px` minimum height.
- **Primary:** Signal Red fill with white text; use for the next committed action.
- **Secondary:** white stock with an ink border; use for alternate actions.
- **Hover / Focus:** hover feedback only for fine pointers; a high-contrast outline identifies keyboard focus.

### Fields
- **Shape:** white stock, ink border, square corners, `44px` minimum height.
- **Text:** at least `1rem`; the label stays visible above or beside the control.
- **Touch:** use `touch-action: manipulation`; keep browser zoom available.

### Type Badges and State Chips
- **Style:** square, thin border, dark readable text; background color uses 20% tint for type identity or red state emphasis.
- **State:** include a text label or icon so color is never the only signal.

### Species Rows
- **Style:** sprite well, number, exact name/form, and type badges in one scan line; fine hover adds emphasis, touch press gives a brief tint.
- **Behavior:** the row links to the existing species sheet and keeps sprite identity tied to the exact form.

### Competitive Workbenches
- **Builder:** six selectable slots and one active set editor.
- **Damage:** two editable Pokémon sides, four selectable move slots per side, field controls, and results near the selection.
- **Data provenance:** keep source and period visible where ranking or usage values appear.

## Do's and Don'ts

### Do
- **Do** put the player's next useful action before an explanation of infrastructure.
- **Do** keep rankings, forms, calculations, and state labels tied to existing data and sources.
- **Do** preserve keyboard focus, touch feedback, reduced motion, and responsive reading order.
- **Do** reuse existing sprites and their credit in [third-party licenses](docs/THIRD_PARTY_LICENSES.md).

### Don't
- **Don't** imply that general-game data proves Champions availability or tournament legality.
- **Don't** add rentals, win rates, player results, or fabricated usage values without a verified source.
- **Don't** turn every section into a card, or use bitmap type for dense rows and labels.
- **Don't** reuse third-party reference layouts, code, images, marks, or sprites.
