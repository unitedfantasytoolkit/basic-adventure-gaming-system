/**
 * @file Tests for the declarable-action pool.
 *
 * The pool is the seam a third-party ruleset extends, so what is checked here is
 * mostly contract: that availability is decided by the type rather than by the
 * selected rules module, that a bare id is refused, and that the undeclared case
 * resolves to something rather than nothing.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  NO_DECLARATION,
  UNIVERSAL_DECLARATIONS,
  appliesToRuleset,
  blankDeclaration,
  buildDeclarationValueFields,
  isDeclarationDirty,
  getDeclarationFields,
  getDeclarationTypes,
  registerDeclarationType,
  registerUniversalDeclarations,
  resolveDeclarationType,
} from "../src/combat/declarations.mjs"

/**
 * The pool lives on `CONFIG.BAGS`, which only exists inside Foundry. A bare
 * object is enough for everything this module does.
 * @returns {void}
 */
const withEmptyPool = () => {
  globalThis.CONFIG = { BAGS: { declarationTypes: {} } }
}

/**
 * Stand in for `foundry.data.fields.NumberField`.
 *
 * Only the constructor options matter to anything under test -- this module
 * builds fields and reads their `initial` back, and never asks one to validate
 * anything. Keeping the fake this thin is deliberate: a richer imitation would
 * start testing itself.
 */
class FakeNumberField {
  /** @param {object} options - The field options. */
  constructor(options) {
    Object.assign(this, options)
  }
}

/**
 * Make the field constructors this module builds schemas from available.
 * @returns {void}
 */
const withFoundryFields = () => {
  globalThis.foundry = { data: { fields: { NumberField: FakeNumberField } } }
}

// ============================================================================
// appliesToRuleset
// ============================================================================

test("appliesToRuleset: a universal type belongs to every game", () => {
  assert.ok(appliesToRuleset({ appliesTo: "*" }, "bx"))
  assert.ok(appliesToRuleset({ appliesTo: "*" }, "advanced-1e"))
  assert.ok(appliesToRuleset({ appliesTo: "*" }, undefined))
})

test("appliesToRuleset: a scoped type belongs only to the games it names", () => {
  const charge = { appliesTo: ["advanced-1e", "osric"] }
  assert.ok(appliesToRuleset(charge, "osric"))
  assert.not.ok(appliesToRuleset(charge, "bx"))
})

test("appliesToRuleset: two presets of one game share its declarations", () => {
  // "bx-group" and "bx-individual" are two ways of playing one game, so they
  // carry the same `ruleset` and see the same declarations.
  const houseRule = { appliesTo: ["bx"] }
  assert.ok(appliesToRuleset(houseRule, "bx"))
})

test("appliesToRuleset: a malformed applicability excludes rather than throws", () => {
  assert.not.ok(appliesToRuleset({ appliesTo: "bx" }, "bx"))
  assert.not.ok(appliesToRuleset({}, "bx"))
})

// ============================================================================
// registerDeclarationType
// ============================================================================

test("registerDeclarationType: adds a type to the pool", () => {
  withEmptyPool()
  registerDeclarationType({ id: "osric.charge", appliesTo: ["osric"] })
  assert.is(resolveDeclarationType("osric.charge").id, "osric.charge")
})

test("registerDeclarationType: refuses a type with no id", () => {
  withEmptyPool()
  assert.throws(() => registerDeclarationType({}), /must have an id/)
})

test("registerDeclarationType: refuses a bare, unnamespaced id", () => {
  // Two modules shipping "charge" would silently clobber each other, and the
  // one that lost would be very hard to debug.
  withEmptyPool()
  assert.throws(() => registerDeclarationType({ id: "charge" }), /namespaced/)
})

test("registerDeclarationType: creates the pool if nothing has yet", () => {
  // A rules module registering during BAGS.RegisterSystems runs before the
  // combat hooks, so registration cannot assume the pool exists.
  globalThis.CONFIG = {}
  registerDeclarationType({ id: "zz.first", appliesTo: "*" })
  assert.is(resolveDeclarationType("zz.first").id, "zz.first")
})

test("registerDeclarationType: a later registration replaces an earlier id", () => {
  withEmptyPool()
  registerDeclarationType({ id: "zz.x", appliesTo: "*", label: "one" })
  registerDeclarationType({ id: "zz.x", appliesTo: "*", label: "two" })
  assert.is(resolveDeclarationType("zz.x").label, "two")
})

