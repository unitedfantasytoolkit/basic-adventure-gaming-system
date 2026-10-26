# CLAUDE.md - Basic Adventure Gaming System (BAGS)

This file provides AI coding assistants with essential context for working on BAGS, a hackable Foundry VTT system for classic Basic/Expert adventure games.

## Project Overview

BAGS is a modular Foundry VTT v14 system implementing classic tabletop RPG rulesets (B/X, OSE, Swords & Wizardry). The architecture emphasizes:

- **Modularity** via the SystemRegistry pattern for pluggable rule variants
- **Modern development** with ES modules and current JavaScript patterns
- **Extensibility** as a reference implementation for derivative systems

**Related Documentation**: See `ARCHITECTURE.md` for detailed technical architecture, `CONTRIBUTING.md` for developer setup, and `README.md` for user-facing info.

## Essential Commands

```bash
# Development workflow
npm start                 # Start watch mode (JS + CSS with live reload)
npm run build            # Production build
npm run build:js         # Build JavaScript only
npm run build:css        # Build CSS only

# Code quality (ALWAYS run before considering work complete)
npm run lint             # Lint all code (auto-fixes on git commit)
npm run test             # Run unit tests (uvu test runner)
npm run test:coverage    # Generate coverage report

# Process management
mprocs                   # Run Foundry server + watch + tools (see mprocs.yaml)
```

You can assume that, while working, `mprocs` is running, which means that JS and CSS are building whenever you make changes.

**Testing Notes**:

- Unit tests (uvu) should ALWAYS pass when modifying rules engines like `src/rules-engines/action-resolver.mjs`
- Integration tests use Quench (browser-based, cannot be run from CLI)
- Run `npm run lint && npm test` before considering any task complete

## Code Style & Conventions

### Language & Formatting

- **ES Modules only** - Use `import`/`export`, never CommonJS `require()`
- **File extensions** - `.mjs` for JavaScript, `.hbs` for Handlebars templates
- **Prettier config** - No semicolons, trailing commas, 80 char width
- **Linting** - ESLint flat config with Foundry-specific rules
- Pre-commit hooks auto-format via husky + lint-staged

### Naming Conventions

Follow the established patterns:

- **Documents**: `{type}.document.mjs` (e.g., `actor.document.mjs`)
- **Data Models**: `{type}.{subtype}.datamodel.mjs` (e.g., `actor.character.datamodel.mjs`)
- **Sheets**: `{type}.{subtype}.sheet.mjs` (e.g., `item.weapon.sheet.mjs`)
- **Components**: `component.{name}.mjs` (e.g., `component.xp-bar.mjs`)
- **Hooks**: `{hookname}.{description}.mjs` (e.g., `init.actors.mjs`)
- **Utils**: `{kebab-case-description}.mjs` (e.g., `roll-dice.mjs`)

### JSDoc Requirements

**CRITICAL**: Always document code with JSDoc comments.

- Target junior developers - explain what's happening without being patronizing
- Write at American high school reading level
- Include `@param`, `@returns`, `@typedef` for all functions
- Use `@file` at the top of each file to explain its purpose

**Example**:

```javascript
/**
 * @file Handles character ability score calculations and modifiers.
 */

/**
 * Calculates the ability score modifier for a given score value.
 * In classic B/X rules, a score of 13-15 gives +1, 16-17 gives +2, etc.
 * @param {number} score - The raw ability score (3-18)
 * @returns {number} The calculated modifier (-3 to +3)
 */
function getAbilityModifier(score) {
  // Implementation
}
```

## Architecture Patterns

### 1. SystemRegistry - The Rule Variation System

**Location**: `src/config/system-registry.mjs`

The SystemRegistry is central to BAGS's modularity. It manages pluggable rule variants:

```javascript
// Categories where rules can be registered
SystemRegistry.categories = {
  ABILITY_SCORES, // How ability scores work
  SAVING_THROWS, // Saving throw systems
  COMBAT, // Combat resolution
  INITIATIVE, // Initiative rules
  ENCUMBRANCE, // Encumbrance calculation
  CHARACTER_ACTIONS, // Available character actions
  BASE_MONSTER_STATS, // Monster stat blocks
}
```

