/**
 * @file Tests for finding a combatant's weapon and attack rate.
 *
 * The rule these pin down: **a weapon's rate of fire and a character's attacks
 * per round are alternatives, never factors.** A fighter entitled to two attacks
 * does not get four with a bow that looses twice.
 *
 * Everything here reads plain properties off documents, so the fixtures are
 * plain objects. That is the point of keeping this module out of the rules
 * presets -- it is the piece most likely to be argued about, and arguing against
 * a test is cheaper than arguing against a running game.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  RATE_SOURCE,
  resolveAttackRate,
  speedFactorFor,
  weaponFor,
} from "../src/combat/attack-rate.mjs"

/**
 * A stand-in for an Item.
 * @param {object} system - The item's system data.
 * @param {string} [id] - Its id.
 * @returns {object} A weapon-shaped object.
 */
const weapon = (system, id = "w1") => ({ id, type: "weapon", system })

/**
 * A stand-in for an Actor, with a collection that answers what is used here.
 * @param {object[]} items - The actor's items.
 * @param {number} [attacksPerRound] - The actor's own rate.
 * @returns {object} An actor-shaped object.
 */
const actorWith = (items, attacksPerRound = 1) => ({
  system: { base: { attacksPerRound } },
  items: {
    get: (id) => items.find((item) => item.id === id) ?? null,
    filter: (fn) => items.filter(fn),
  },
})

// ============================================================================
// weaponFor
// ============================================================================

test("weaponFor: prefers the weapon the declaration names", () => {
  const named = weapon({ isEquipped: false }, "named")
  const held = weapon({ isEquipped: true }, "held")
  const actor = actorWith([named, held])

  assert.is(
    weaponFor({ actor, declaration: { itemId: "named" } }).id,
    "named",
    "a declared weapon beats a held one",
  )
})

test("weaponFor: falls back to the single equipped weapon", () => {
  // Declarations can bind to an item but the form does not offer the choice
  // yet, so this is the path that actually runs at a table today.
  const held = weapon({ isEquipped: true }, "held")
  const packed = weapon({ isEquipped: false }, "packed")
  const actor = actorWith([held, packed])

  assert.is(weaponFor({ actor, declaration: null }).id, "held")
})

test("weaponFor: two equipped weapons and no declaration resolves to nothing", () => {
  // Guessing would apply one dagger's speed factor to a two-handed sword's
  // swing. Refusing to answer is the honest option.
  const a = weapon({ isEquipped: true }, "a")
  const b = weapon({ isEquipped: true }, "b")

  assert.is(weaponFor({ actor: actorWith([a, b]), declaration: null }), null)
})

test("weaponFor: ignores a declaration naming something that is not a weapon", () => {
  const potion = { id: "potion", type: "item", system: {} }
  const held = weapon({ isEquipped: true }, "held")
  const actor = actorWith([potion, held])

  assert.is(weaponFor({ actor, declaration: { itemId: "potion" } }).id, "held")
})

test("weaponFor: no actor, no weapon", () => {
  assert.is(weaponFor({ actor: null, declaration: { itemId: "x" } }), null)
})

// ============================================================================
// resolveAttackRate
// ============================================================================

test("resolveAttackRate: a bow's rate replaces the wielder's attacks", () => {
  // The rule this file exists for. Two attacks per round and a rate of two is
  // two shots, not four.
  const bow = weapon({ isEquipped: true, rateOfFire: 2 })
  const actor = actorWith([bow], 2)

  const result = resolveAttackRate({
    actor,
    declaration: null,
    declarationType: { id: "bags.missile" },
  })

  assert.is(result.rate, 2)
  assert.is(result.source, RATE_SOURCE.WEAPON)
})

test("resolveAttackRate: a melee attack uses the character's rate", () => {
  // Even holding a bow. Rate of fire is about loosing it, not about clubbing
  // someone with it.
  const bow = weapon({ isEquipped: true, rateOfFire: 2 })
  const actor = actorWith([bow], 1.5)

  const result = resolveAttackRate({
    actor,
    declaration: null,
    declarationType: { id: "bags.melee" },
  })

  assert.is(result.rate, 1.5)
  assert.is(result.source, RATE_SOURCE.ACTOR)
})

test("resolveAttackRate: a missile weapon with no rate falls back to the actor", () => {
  const sling = weapon({ isEquipped: true, rateOfFire: 0 })
  const actor = actorWith([sling], 2)

  const result = resolveAttackRate({
    actor,
    declaration: null,
    declarationType: { id: "bags.missile" },
  })

  assert.is(result.rate, 2)
  assert.is(result.source, RATE_SOURCE.ACTOR)
})

test("resolveAttackRate: fractional rates survive unrounded", () => {
  // Turning 3/2 into a whole number depends on which round it is, which is
  // `attackCountFor`'s job. Rounding here would lose the fraction entirely.
  const bow = weapon({ isEquipped: true, rateOfFire: 1.5 })
  const result = resolveAttackRate({
    actor: actorWith([bow], 1),
    declaration: null,
    declarationType: { id: "bags.missile" },
  })

  assert.is(result.rate, 1.5)
})

test("resolveAttackRate: everyone attacks at least once", () => {
  // A monster with nothing filled in still gets a turn.
  const result = resolveAttackRate({
    actor: actorWith([], 0),
    declaration: null,
    declarationType: { id: "bags.melee" },
  })

  assert.is(result.rate, 1)
  assert.is(result.source, RATE_SOURCE.DEFAULT)
})

test("resolveAttackRate: no actor at all still yields one attack", () => {
  const result = resolveAttackRate({ actor: null, declaration: null })
  assert.is(result.rate, 1)
  assert.is(result.source, RATE_SOURCE.DEFAULT)
})

// ============================================================================
// speedFactorFor
// ============================================================================

test("speedFactorFor: reads the weapon in hand", () => {
  const sword = weapon({ isEquipped: true, speedFactor: 5 })
  assert.is(speedFactorFor({ actor: actorWith([sword]), declaration: null }), 5)
})

test("speedFactorFor: no identifiable weapon means no adjustment", () => {
  // Zero rather than a guess: applying some other weapon's speed to this swing
  // would be worse than applying none.
  const a = weapon({ isEquipped: true, speedFactor: 2 }, "a")
  const b = weapon({ isEquipped: true, speedFactor: 9 }, "b")

  assert.is(speedFactorFor({ actor: actorWith([a, b]), declaration: null }), 0)
  assert.is(speedFactorFor({ actor: null, declaration: null }), 0)
})

test("speedFactorFor: a weapon with no speed factor adds nothing", () => {
  // The ordinary state of a weapon written for a Basic/Expert game.
  const club = weapon({ isEquipped: true })
  assert.is(speedFactorFor({ actor: actorWith([club]), declaration: null }), 0)
})

test.run()
