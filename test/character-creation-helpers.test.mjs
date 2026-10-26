/**
 * @file Unit tests for the pure character creation logic.
 */
import { test } from "uvu"
import * as assert from "uvu/assert"

import {
  STEP_ORDER,
  getActiveSteps,
  getFirstLevelSpellSlots,
  resolveStartingGoldFormula,
  buildStartingHitPointsFormula,
  meetsPrerequisites,
  scoreClassFit,
  calculateCartTotal,
  calculateRemainingGold,
  addToCart,
} from "../src/actors/actor.character.creation-helpers.mjs"

// --- Test fixtures -----------------------------------------------------------

/**
 * Build a minimal class Item stand-in.
 * @param {object} system - The class's system data
 * @returns {object} A class-shaped object
 */
const makeClass = (system = {}) => ({ system })

/** A source list with one entry, enough to mark a category as configured. */
const oneSource = [{ id: "abc", type: "compendium" }]

const allSources = {
  classes: oneSource,
  equipment: oneSource,
  identity: oneSource,
  spells: oneSource,
  abilities: oneSource,
}

// === getActiveSteps ==========================================================

test("getActiveSteps always includes scores and details", () => {
  const steps = getActiveSteps({})
  assert.equal(steps, ["scores", "details"])
})

test("getActiveSteps treats missing and empty source lists the same", () => {
  assert.equal(getActiveSteps({}), getActiveSteps({ classes: [], spells: [] }))
})

test("getActiveSteps adds a step only when its category has sources", () => {
  const steps = getActiveSteps({ classes: oneSource, equipment: oneSource })
  assert.equal(steps, ["scores", "class", "equipment", "details"])
})

test("getActiveSteps returns steps in STEP_ORDER order", () => {
  // Deliberately declared out of order to prove the output is sorted by
  // STEP_ORDER rather than by key order in the sources object.
  const steps = getActiveSteps({
    equipment: oneSource,
    identity: oneSource,
    classes: oneSource,
  })
  assert.equal(steps, ["scores", "identity", "class", "equipment", "details"])

  const indices = steps.map((s) => STEP_ORDER.indexOf(s))
  assert.equal(
    indices,
    [...indices].sort((a, b) => a - b),
  )
})

test("getActiveSteps omits spells when no class is chosen", () => {
  const steps = getActiveSteps(allSources, null)
  assert.not.ok(steps.includes("spells"))
})

test("getActiveSteps omits spells for a class with no first level slots", () => {
  // A class that only gains slots at level 2 and beyond.
  const lateCaster = makeClass({ spellSlots: [[0, 1, 2]] })
  const steps = getActiveSteps(allSources, lateCaster)
  assert.not.ok(steps.includes("spells"))
})

test("getActiveSteps includes spells for a first level caster", () => {
  const caster = makeClass({ spellSlots: [[1, 2, 2]] })
  const steps = getActiveSteps(allSources, caster)
  assert.ok(steps.includes("spells"))
})

test("getActiveSteps omits spells when the class casts but sources are absent", () => {
  const caster = makeClass({ spellSlots: [[1, 2]] })
  const steps = getActiveSteps({ classes: oneSource }, caster)
  assert.not.ok(steps.includes("spells"))
})

test("getActiveSteps tolerates a null sources object", () => {
  assert.equal(getActiveSteps(null), ["scores", "details"])
})

// === getFirstLevelSpellSlots =================================================

test("getFirstLevelSpellSlots reads the first character level column", () => {
  const caster = makeClass({
    spellSlots: [
      [2, 3, 4],
      [0, 1, 2],
    ],
  })
  assert.equal(getFirstLevelSpellSlots(caster), [2, 0])
})

test("getFirstLevelSpellSlots returns an empty array for non-casters", () => {
  assert.equal(getFirstLevelSpellSlots(makeClass({})), [])
  assert.equal(getFirstLevelSpellSlots(null), [])
})

test("getFirstLevelSpellSlots coerces null slot values to zero", () => {
  const caster = makeClass({ spellSlots: [[null, 1], [undefined]] })
  assert.equal(getFirstLevelSpellSlots(caster), [0, 0])
})

// === resolveStartingGoldFormula ==============================================

test("resolveStartingGoldFormula falls back to the world formula", () => {
  assert.is(resolveStartingGoldFormula(makeClass({}), "3d6 * 10"), "3d6 * 10")
  assert.is(resolveStartingGoldFormula(null, "3d6 * 10"), "3d6 * 10")
})

test("resolveStartingGoldFormula prefers a formula set on the class", () => {
  const fighter = makeClass({ startingGold: "5d4 * 10" })
  assert.is(resolveStartingGoldFormula(fighter, "3d6 * 10"), "5d4 * 10")
})