// ============================================================================
// resolveDeclarationType
// ============================================================================

test("resolveDeclarationType: an unknown id resolves to the undeclared record", () => {
  // The rules' offset hook is handed this, and should never have to null-check.
  withEmptyPool()
  assert.is(resolveDeclarationType("nope.missing").id, NO_DECLARATION.id)
  assert.is(resolveDeclarationType(undefined).id, NO_DECLARATION.id)
  assert.is(resolveDeclarationType("").id, NO_DECLARATION.id)
})

// ============================================================================
// getDeclarationTypes
// ============================================================================

test("getDeclarationTypes: offers the universal set to any game", () => {
  withEmptyPool()
  registerUniversalDeclarations()

  const ids = getDeclarationTypes("bx").map((t) => t.id)
  UNIVERSAL_DECLARATIONS.forEach((type) => assert.ok(ids.includes(type.id)))
})

test("getDeclarationTypes: never offers 'undeclared' as a choice", () => {
  // It is in the pool so the rules can reason about it, but presenting the
  // absence of a choice as a choice is a different matter.
  withEmptyPool()
  registerUniversalDeclarations()

  const ids = getDeclarationTypes("bx").map((t) => t.id)
  assert.not.ok(ids.includes(NO_DECLARATION.id))
})

test("getDeclarationTypes: keeps one game's declarations out of another's", () => {
  withEmptyPool()
  registerUniversalDeclarations()
  registerDeclarationType({
    id: "osric.charge",
    label: "Charge",
    appliesTo: ["advanced-1e", "osric"],
  })

  assert.not.ok(getDeclarationTypes("bx").some((t) => t.id === "osric.charge"))
  assert.ok(getDeclarationTypes("osric").some((t) => t.id === "osric.charge"))
})

test("getDeclarationTypes: a house rule extends a stock game without forking it", () => {
  // The point of making availability additive: this module never had to replace
  // the B/X initiative module to be seen by a B/X table.
  withEmptyPool()
  registerUniversalDeclarations()
  registerDeclarationType({
    id: "houserule.shieldWall",
    label: "Shield wall",
    appliesTo: ["bx"],
  })

  assert.ok(
    getDeclarationTypes("bx").some((t) => t.id === "houserule.shieldWall"),
  )
})

test("getDeclarationTypes: an empty pool yields nothing rather than throwing", () => {
  globalThis.CONFIG = {}
  assert.equal(getDeclarationTypes("bx"), [])
})

// ============================================================================
// Declaration fields
// ============================================================================

test("getDeclarationFields: a field narrows where its type does not", () => {
  // "Cast a spell" is universal, but a casting time is meaningless in B/X --
  // nothing there reads it. The field carries its own `appliesTo` so the type
  // does not have to be forked per edition just to vary what it asks for.
  withEmptyPool()
  registerUniversalDeclarations()

  assert.equal(getDeclarationFields("bags.cast", "bx"), [])
  assert.equal(
    getDeclarationFields("bags.cast", "adnd").map((f) => f.name),
    ["castingTime", "distance"],
  )
})

test("getDeclarationFields: movement is asked for alongside every action", () => {
  // A combatant does not choose between moving and acting -- closing to melee
  // and then swinging is one thing, and the ground covered delays the swing.
  withEmptyPool()
  registerUniversalDeclarations()

  const distanceOn = (typeId) =>
    getDeclarationFields(typeId, "adnd").some((f) => f.name === "distance")

  assert.ok(distanceOn("bags.melee"))
  assert.ok(distanceOn("bags.missile"))
  assert.ok(distanceOn("bags.cast"))
  assert.ok(distanceOn("bags.withdraw"))
})

test("getDeclarationFields: the action's own questions come first", () => {
  // Order is what the form renders, and the thing just chosen should read above
  // the thing asked of everybody.
  withEmptyPool()
  registerUniversalDeclarations()

  const [first] = getDeclarationFields("bags.cast", "adnd")
  assert.is(first.name, "castingTime")
})

