/**
 * @file Tests for deciding who is surprised from each side's surprise roll.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  SURPRISE_EFFECT,
  resolveSurprise,
} from "../src/rules-engines/surprise.mjs"

const LOST_ROUND = { surprisedOn: 2, effect: SURPRISE_EFFECT.ROUND }
const LOST_SEGMENTS = { surprisedOn: 2, effect: SURPRISE_EFFECT.SEGMENTS }

// ============================================================================
// A lost round
// ============================================================================

test("lost round: a low roll surprises that side", () => {
  const [party, orcs] = resolveSurprise(
    [
      { side: "party", total: 5 },
      { side: "hostile", total: 2 },
    ],
    LOST_ROUND,
  )

  assert.is(party.surprised, false)
  assert.is(orcs.surprised, true)
})

test("lost round: the threshold itself is a surprise", () => {
  const [result] = resolveSurprise(
    [
      { side: "party", total: 3 },
      { side: "hostile", total: 9 },
    ],
    { ...LOST_ROUND, surprisedOn: 3 },
  )
  assert.is(result.surprised, true)
})

test("lost round: costs no segments", () => {
  const [result] = resolveSurprise(
    [
      { side: "party", total: 1 },
      { side: "hostile", total: 6 },
    ],
    LOST_ROUND,
  )
  assert.is(result.segments, 0)
})

test("lost round: everyone surprised means nobody is", () => {
  const results = resolveSurprise(
    [
      { side: "party", total: 1 },
      { side: "hostile", total: 2 },
    ],
    LOST_ROUND,
  )
  assert.ok(results.every((result) => !result.surprised))
})

test("lost round: keeps every roll for the card to show", () => {
  const results = resolveSurprise(
    [
      { side: "party", total: 1 },
      { side: "hostile", total: 2 },
    ],
    LOST_ROUND,
  )
  assert.equal(
    results.map((result) => result.total),
    [1, 2],
  )
})

// ============================================================================
// Lost segments
// ============================================================================

test("lost segments: a surprised side loses what its die showed", () => {
  const [party, orcs] = resolveSurprise(
    [
      { side: "party", total: 4 },
      { side: "hostile", total: 2 },
    ],
    LOST_SEGMENTS,
  )

  assert.equal(party, {
    side: "party",
    total: 4,
    surprised: false,
    segments: 0,
  })
  assert.equal(orcs, {
    side: "hostile",
    total: 2,
    surprised: true,
    segments: 2,
  })
})

test("lost segments: everyone surprised loses only the difference", () => {
  const [party, orcs] = resolveSurprise(
    [
      { side: "party", total: 1 },
      { side: "hostile", total: 2 },
    ],
    LOST_SEGMENTS,
  )

  assert.is(party.surprised, false)
  assert.is(party.segments, 0)
  assert.is(orcs.surprised, true)
  assert.is(orcs.segments, 1)
})

test("lost segments: an equal surprise cancels out", () => {
  const results = resolveSurprise(
    [
      { side: "party", total: 2 },
      { side: "hostile", total: 2 },
    ],
    LOST_SEGMENTS,
  )
  assert.ok(results.every((result) => !result.surprised))
  assert.ok(results.every((result) => result.segments === 0))
})

// ============================================================================
// Odd input
// ============================================================================

test("no rolls means nobody is surprised", () => {
  assert.equal(resolveSurprise([], LOST_ROUND), [])
  assert.equal(resolveSurprise([], LOST_SEGMENTS), [])
})

test("a side that did not roll is not surprised", () => {
  const [party, orcs] = resolveSurprise(
    [
      { side: "party", total: null },
      { side: "hostile", total: 1 },
    ],
    LOST_ROUND,
  )
  assert.is(party.surprised, false)
  assert.is(orcs.surprised, true)
})

test.run()
