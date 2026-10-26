/**
 * @file Tests for deciding when monsters check morale, and whether they fail.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  MORALE_TRIGGER,
  failsMorale,
  moraleTriggers,
} from "../src/rules-engines/morale.mjs"

/**
 * A group with nothing remarkable about it, for tests to override.
 * @param {object} overrides - Fields to change.
 * @returns {object} A morale unit.
 */
const unit = (overrides = {}) => ({
  key: "group:orcs",
  size: 4,
  defeated: 0,
  importantDeath: false,
  canCheck: true,
  ...overrides,
})

// ============================================================================
// moraleTriggers
// ============================================================================

test("moraleTriggers: nothing is owed by a group at full strength", () => {
  assert.equal(moraleTriggers([unit()]), [])
})

test("moraleTriggers: half a group down calls for a check", () => {
  assert.equal(moraleTriggers([unit({ defeated: 2 })]), [
    {
      unit: "group:orcs",
      trigger: MORALE_TRIGGER.HALF,
      key: "group:orcs:half",
    },
  ])
})

test("moraleTriggers: less than half is not enough", () => {
  assert.equal(moraleTriggers([unit({ size: 5, defeated: 2 })]), [])
})

test("moraleTriggers: an important death calls for a check", () => {
  const [due] = moraleTriggers([unit({ defeated: 1, importantDeath: true })])
  assert.is(due.trigger, MORALE_TRIGGER.DEATH)
})

test("moraleTriggers: both at once are both owed", () => {
  const due = moraleTriggers([unit({ defeated: 2, importantDeath: true })])
  assert.equal(
    due.map((entry) => entry.trigger),
    [MORALE_TRIGGER.DEATH, MORALE_TRIGGER.HALF],
  )
})

test("moraleTriggers: a check already made is not owed again", () => {
  const due = moraleTriggers([unit({ defeated: 3 })], ["group:orcs:half"])
  assert.equal(due, [])
})

test("moraleTriggers: a group nobody can roll for owes nothing", () => {
  assert.equal(moraleTriggers([unit({ defeated: 4, canCheck: false })]), [])
})

test("moraleTriggers: groups are judged separately", () => {
  const due = moraleTriggers([
    unit({ key: "group:orcs", defeated: 2 }),
    unit({ key: "group:goblins", defeated: 1 }),
  ])
  assert.equal(
    due.map((entry) => entry.unit),
    ["group:orcs"],
  )
})

test("moraleTriggers: an empty group owes nothing", () => {
  assert.equal(moraleTriggers([unit({ size: 0 })]), [])
})

// ============================================================================
// failsMorale
// ============================================================================

test("failsMorale: rolling over the rating fails", () => {
  assert.is(failsMorale(9, 8), true)
})

test("failsMorale: rolling the rating holds", () => {
  assert.is(failsMorale(8, 8), false)
})

test("failsMorale: a rating of 12 never fails on 2d6", () => {
  assert.is(failsMorale(12, 12), false)
})

test("failsMorale: no rating means no failure", () => {
  assert.is(failsMorale(12, null), false)
  assert.is(failsMorale(Number.NaN, 7), false)
})

test.run()
