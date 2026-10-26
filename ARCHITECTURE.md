# BAGS Architecture Reference

**Project**: Basic Adventure Gaming System (BAGS)  
**Last Updated**: 2025-11-15  
**Purpose**: Hackable Foundry VTT system for classic Basic/Expert adventure games and derivatives

## Project Overview

BAGS is a modular Foundry VTT system providing a foundation for classic tabletop RPG rulesets (B/X, OSE, Swords & Wizardry, etc.). It emphasizes:

- **Modularity**: Pluggable rule variants via SystemRegistry
- **Modern development**: ES modules, modern JavaScript patterns
- **Extensibility**: Reference implementation for developers building derivative systems
- **United Fantasy Toolkit**: Component-based architecture for OSR games

## Technology Stack

### Core Technologies

- **Foundry VTT**: v14.x (target platform)
- **JavaScript**: ES2020+ with ES modules
- **Build System**: Rollup 4.x
- **CSS**: PostCSS with nested syntax
- **Templates**: Handlebars (`.hbs`)

### Build Pipeline

- **Entry Points**:
  - `src/index.mjs` → `dist/index.js` (system core)
  - `src/components/index.mjs` → `dist/components.js` (web components)
- **Bundler**: Rollup with multiple plugins
- **Transpilation**: Babel (decorators support via stage-3 proposal)
- **CSS Processing**: PostCSS (import, nested, autoprefixer, cssnano)
- **Watch Mode**: Live reload on port 9999
- **Output**: All builds to `dist/` directory

### Development Tools

- **Linting**: ESLint 9.x (flat config) + Prettier
- **CSS Linting**: Stylelint with standard config
- **Git Hooks**: Husky + lint-staged (auto-format on commit)
- **Package Manager**: npm
- **Node Version**: v18+
- **Process Manager**: mprocs (defined in `mprocs.yaml`)

## Architecture Patterns

### 1. Document-Centric Architecture

Follows Foundry's document model pattern:

- **Actors**: Characters, Monsters, Vehicles
- **Items**: Weapons, Armor, Items, Classes, Abilities, Spells
- **ChatMessages**: Custom action/check types
- Each document type has:
  - DataModel (schema + derived data)
  - Document class (custom logic)
  - Sheet class(es) (UI rendering)

### 2. Modular Rules System (SystemRegistry)

**Location**: `src/config/system-registry.mjs`

Central registry pattern for pluggable game rules:

```javascript
SystemRegistry.categories = {
  ABILITY_SCORES,
  SAVING_THROWS,
  COMBAT,
  INITIATIVE,
  ENCUMBRANCE,
  CHARACTER_ACTIONS,
  BASE_MONSTER_STATS,
}
```

**Registration Flow**:

1. Hook: `BAGS.RegisterSystems` called during init
2. Modules register via `SystemRegistry.register(category, component)`
3. Settings auto-generated for each category
4. Runtime selection via `SystemRegistry.getSelectedOfCategory()`

**Example Registrations**: See `src/hooks/bags.register-systems.bx.mjs`

- B/X ability scores, saving throws, combat
- Encumbrance variants (basic/detailed)
- Monster stat blocks

### 3. Data Models (TypeDataModel)

**Pattern**: Foundry's v10+ DataModel system with mixins

**Actor DataModels**:

- `src/actors/actor.datamodel.mjs` - Base mixin pattern
- `src/actors/actor.character.datamodel.mjs` - Character-specific
- `src/actors/actor.monster.datamodel.mjs` - Monster-specific

**Item DataModels**:

- Per-type models in `src/items/item.*.datamodel.mjs`
- Physical items use `item.physical.datamodel.mjs` mixin

**Schema Construction**:

- Factory functions in `src/actors/actor.fields.mjs`
- Dynamic schema based on SystemRegistry settings
- Computed properties for derived data

### 4. Application Framework

**Base Class**: `src/applications/application.mjs`

Custom ApplicationV2 wrapper providing:

- HandlebarsApplicationMixin integration
- Sub-application management pattern
- Automatic form handling (submitOnChange)
- Multi-part rendering system
- Standardized context preparation

**Sheet Implementations**:

- Actor sheets: `actor.character.sheet.mjs`, `actor.monster.sheet.mjs`
- Item sheets: Per-type in `src/items/`
- Editors: Specialized editors for complex data (XP tables, actions, etc.)

### 5. Web Components System

**Location**: `src/components/`

Custom element framework built on Web Components API:

**Base Component**: `component.utils.base-component.mjs`

- Shadow DOM for encapsulation
- Form-associated for Foundry integration
- Lifecycle: `prepareData()` → `render()` → `events()`
- CSS-in-JS via constructable stylesheets

**Decorator**: `@component(name)` - Auto-registers custom elements

**Components**:

- `bags-ability-score-field` - Ability score input
- `bags-item-row/tile` - Item display variants
- `bags-xp-bar` - Experience progress
- `bags-spell-slot-field` - Spell slot management
- `bags-prepared-spell-list` - Spell preparation UI

**Integration**: Imported separately as `components.js` in system.json