**How it works**:

1. Modules register during `BAGS.RegisterSystems` hook
2. Settings auto-generated for each category
3. Runtime selection via `SystemRegistry.getSelectedOfCategory()`

**When modifying**: NEVER change the registry system without explicit approval.

### 2. Data Models - Schema Construction

**Pattern**: Foundry's TypeDataModel system with factory function mixins

Data models use **factory functions** to build schemas dynamically based on SystemRegistry settings:

```javascript
// Example from actor.character.datamodel.mjs
const buildSchema = () => {
  const abilityScoreSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
  )
  // Schema adapts to selected rule system
  return {
    base: baseFactory({ abilityScores: new SchemaField(...) }),
    hp: hpFactory(),
    // ... more fields
  }
}
```

**CRITICAL - Actions DataModel**: Exercise extreme caution when working on Actions. The datamodel is complex and changes can break character sheets. ALWAYS double-check against existing similar code before making changes.

**Location patterns**:

- Actor models: `src/actors/actor.{type}.datamodel.mjs`
- Item models: `src/items/item.{type}.datamodel.mjs`
- Shared factories: `src/actors/actor.fields.mjs`, `src/items/item.fields.mjs`

### 3. Web Components

**Location**: `src/components/`

Custom elements built on Web Components API with shadow DOM:

- Use `@component('bags-element-name')` decorator for registration
- Extend `BaseComponent` from `component.utils.base-component.mjs`
- Lifecycle: `prepareData()` → `render()` → `events()`
- Loaded separately as `components.js` bundle

**When creating new components**: Follow the existing pattern exactly. See `component.xp-bar.mjs` as reference.

### 4. Applications & Sheets

**Base class**: `src/applications/application.mjs`

Custom ApplicationV2 wrapper providing:

- HandlebarsApplicationMixin integration
- Sub-application management
- Automatic form handling
- Multi-part rendering

**Sheet patterns**:

- Character sheets: `src/actors/actor.character.sheet.mjs`
- Item sheets: `src/items/item.{type}.sheet.mjs`
- Each sheet has corresponding Handlebars template in `src/templates/`

## Critical Areas - Handle with Care

### DataModels

Data models define document structure and computed properties. Changes here affect:

- Character/item sheets
- Data persistence
- Compendium imports
- Migration paths

**Before modifying**: Study existing similar fields and factory functions. Cross-reference with Foundry VTT documentation.

### Actions System

The Actions system (`src/common/actions.fields.mjs` + `src/rules-engines/action-resolver.mjs`) is particularly sensitive:

- Powers character abilities, attacks, saves
- Tightly coupled with chat cards and character sheets
- **Double-check all changes** against existing action implementations

### Configuration Files

**Never modify without approval**:

- `src/system.json` - Foundry system manifest
- `rollup.config.js` - Build system
- `babel.config.json` - Transpilation
- `package.json` - Dependencies (except during approved dependency updates)

## Development Workflow

### Making Changes

1. **Understand the context**: Read related code before making changes
2. **Check existing patterns**: Look for similar implementations in the codebase
3. **Cross-reference Foundry docs**: When working with Foundry APIs, verify against official docs
4. **Write JSDoc**: Document as you code, not after
5. **Test incrementally**: Build often (`npm run build`) and test in Foundry
6. **Run quality checks**: Always `npm run lint && npm test` before finishing

### Testing Strategy

- **Unit tests** (uvu): For rules engines, utilities, pure functions
- **Quench tests** (browser): For Foundry integration, sheets, UI
- **Manual testing**: Always test changes in running Foundry instance

### Common Tasks

#### Adding a Rule Variant

1. Create data file in `src/data/` (e.g., `osr.saving-throws.mjs`)
2. Define component matching category interface
3. Register in hook file (e.g., `src/hooks/bags.register-systems.osr.mjs`)
4. Setting auto-generates; no manual config needed

