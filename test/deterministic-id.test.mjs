/**
 * @file Tests for stable document ids.
 *
 * These exist because the first version of this looked right and was not: `^`
 * returns a signed integer, so a negative remainder indexed off the front of the
 * alphabet and produced ids made of the word "undefined". Foundry discarded
 * those and assigned random ids instead, which silently defeated the
 * deduplication the whole thing exists for.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import deterministicId from "../src/utils/deterministic-id.mjs"

const VALID = /^[A-Za-z0-9]{16}$/

test("produces something Foundry will accept as an id", () => {
  assert.ok(VALID.test(deterministicId("bags.round:abc123:1")))
})

test("never produces 'undefined' from a negative index", () => {
  // The original bug, pinned directly: one seed in roughly two hit it, so a
  // spread of seeds is the check that matters.
  for (let i = 0; i < 500; i += 1) {
    const id = deterministicId(`bags.round:combat${i}:${i}`)
    assert.not.match(id, /undefined/, `seed ${i} produced "${id}"`)
    assert.ok(VALID.test(id), `seed ${i} produced "${id}"`)
  }
})

test("the same seed always gives the same id", () => {
  const seed = "bags.group:AbCdEfGhIjKlMnOp:hostile"
  assert.is(deterministicId(seed), deterministicId(seed))
})

test("different seeds give different ids", () => {
  const ids = new Set()
  for (let i = 0; i < 500; i += 1) {
    ids.add(deterministicId(`bags.round:combat:${i}`))
  }
  // Collisions are possible in principle; a run of 500 hitting one would mean
  // the spread is far worse than it should be.
  assert.is(ids.size, 500, "ids collided across 500 seeds")
})

test("rounds of one combat do not collide", () => {
  const combat = "8AYqwICRsbQ2bg0X"
  const ids = new Set()
  for (let round = 1; round <= 100; round += 1) {
    ids.add(deterministicId(`bags.round:${combat}:${round}`))
  }
  assert.is(ids.size, 100)
})

test("sides of one combat do not collide", () => {
  const combat = "8AYqwICRsbQ2bg0X"
  const ids = ["party", "hostile", "neutral"].map((side) =>
    deterministicId(`bags.group:${combat}:${side}`),
  )
  assert.is(new Set(ids).size, 3)
})

test("cards and groups of one combat do not collide", () => {
  const combat = "8AYqwICRsbQ2bg0X"
  assert.is.not(
    deterministicId(`bags.round:${combat}:1`),
    deterministicId(`bags.group:${combat}:1`),
  )
})

test("an empty seed still produces a valid id", () => {
  assert.ok(VALID.test(deterministicId("")))
})

test.run()