test("getDeclarationFields: a type keeps its own take on a universal name", () => {
  // A deliberate override must not be quietly replaced by the general case.
  withEmptyPool()
  registerDeclarationType({
    id: "test.charge",
    label: "Charge",
    appliesTo: "*",
    fields: { distance: { label: "Charge distance", min: 10, max: 30 } },
  })

  const [distance] = getDeclarationFields("test.charge", "adnd")
  assert.is(distance.max, 30, "the type's own limits, not the universal ones")
})

test("getDeclarationFields: an unknown type still asks the universal questions", () => {
  // Universal fields do not depend on the type resolving -- an undeclared
  // combatant can still have moved.
  withEmptyPool()
  registerUniversalDeclarations()
  assert.equal(
    getDeclarationFields("nope.missing", "adnd").map((f) => f.name),
    ["distance"],
  )
  assert.equal(getDeclarationFields("nope.missing", "bx"), [])
})

test("getDeclarationFields: optional parts of a descriptor are filled in", () => {
  withEmptyPool()
  registerDeclarationType({
    id: "test.bare",
    label: "Bare",
    appliesTo: "*",
    fields: { count: { label: "Count" } },
  })

  const [field] = getDeclarationFields("test.bare", "bx")
  assert.is(field.min, 0)
  assert.is(field.max, 100)
  assert.is(field.step, 1)
  assert.is(field.integer, true)
  assert.is(field.initial, 0, "initial falls back to the minimum")
})

test("buildDeclarationValueFields: two types sharing a name share one field", () => {
  // The schema is fixed when the document class is first used, so it cannot
  // vary by which type is selected. A shared name has to accept either type's
  // range; the per-type limits are still applied by the form.
  withEmptyPool()
  withFoundryFields()
  registerDeclarationType({
    id: "test.a",
    label: "A",
    appliesTo: "*",
    fields: { distance: { label: "D", min: 0, max: 60 } },
  })
  registerDeclarationType({
    id: "test.b",
    label: "B",
    appliesTo: "*",
    fields: { distance: { label: "D", min: -10, max: 240 } },
  })

  const built = buildDeclarationValueFields()
  assert.is(Object.keys(built).length, 1, "one field, not two")
  assert.is(built.distance.min, -10, "widened to the lower minimum")
  assert.is(built.distance.max, 240, "widened to the higher maximum")
})

test("buildDeclarationValueFields: universal fields exist without any type", () => {
  // The schema is fixed when the document class is first used, so a world whose
  // declaration pool is empty still needs somewhere to keep a distance.
  withEmptyPool()
  withFoundryFields()
  registerDeclarationType({ id: "test.plain", label: "Plain", appliesTo: "*" })

  assert.equal(Object.keys(buildDeclarationValueFields()), ["distance"])
})

test("isDeclarationDirty: leftover numbers count, even with no type", () => {
  // The regression this pins. `clearDeclarations` used to select combatants by
  // testing `declaration.type`, so anything that emptied the type without naming
  // every value left the numbers behind -- in a declaration that reads as empty,
  // ready to be silently reapplied the next time that action was picked.
  withEmptyPool()
  withFoundryFields()
  registerUniversalDeclarations()

  assert.is(isDeclarationDirty(blankDeclaration()), false)
  assert.is(isDeclarationDirty(null), false)
  assert.is(
    isDeclarationDirty({ ...blankDeclaration(), type: "bags.cast" }),
    true,
  )

  const stale = blankDeclaration()
  stale.values.distance = 25
  assert.is(
    isDeclarationDirty(stale),
    true,
    "a distance with no action still needs clearing",
  )
})

test("isDeclarationDirty: a value at its own default is not dirty", () => {
  withEmptyPool()
  withFoundryFields()
  registerUniversalDeclarations()

  const clean = blankDeclaration()
  clean.values.distance = 0
  assert.is(isDeclarationDirty(clean), false)
})

test("blankDeclaration: names every value field, not just the type", () => {
  // The regression this pins: a Foundry update *merges* into a SchemaField, so
  // clearing a declaration by writing only `{type: ""}` leaves last round's
  // casting time in place to be reapplied the next time a spell is declared.
  withEmptyPool()
  withFoundryFields()
  registerUniversalDeclarations()

  const blank = blankDeclaration()
  assert.is(blank.type, "")
  assert.is(blank.actionId, "")
  assert.equal(blank.targetIds, [])
  assert.ok(
    "castingTime" in blank.values,
    "a cleared declaration must name the casting time it is clearing",
  )
  assert.ok("distance" in blank.values)
})

test.run()
