/**
 * @file Tests for the arithmetic behind learning a spell.
 *
 * The tables themselves belong to the rules modules; these are the parts that
 * behave the same wherever the numbers come from.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  hasRoomToLearn,
  hasSlotsAtLevel,
  learningLimitsForScore,
} from "../src/utils/spell-learning.mjs"

// === Test Helpers ============================================================

const TABLE = new Map([
  [9, { chance: 35, maxPerLevel: 6 }],
  [13, { chance: 45, maxPerLevel: 9 }],
  [18, { chance: 65, maxPerLevel: 18 }],
  [19, { chance: 70, maxPerLevel: null }],
])

// === learningLimitsForScore ==================================================

test("reads the row matching the score exactly", () => {
  assert.equal(learningLimitsForScore(TABLE, 13), {
    chance: 45,
    maxPerLevel: 9,
  })
})

test("reads the highest row the score reaches", () => {
  // 16 sits between the 13 and 18 rows, so it gets the 13 row.
  assert.equal(learningLimitsForScore(TABLE, 16), {
    chance: 45,
    maxPerLevel: 9,
  })
})

test("gives the top row to a score above the table", () => {
  assert.equal(learningLimitsForScore(TABLE, 25), {
    chance: 70,
    maxPerLevel: null,
  })
})

test("refuses a score below the table's floor", () => {
  assert.is(learningLimitsForScore(TABLE, 8), null)
  assert.is(learningLimitsForScore(TABLE, 3), null)
})

test("refuses a missing score or table", () => {
  assert.is(learningLimitsForScore(TABLE, undefined), null)
  assert.is(learningLimitsForScore(new Map(), 15), null)
  assert.is(learningLimitsForScore(undefined, 15), null)
})

// === hasSlotsAtLevel =========================================================

test("finds a slot at a level the class can cast", () => {
  assert.is(hasSlotsAtLevel([2, 1], 1), true)
  assert.is(hasSlotsAtLevel([2, 1], 2), true)
})

test("refuses a level beyond the class's slots", () => {
  assert.is(hasSlotsAtLevel([2, 1], 3), false)
  assert.is(hasSlotsAtLevel([], 1), false)
})

test("refuses a level whose slot count is zero", () => {
  assert.is(hasSlotsAtLevel([1, 0], 2), false)
})

test("survives missing slots", () => {
  assert.is(hasSlotsAtLevel(undefined, 1), false)
  assert.is(hasSlotsAtLevel([1], undefined), false)
})

// === hasRoomToLearn ==========================================================

test("allows another spell below the cap", () => {
  assert.is(hasRoomToLearn(5, 6), true)
})

test("refuses another spell at the cap", () => {
  assert.is(hasRoomToLearn(6, 6), false)
  assert.is(hasRoomToLearn(7, 6), false)
})

test("allows any number when there is no cap", () => {
  assert.is(hasRoomToLearn(40, null), true)
  assert.is(hasRoomToLearn(40, undefined), true)
})

test.run()
