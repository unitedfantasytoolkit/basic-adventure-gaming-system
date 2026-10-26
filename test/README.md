# BAGS Test Suite

This directory contains unit tests for the Basic Adventure Gaming System.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (if you install a file watcher later)
# npm run test:watch
```

## Test Structure

### Unit Tests (`test/`)

Pure logic tests that don't require Foundry to run:

- `action-resolver.test.mjs` - Action resolution against a mock Foundry adapter:
  validation, roll comparisons, damage formulas, consumption, effects
- `character-creation-helpers.test.mjs` - Which creation steps a set of sources
  produces, whether a class is a legal choice, starting money
- `container-utils.test.mjs` - The rules for moving an item into or out of a container
- `container-weight.test.mjs` - How a container's carried weight is worked out
- `item-stacking.test.mjs` - Which items stack, and what merging and splitting do
- `turn-order.test.mjs` - Who acts in what order: roll direction, per-combatant
  offsets, unrolled combatants, keeping a group's members together, and whole
  scenarios for B/X side initiative and AD&D 2e individual initiative
- `mock-foundry-adapter.mjs` - Not a test: the stand-in for Foundry's document API

### Integration Tests (`src/quench/`)

Foundry-dependent tests, run in the browser with the
[Quench](https://github.com/Ethaks/FVTT-Quench) module. See
[src/quench/README.md](../src/quench/README.md) for what they cover and how to
run them.

The dividing line: if a test needs a document, a setting, a die roll, or the DOM,
it goes in `src/quench/`. If it doesn't, it goes here, because these run in
milliseconds and those don't.

## Writing Tests

We use [uvu](https://github.com/lukeed/uvu) for testing - it's fast, minimal, and ESM-native.

### Basic Test Structure

```javascript
import { test } from "uvu"
import * as assert from "uvu/assert"
import { MyClass } from "../src/my-module.mjs"

test("description of what this tests", () => {
  // Arrange
  const instance = new MyClass()

  // Act
  const result = instance.doSomething()

  // Assert
  assert.is(result, expectedValue)
})

test.run() // Don't forget this!
```

### Assertions

Common uvu assertions:

- `assert.is(actual, expected)` - Strict equality
- `assert.ok(value)` - Truthy
- `assert.not.ok(value)` - Falsy
- `assert.type(value, 'string')` - Type check
- `assert.throws(() => fn())` - Throws error

[Full assertion list](https://github.com/lukeed/uvu/blob/master/docs/api.assert.md)

## Test Coverage

Currently testing:

- ✅ Action validation, roll comparison, damage formulas, resource consumption
- ✅ Container rules and carried weight
- ✅ Item stacking, merging and splitting
- ✅ Character creation steps, class requisites and starting money

Covered by the Quench batches instead, because they need Foundry:

- Document operations and UUID resolution
- Chat message creation
- Active effect application
- Actual roll execution
- Sheet and web component rendering

## Philosophy

We extract pure logic into testable modules and keep Foundry I/O separate. This allows:

- Fast tests (under 10ms for 164 of them)
- No Foundry required
- Easy CI/CD integration
- Quick feedback during development