test("resolveStartingGoldFormula ignores a blank class formula", () => {
  assert.is(
    resolveStartingGoldFormula(makeClass({ startingGold: "   " }), "3d6 * 10"),
    "3d6 * 10",
  )
})

test("resolveStartingGoldFormula trims a class formula", () => {
  assert.is(
    resolveStartingGoldFormula(
      makeClass({ startingGold: "  2d4 * 10  " }),
      "3d6 * 10",
    ),
    "2d4 * 10",
  )
})

// === buildStartingHitPointsFormula ===========================================

/**
 * Build a class with first level hit dice configured.
 * @param {object} hd - The hit dice record for the first XP table row
 * @param {number} hitDieSize - The class's hit die size
 * @returns {object} A class-shaped object
 */
const makeHitDiceClass = (hd, hitDieSize = 8) =>
  makeClass({ hitDieSize, xpTable: [{ hd }] })

test("buildStartingHitPointsFormula returns null without hit dice", () => {
  assert.is(buildStartingHitPointsFormula(null, 1), null)
  assert.is(buildStartingHitPointsFormula(makeClass({}), 1), null)
  assert.is(
    buildStartingHitPointsFormula(makeClass({ hitDieSize: 8 }), 1),
    null,
  )
})

test("buildStartingHitPointsFormula omits a zero bonus", () => {
  const cls = makeHitDiceClass({ count: 1, modifier: 0, canUseConMod: true })
  assert.is(buildStartingHitPointsFormula(cls, 0), "1d8")
})

test("buildStartingHitPointsFormula adds the constitution bonus", () => {
  const cls = makeHitDiceClass({ count: 1, modifier: 0, canUseConMod: true })
  assert.is(buildStartingHitPointsFormula(cls, 2), "1d8 + 2")
})

test("buildStartingHitPointsFormula ignores constitution when disallowed", () => {
  const cls = makeHitDiceClass({ count: 1, modifier: 0, canUseConMod: false })
  assert.is(buildStartingHitPointsFormula(cls, 3), "1d8")
})

test("buildStartingHitPointsFormula combines flat and constitution bonuses", () => {
  const cls = makeHitDiceClass({ count: 2, modifier: 1, canUseConMod: true }, 6)
  assert.is(buildStartingHitPointsFormula(cls, 2), "2d6 + 3")
})

test("buildStartingHitPointsFormula renders a negative total as subtraction", () => {
  const cls = makeHitDiceClass({ count: 1, modifier: 0, canUseConMod: true })
  assert.is(buildStartingHitPointsFormula(cls, -2), "1d8 - 2")
})

test("buildStartingHitPointsFormula defaults the die count to one", () => {
  const cls = makeHitDiceClass({ modifier: 0, canUseConMod: false }, 6)
  assert.is(buildStartingHitPointsFormula(cls, 0), "1d6")
})

// === meetsPrerequisites ======================================================

test("meetsPrerequisites passes when there are no requirements", () => {
  assert.ok(meetsPrerequisites({}, { str: 3 }))
  assert.ok(meetsPrerequisites(null, { str: 3 }))
})

test("meetsPrerequisites ignores zeroed requirements", () => {
  // An unset prerequisite is stored as 0 by the schema, not removed.
  assert.ok(meetsPrerequisites({ str: 0, dex: 0 }, { str: 3, dex: 3 }))
})

test("meetsPrerequisites compares against the minimum inclusively", () => {
  assert.ok(meetsPrerequisites({ str: 9 }, { str: 9 }))
  assert.not.ok(meetsPrerequisites({ str: 9 }, { str: 8 }))
})

test("meetsPrerequisites requires every listed ability", () => {
  assert.not.ok(meetsPrerequisites({ str: 9, dex: 12 }, { str: 15, dex: 8 }))
  assert.ok(meetsPrerequisites({ str: 9, dex: 12 }, { str: 15, dex: 12 }))
})

test("meetsPrerequisites treats a missing score as zero", () => {
  assert.not.ok(meetsPrerequisites({ str: 9 }, {}))
  assert.not.ok(meetsPrerequisites({ str: 9 }, null))
})

// === scoreClassFit ===========================================================

test("scoreClassFit returns -1 when prerequisites are not met", () => {
  const paladin = makeClass({ prerequisites: { cha: 17 } })
  assert.is(scoreClassFit(paladin, { cha: 10 }), -1)
})

test("scoreClassFit returns 0 for a legal class with no prime requisites", () => {
  assert.is(scoreClassFit(makeClass({}), { str: 12 }), 0)
})