### 6. Hook-Based Initialization

**Location**: `src/hooks/`

**Initialization Sequence**:

1. `bags.register-systems.bx.mjs` - Register rule modules (pre-init)
2. `init.system-registration.mjs` - Setup SystemRegistry
3. `init.settings.mjs` - Register all settings
4. `init.queries.mjs` - Setup query selectors
5. `init.handlebars.mjs` - Register helpers
6. `init.actors.mjs` - Register actor types/sheets
7. `init.items.mjs` - Register item types/sheets
8. `init.combat.mjs` - Combat tracker setup
9. `init.chat.mjs` - Chat message handling
10. `init.dice.mjs` - Dice roller integration
11. `setup.ui.mjs` - UI overrides (sidebar)

**Pattern**: Each hook file is self-contained, imports run immediately

### 7. Template Organization

**Location**: `src/templates/`

**Structure**:

- Document-centric folders: `character/`, `monster/`, `item/`, etc.
- Shared partials: `common/`
- Feature-specific: `chat-cards/`, `combat/`, `spells/`
- Settings UI: `settings/`

**Rendering**: Handlebars templates with custom helpers registered in `init.handlebars.mjs`

## Directory Structure

```
src/
├── actors/               # Actor documents, sheets, data models
├── applications/         # Shared application utilities
├── assets/              # Images, icons, static files
├── chat/                # Chat message types
├── combat/              # Combat tracker logic
├── common/              # Shared utilities
├── components/          # Web components (shadow DOM)
├── config/              # System configuration & registry
├── data/                # Rule data definitions (B/X stats, modifiers)
├── dialogs/             # Modal dialogs
├── dice/                # Dice rolling logic
├── hooks/               # Foundry hook handlers
├── items/               # Item documents, sheets, data models
├── lang/                # i18n translations
├── lib/                 # Third-party libraries
├── party/               # Party management sidebar
├── rules-engines/       # Action/save resolution logic
├── sidebar/             # Custom sidebar tabs
├── styles/              # Global CSS
├── subsystems/          # Alternative rule implementations
├── templates/           # Handlebars templates
├── ui/                  # UI utilities
├── utils/               # Helper functions
├── index.mjs            # System entry point
├── index.css            # CSS entry point
└── system.json          # Foundry system manifest
```

## Key Architectural Decisions

### 1. ES Modules Throughout

- No CommonJS
- `type: "module"` in package.json
- Import/export syntax everywhere
- `.mjs` extension for clarity

### 2. Decorator-Based Component Registration

- Uses Babel stage-3 decorators
- `@component('element-name')` pattern
- Automatic custom element registration

### 3. Mixin Pattern for Data Models

- Base functionality via factory functions
- Composition over inheritance
- Schema passed as function to mixin

### 4. Dual Build Output

- **System bundle**: All game logic
- **Component bundle**: Isolated web components
- Allows separate loading/caching strategies

### 5. Settings-Driven Schema

- Data models read from SystemRegistry
- Dynamic field generation based on selected rules
- Allows runtime rule switching

### 6. Handlebars Over Template Literals

- Foundry convention
- Pre-compilation support
- Better tooling integration

### 7. Shadow DOM for Components

- Style encapsulation
- No global CSS conflicts
- Form-associated for native Foundry integration

### 8. Hook-Driven Initialization

- No central initialization file beyond `index.mjs`
- Each module self-registers via hooks
- Loose coupling between subsystems

## Data Flow

### Character Creation

1. Creation wizard (`actor.character.creation-wizard.mjs`)
2. Multi-step process via sub-apps
3. Data sourced from compendiums (configured in settings)
4. Final actor created with selected class/abilities/equipment

### Action Resolution

1. User triggers action (attack, save, etc.)
2. `rules-engines/action-resolver.mjs` or `saving-throw-resolver.mjs`
3. Reads selected combat/save system from SystemRegistry
4. Calls system-specific `resolve()` method
5. Returns roll + success state
6. Chat card created with results

### Spell Management

1. Spells stored as Items on Actor
2. `preparedSpells` array stores Item IDs
3. `bags-prepared-spell-list` component for UI
4. `spell-manager.mjs` application for bulk operations
5. Spell slots managed in class Item data

### Encumbrance Calculation

1. Selected system from SystemRegistry (basic/detailed)
2. Called via `actor.system.encumbrance` getter
3. Iterates equipped items
4. Applies modifiers from abilities/effects
5. Returns value + thresholds
6. UI displays via computed properties

## File Naming Conventions

- **Documents**: `{type}.document.mjs` (e.g., `actor.document.mjs`)
- **Data Models**: `{type}.{subtype}.datamodel.mjs` (e.g., `actor.character.datamodel.mjs`)
- **Sheets**: `{type}.{subtype}.sheet.mjs` (e.g., `item.weapon.sheet.mjs`)
- **Editors**: `{type}.{subtype}.editor.mjs` (specialized editing UIs)
- **Components**: `component.{name}.mjs` (e.g., `component.xp-bar.mjs`)
- **Hooks**: `{hookname}.{description}.mjs` (e.g., `init.actors.mjs`)
- **Data Files**: `{system}.{feature}.mjs` (e.g., `bx.ability-scores.mjs`)
- **Utils**: `{kebab-case-description}.mjs` (e.g., `roll-dice.mjs`)

