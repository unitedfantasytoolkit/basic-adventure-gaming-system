/**
 * @file Tests for the round's movement budget.
 *
 * The allowance itself is not computed here -- `system.speed.encounter` is the
 * encumbrance module's answer, and recomputing it would let the two drift. What
 * these pin down is the arithmetic around it, and the handling of the states
 * Foundry's movement history can legitimately be in.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  movementBudgetFor,
  movementStatusFor,
  movementUsedBy,
} from "../src/combat/movement.mjs"

/**
 * A stand-in for a Combatant with a token and an actor.
 * @param {object} options - Fixture options.
 * @param {number} [options.encounter] - The actor's per-round allowance.
 * @param {Array} [options.history] - The token's movement waypoints.
 * @param {boolean} [options.token] - Whether there is a token at all.
 * @returns {object} A combatant-shaped object.
 */
const combatantWith = ({
  encounter = 40,
  history = [],
  token = true,
} = {}) => ({
  actor: { system: { speed: { encounter } } },
  token: token ? { movementHistory: history } : null,
})

// ============================================================================
// movementUsedBy
// ============================================================================

test("movementUsedBy: adds up the waypoints", () => {
  assert.is(
    movementUsedBy({ movementHistory: [{ cost: 5 }, { cost: 10 }] }),
    15,
  )
})

test("movementUsedBy: nothing recorded is nothing spent", () => {
  assert.is(movementUsedBy({ movementHistory: [] }), 0)
  assert.is(movementUsedBy(null), 0)
  assert.is(movementUsedBy({}), 0)
})

test("movementUsedBy: skips waypoints whose cost cannot be measured", () => {
  // Foundry defaults an unmeasured waypoint's cost to Infinity. Counting it
  // would read as "all movement spent, forever" the first time anyone was
  // teleported.
  const history = [{ cost: 5 }, { cost: Infinity }, { cost: 10 }]
  assert.is(movementUsedBy({ movementHistory: history }), 15)
})

test("movementUsedBy: tolerates a malformed waypoint", () => {
  const history = [{ cost: 5 }, {}, { cost: null }, { cost: "10" }]
  assert.is(movementUsedBy({ movementHistory: history }), 5)
})

// ============================================================================
// movementBudgetFor
// ============================================================================

test("movementBudgetFor: reads the encounter speed", () => {
  assert.is(movementBudgetFor(combatantWith({ encounter: 40 })), 40)
})

test("movementBudgetFor: no usable speed is no budget", () => {
  assert.is(movementBudgetFor(combatantWith({ encounter: 0 })), 0)
  assert.is(movementBudgetFor(null), 0)
  assert.is(movementBudgetFor({ actor: null }), 0)

  // Written out rather than built by the fixture, whose destructuring default
  // would quietly turn an absent speed back into the usual one.
  assert.is(movementBudgetFor({ actor: { system: { speed: {} } } }), 0)
  assert.is(movementBudgetFor({ actor: { system: {} } }), 0)
})

// ============================================================================
// movementStatusFor
// ============================================================================

test("movementStatusFor: reports what is left", () => {
  const status = movementStatusFor(
    combatantWith({ encounter: 40, history: [{ cost: 15 }] }),
  )

  assert.is(status.used, 15)
  assert.is(status.max, 40)
  assert.is(status.remaining, 25)
  assert.is(status.percent, 38)
  assert.is(status.exhausted, false)
  assert.is(status.over, false)
})

test("movementStatusFor: nothing to measure against draws nothing", () => {
  // The ordinary state of a monster whose sheet nobody filled in. A bar with no
  // denominator would be a bar that means nothing.
  assert.is(movementStatusFor(combatantWith({ encounter: 0 })), null)
  assert.is(movementStatusFor(null), null)
})

test("movementStatusFor: a combatant with no token has spent nothing", () => {
  const status = movementStatusFor(combatantWith({ token: false }))
  assert.is(status.used, 0)
  assert.is(status.remaining, 40)
})

test("movementStatusFor: spending exactly the allowance is exhausted, not over", () => {
  const status = movementStatusFor(
    combatantWith({ encounter: 40, history: [{ cost: 40 }] }),
  )

  assert.is(status.remaining, 0)
  assert.is(status.percent, 100)
  assert.is(status.exhausted, true)
  assert.is(status.over, false, "spending it all is the rules working")
})

test("movementStatusFor: overspending is capped for the bar but reported", () => {
  // A referee may want to rule on this, so it must not be silently clamped
  // into looking the same as spending exactly the allowance.
  const status = movementStatusFor(
    combatantWith({ encounter: 40, history: [{ cost: 55 }] }),
  )

  assert.is(status.remaining, 0, "nothing left is not a debt")
  assert.is(status.percent, 100, "the bar cannot overflow its track")
  assert.is(status.over, true)
})

test("movementStatusFor: fractional allowances are rounded for display", () => {
  // Encounter movement is a third of base speed, so a base 100 gives 33.333.
  const status = movementStatusFor(
    combatantWith({ encounter: 100 / 3, history: [{ cost: 10 }] }),
  )

  assert.is(status.max, 33.3)
  assert.is(status.remaining, 23.3)
})

test.run()