#### Adding a New Item Type

1. Create data model: `src/items/item.{type}.datamodel.mjs`
2. Create sheet: `src/items/item.{type}.sheet.mjs`
3. Create template: `src/templates/items/{type}.hbs`
4. Register in `src/hooks/init.items.mjs`
5. Add to `system.json` Item types

#### Modifying Existing Features

1. **Find similar code first** - Don't reinvent patterns
2. **Check both model and sheet** - Changes often need both
3. **Update templates** - Handlebars templates in `src/templates/`
4. **Test thoroughly** - Changes to core features affect multiple areas

## Production Readiness Checklist

Before considering any code production-ready:

- [ ] **Cross-referenced with existing similar code** - Patterns should be consistent
- [ ] **JSDoc comments written** - Targeted at junior developers, clear and helpful
- [ ] **Linter passes** - `npm run lint` with no errors
- [ ] **Unit tests pass** - `npm test` succeeds (if tests exist for modified area)
- [ ] **Tested in Foundry** - Changes verified in running instance
- [ ] **Foundry API usage verified** - Cross-checked against official Foundry VTT documentation when using Foundry APIs
- [ ] **No configuration files modified** - Unless explicitly approved
- [ ] **DataModel changes validated** - Extra scrutiny on schema changes

## Things NOT to Do

- ❌ **Never commit code** - Claude should not use Git commit commands
- ❌ **Don't modify build configs** without approval (rollup, babel, postcss)
- ❌ **Don't change system.json** without approval
- ❌ **Don't use CommonJS** - ES modules only
- ❌ **Don't skip JSDoc** - All code must be documented
- ❌ **Don't assume Foundry API behavior** - Always verify against docs
- ❌ **Don't create isolated patterns** - Follow existing code style
- ❌ **Don't modify Actions datamodel** without extreme caution and double-checking

## Getting Unstuck

When facing challenges:

1. **Check ARCHITECTURE.md** - Detailed technical reference
2. **Search for similar code** - Use grep to find existing patterns
3. **Read Foundry docs** - https://foundryvtt.com/api/
4. **Ask for clarification** - Request guidance rather than guessing
5. **Test incrementally** - Build and test small changes

## Key Files Reference

- `src/index.mjs` - System entry point, imports all hooks
- `src/config/system-registry.mjs` - Rule variant registry
- `src/config/constants.mjs` - System-wide constants
- `src/common/actions.fields.mjs` - Action system schema (CAUTION)
- `src/rules-engines/action-resolver.mjs` - Action resolution logic (TEST COVERAGE REQUIRED)
- `src/actors/actor.fields.mjs` - Actor schema factories
- `src/items/item.fields.mjs` - Item schema factories
- `src/hooks/` - Initialization hooks (run in import order)
- `src/templates/` - Handlebars templates

## Build System Notes

### Development Build

- Watch mode: `npm start`
- Source maps enabled
- No minification
- LiveReload on port 9999
- `__DEV__` flag = true

### Production Build

- Command: `npm run build`
- Terser minification
- CSS optimization (cssnano)
- Source maps included
- Assets copied to `dist/`
- `__DEV__` flag = false

### Output Structure

```
dist/
├── index.js          # System bundle (ESM)
├── components.js     # Web components bundle (ESM)
├── bags.css         # Compiled styles
├── templates/       # Handlebars templates
├── lang/           # Translations
├── assets/         # Static assets
└── system.json     # System manifest
```

## Success Criteria

You'll know you're working effectively on BAGS when:

- Code matches existing patterns and style
- JSDoc comments explain clearly without being condescending
- Changes build cleanly and pass linting
- Similar features work the same way
- Foundry VTT APIs are used correctly
- No unnecessary abstraction or over-engineering
- Code is maintainable by junior developers

---

**Remember**: BAGS is a foundation for others to build on. Code quality, consistency, and clarity are more important than clever solutions. When in doubt, ask rather than assume.