test("scoreClassFit weights full prime requisites above half", () => {
  const scores = { str: 16, dex: 16 }
  const full = makeClass({ fullPrimeRequisites: { str: 13, isAnd: true } })
  const half = makeClass({ halfPrimeRequisites: { str: 13, isAnd: true } })

  assert.is(scoreClassFit(full, scores), 2)
  assert.is(scoreClassFit(half, scores), 1)
})

test("scoreClassFit honours isAnd on prime requisite groups", () => {
  const scores = { str: 16, dex: 8 }

  const needsBoth = makeClass({
    fullPrimeRequisites: { str: 13, dex: 13, isAnd: true },
  })
  const needsEither = makeClass({
    fullPrimeRequisites: { str: 13, dex: 13, isAnd: false },
  })

  assert.is(scoreClassFit(needsBoth, scores), 0)
  assert.is(scoreClassFit(needsEither, scores), 2)
})

test("scoreClassFit defaults to requiring all when isAnd is absent", () => {
  const scores = { str: 16, dex: 8 }
  const cls = makeClass({ fullPrimeRequisites: { str: 13, dex: 13 } })
  assert.is(scoreClassFit(cls, scores), 0)
})

test("scoreClassFit sums both prime requisite groups", () => {
  const cls = makeClass({
    fullPrimeRequisites: { str: 13, isAnd: true },
    halfPrimeRequisites: { con: 13, isAnd: true },
  })
  assert.is(scoreClassFit(cls, { str: 16, con: 16 }), 3)
})

test("scoreClassFit ranks a better-suited class higher", () => {
  const scores = { str: 16, int: 8 }
  const fighter = makeClass({ fullPrimeRequisites: { str: 13, isAnd: true } })
  const magicUser = makeClass({ fullPrimeRequisites: { int: 13, isAnd: true } })

  assert.ok(scoreClassFit(fighter, scores) > scoreClassFit(magicUser, scores))
})

// === Cart maths ==============================================================

test("calculateCartTotal multiplies cost by quantity", () => {
  const cart = [
    { cost: 10, quantity: 2 },
    { cost: 3, quantity: 5 },
  ]
  assert.is(calculateCartTotal(cart), 35)
})

test("calculateCartTotal handles an empty or invalid cart", () => {
  assert.is(calculateCartTotal([]), 0)
  assert.is(calculateCartTotal(null), 0)
})

test("calculateCartTotal treats missing cost or quantity as zero", () => {
  assert.is(calculateCartTotal([{ quantity: 3 }, { cost: 5 }]), 0)
})

test("calculateRemainingGold subtracts the cart from starting money", () => {
  assert.is(calculateRemainingGold(100, [{ cost: 10, quantity: 3 }]), 70)
})

test("calculateRemainingGold never returns a negative amount", () => {
  assert.is(calculateRemainingGold(10, [{ cost: 100, quantity: 1 }]), 0)
})

test("calculateRemainingGold handles no starting money", () => {
  assert.is(calculateRemainingGold(0, []), 0)
  assert.is(calculateRemainingGold(undefined, []), 0)
})

// === addToCart ===============================================================

test("addToCart appends a new entry", () => {
  const cart = addToCart([], { uuid: "a", cost: 5, quantity: 1 })
  assert.equal(cart, [{ uuid: "a", cost: 5, quantity: 1 }])
})

test("addToCart merges quantities for an item already in the cart", () => {
  const cart = addToCart([{ uuid: "a", cost: 5, quantity: 2 }], {
    uuid: "a",
    cost: 5,
    quantity: 3,
  })
  assert.equal(cart, [{ uuid: "a", cost: 5, quantity: 5 }])
})

test("addToCart defaults quantity to one", () => {
  const cart = addToCart([], { uuid: "a", cost: 5 })
  assert.is(cart[0].quantity, 1)
})

test("addToCart does not mutate the original cart", () => {
  const original = [{ uuid: "a", cost: 5, quantity: 1 }]
  const updated = addToCart(original, { uuid: "a", quantity: 1 })

  assert.is(original[0].quantity, 1)
  assert.is(updated[0].quantity, 2)
  assert.is.not(original, updated)
})

test("addToCart ignores an entry with no uuid", () => {
  const original = [{ uuid: "a", cost: 5, quantity: 1 }]
  assert.equal(addToCart(original, { cost: 9 }), original)
})

test("addToCart tolerates a non-array cart", () => {
  assert.equal(addToCart(null, { uuid: "a", quantity: 1 }), [
    { uuid: "a", quantity: 1 },
  ])
})

test.run()