## Build Process

### Development Mode

```bash
npm start  # Runs watch:js + watch:css in parallel
```

- Rollup watch on source files
- PostCSS watch with polling
- LiveReload on port 9999
- Source maps enabled
- No minification
- `__DEV__` flag set to `true`

### Production Build

```bash
npm run build
```

- Terser minification
- Source maps generated
- Assets copied to `dist/`
- CSS optimized with cssnano
- `__DEV__` flag set to `false`

### Build Artifacts

- `dist/index.js` - System code (ESM, minified)
- `dist/components.js` - Web components (ESM, minified)
- `dist/bags.css` - Compiled styles
- `dist/assets/` - Static assets
- `dist/templates/` - Handlebars templates
- `dist/lang/` - Translation files
- `dist/system.json` - System manifest

## Testing & Quality

### Linting

- **ESLint**: Flat config with Foundry-specific rules
- **Prettier**: Formatting (semi: false, trailingComma: all)
- **Stylelint**: CSS standards
- **Pre-commit**: Auto-format via lint-staged

### Development Helpers

- `src/utils/dev-helpers.mjs` - `devOnly()` wrapper
- Auto-opens test sheets in dev mode
- LiveReload integration
- Development code stripped in production

### Manual Testing

- Symlink to Foundry `Data/systems/bags`
- Test in running Foundry instance
- Use mprocs for parallel server + watch

## Configuration Files

- **rollup.config.js** - Dual bundle configuration
- **babel.config.json** - Decorator support
- **postcss.config.cjs** - CSS pipeline
- **eslint.config.mjs** - Linting rules
- **.prettierrc.yaml** - Code formatting
- **.stylelintrc.yaml** - CSS linting
- **mprocs.yaml** - Development process orchestration

## Extension Points

### Adding New Rule Variants

1. Create data file in `src/data/` (e.g., `osr.saving-throws.mjs`)
2. Register in hook file (e.g., `bags.register-systems.osr.mjs`)
3. Implement required interface (varies by category)
4. Setting auto-generated on init

### Adding New Document Types

1. Create data model in appropriate directory
2. Create document class (if custom logic needed)
3. Create sheet(s) for UI
4. Register in `init.{actors|items}.mjs`
5. Add to `system.json` documentTypes

### Adding New Components

1. Create `component.{name}.mjs` in `src/components/`
2. Extend `BaseComponent`
3. Apply `@component('bags-{name}')` decorator
4. Import in `src/components/index.mjs`
5. Use in Handlebars templates

### Adding New Settings

1. Register in `src/hooks/init.settings.mjs`
2. Use `game.settings.register(SYSTEM_NAME, key, config)`
3. Add translation keys to `src/lang/en.json`
4. Access via `game.settings.get(SYSTEM_NAME, key)`

## Performance Considerations

- **Lazy Loading**: Actor/Item data models imported async after settings
- **Shadow DOM**: Component styles scoped, don't affect global render
- **Memoization**: Derived data cached on data model instances
- **Minimal Re-renders**: submitOnChange with targeted updates
- **Asset Optimization**: CSS minified, images optimized

## Known Patterns

### Factory Functions

Used for reusable schema pieces:

```javascript
const hpFactory = () => new SchemaField({
  value: new NumberField({...}),
  max: new NumberField({...})
})
```

### Getters for Derived Data

Computed properties on data models:

```javascript
get armorClass() {
  return this.base.ac + this.modifiers.ac
}
```

### Event Delegation

Components use centralized event handlers:

```javascript
events() {
  this.addEventListener('click', this.#onClick.bind(this))
}
```

### Tagged Template Literals

`html` helper for syntax highlighting:

```javascript
get template() {
  return html`<div>${this.value}</div>`
}
```

## Integration with Foundry

- **V2 Applications**: Uses ApplicationV2 + HandlebarsApplicationMixin
- **DataModel**: Modern TypeDataModel for all documents
- **Active Effects**: Legacy transferral disabled
- **Compendium Packs**: Pre-configured in system.json
- **i18n**: Full localization support via `lang/en.json`

## Future Architectural Considerations

- **Module API**: Potential public API for third-party modules
- **Theme System**: Pluggable UI themes
- **Automation**: More sophisticated active effect integration
- **Testing**: Unit test framework (currently manual testing only)

---

## Quick Reference Commands

```bash
# Development
npm start                 # Watch mode (JS + CSS)
npm run build            # Production build
npm run build:js         # Build JS only
npm run build:css        # Build CSS only

# Code Quality
npm run lint             # Run all linters (via lint-staged)
git commit               # Triggers auto-formatting

# Process Management
mprocs                   # Run server + watch + other tools
```

## Related Documentation

- **CONTRIBUTING.md** - Development setup guide
- **README.md** - User-facing documentation
- **src/system.json** - System manifest/metadata
- **package.json** - Dependencies and scripts
