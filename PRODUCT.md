# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pokémon competitive players preparing for Pokémon Champions, with Doubles as the first supported format. They look up species and forms, compare published usage data, assemble a six-member team, and evaluate damage or Speed scenarios.

## Product Purpose

Spinda Stop is an independent browser workspace for preparing teams and organizing community matches around Pokémon Champions. Success means completing those preparation tasks with clear data provenance and without implying that the site connects to the game.

## Positioning

The existing product brings species data, one Usage catalog selected from two published captures, editable team drafts, damage and Speed calculations, and optional community organization into one workspace. It preserves each observation's meaning and the boundary between general game data and Champions legality.

## Operating Context

Players move between discovery, team editing, matchup analysis, and community organization. A local team can be imported or exported as the project's JSON format. Community rooms and four-player tournaments are optional; reported match results are confirmed manually.

## Capabilities and Constraints

- The Pokédex uses a pinned PokéAPI revision for general species, form, stat, evolution, type, and learnset data. Those facts do not prove availability, move coexistence, or legality in a Champions ruleset.
- The Usage catalog selects one published value per distribution, prefers a matching MetaRoll Doubles observation, and falls back to Battle Data only for unmatched identities. Different periods, denominators, and missing values are not averaged; source provenance remains in technical details.
- The builder has six editable positions, local drafts, JSON import/export, and Pokémon Showdown text paste/export. Optional GitHub accounts save private or public copies. Team analysis uses equipped damaging move types and the local type chart; it does not simulate abilities or field effects.
- Damage calculations use the existing `@smogon/calc` integration and expose its supported modes, rolls, field modifiers, and limits. Speed values are calculated from the project's formulas, not Usage rankings.
- The site's rooms and tournaments organize voluntary reports; they do not connect to Pokémon Champions.
- The local community API uses SQLite. Vercel previews do not provide persistent community storage and must not be presented as if they save room or tournament data.

## Brand Commitments

Spinda Stop is a personal, unofficial fan project with no affiliation to Nintendo, Creatures, GAME FREAK, or The Pokémon Company. Keep the existing Spinda identity and documented sprite credits. Reference sites and DataDex screenshots are research material, not product assets.

## Evidence on Hand

The repository documents its data sources, periods, limits, sprite origins, and routes in `README.md`, `docs/DATA_SOURCES.md`, `docs/META_SOURCES.md`, `docs/THIRD_PARTY_LICENSES.md`, and the UI/design documents. There is no confirmed source for official Champions legality, public win rates, rental teams, or unsourced tournament outcomes.

## Product Principles

- Keep source and period close to the data they describe.
- Preserve missing, unknown, unsupported, and unavailable as distinct states.
- Let players move from discovery to editing and analysis without losing their current work.
- Treat imports, results, and community reports according to their actual source and privacy.
- Never imply official game access, ruleset legality, or product evidence the site does not have.

## Accessibility & Inclusion

The web experience must retain keyboard access, visible focus, readable labels, and responsive touch layouts. Normal body text uses a 1rem base, and mobile controls remain usable without disabling browser zoom.
