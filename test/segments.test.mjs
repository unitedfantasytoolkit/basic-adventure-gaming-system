/**
 * @file Tests for segment placement and attack routines.
 *
 * This is the part of the AD&D work most likely to be argued about at a table,
 * which is exactly why it is pure and tested here rather than settled by poking
 * at a running game. The conventions pinned below are decisions, not deductions
 * -- see docs/design/combat-turn-sequence.md, section 5.8.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  ATTACK_SPACING,
  DEFAULT_ROUND_LENGTH,
  attackCountFor,
  clampSegment,
  overflowOf,
  segmentsForAttacks,
} from "../src/rules-engines/segments.mjs"

// ============================================================================
// clampSegment
// ============================================================================

test("clampSegment: leaves a segment inside the round alone", () => {
  assert.is(clampSegment(4), 4)
  assert.is(clampSegment(1), 1)
  assert.is(clampSegment(10), 10)
})

test("clampSegment: pulls a segment before the round up to the first", () => {
  // A dexterity adjustment on a roll of 1 lands here. Acting "before segment 1"
  // is not a thing the round has room for.
  assert.is(clampSegment(0), 1)
  assert.is(clampSegment(-4), 1)
})

test("clampSegment: pulls a segment past the round back to the last", () => {
  // A long casting time. Real AD&D spills this into the next round; v1 resolves
  // it last instead, which is the documented simplification.
  assert.is(clampSegment(14), 10)
  assert.is(clampSegment(999), 10)
})

test("clampSegment: honours a ruleset's own round length", () => {
  assert.is(clampSegment(9, 6), 6)
  assert.is(clampSegment(3, 6), 3)
})

test("clampSegment: a non-number resolves last rather than throwing", () => {
  assert.is(clampSegment(null), DEFAULT_ROUND_LENGTH)
  assert.is(clampSegment(undefined), DEFAULT_ROUND_LENGTH)
  assert.is(clampSegment(Number.NaN), DEFAULT_ROUND_LENGTH)
})

test("clampSegment: a nonsensical round length falls back to the default", () => {
  assert.is(clampSegment(99, 0), DEFAULT_ROUND_LENGTH)
  assert.is(clampSegment(99, Number.NaN), DEFAULT_ROUND_LENGTH)
})

// ============================================================================
// overflowOf
// ============================================================================

test("overflowOf: a segment inside the round has none", () => {
  assert.is(overflowOf(10), 0)
  assert.is(overflowOf(1), 0)
  assert.is(overflowOf(-3), 0)
})

test("overflowOf: past the end, says where it lands next round", () => {
  // Begun on 6, seven segments to cast: segment 3 of the next round.
  assert.is(overflowOf(13), 3)
  assert.is(overflowOf(11), 1)
})

test("overflowOf: can run more than a round ahead", () => {
  assert.is(overflowOf(25), 15)
})

test("overflowOf: honours a ruleset's own round length", () => {
  assert.is(overflowOf(8, 6), 2)
})

test("overflowOf: a non-number has none", () => {
  assert.is(overflowOf(null), 0)
  assert.is(overflowOf(Number.NaN), 0)
})

// ============================================================================
// attackCountFor
// ============================================================================

test("attackCountFor: a whole rate is the same every round", () => {
  assert.is(attackCountFor(1, 1), 1)
  assert.is(attackCountFor(1, 2), 1)
  assert.is(attackCountFor(2, 1), 2)
  assert.is(attackCountFor(2, 2), 2)
  assert.is(attackCountFor(3, 7), 3)
})

test("attackCountFor: 3/2 gives the extra attack on even rounds", () => {
  // The decided convention. Odd rounds get the floor.
  assert.is(attackCountFor(1.5, 1), 1)
  assert.is(attackCountFor(1.5, 2), 2)
  assert.is(attackCountFor(1.5, 3), 1)
  assert.is(attackCountFor(1.5, 4), 2)
})

test("attackCountFor: 5/2 follows the same convention", () => {
  assert.is(attackCountFor(2.5, 1), 2)
  assert.is(attackCountFor(2.5, 2), 3)
  assert.is(attackCountFor(2.5, 3), 2)
})

test("attackCountFor: round 0 yields the whole number", () => {
  // The state before `startCombat`. Nothing acts yet, so the fraction has no
  // round to belong to.
  assert.is(attackCountFor(1.5, 0), 1)
  assert.is(attackCountFor(2.5, 0), 2)
})

test("attackCountFor: a missing or absurd rate still yields one attack", () => {
  // Everyone in a fight acts. A monster with no rate on its sheet gets a turn.
  assert.is(attackCountFor(undefined, 1), 1)
  assert.is(attackCountFor(null, 1), 1)
  assert.is(attackCountFor(0, 1), 1)
  assert.is(attackCountFor(-3, 1), 1)
})

// ============================================================================
// segmentsForAttacks
// ============================================================================

test("segmentsForAttacks: 'initiative' puts every attack on the same segment", () => {
  assert.equal(
    segmentsForAttacks({
      count: 3,
      segment: 4,
      strategy: ATTACK_SPACING.INITIATIVE,
    }),
    [4, 4, 4],
  )
})

test("segmentsForAttacks: 'initiative-then-end' bunches the extras at the end", () => {
  // "On initiative and 10". A third attack lands at the end too, rather than
  // inventing a position between.
  assert.equal(
    segmentsForAttacks({
      count: 2,
      segment: 3,
      strategy: ATTACK_SPACING.INITIATIVE_THEN_END,
    }),
    [3, 10],
  )
  assert.equal(
    segmentsForAttacks({
      count: 3,
      segment: 3,
      strategy: ATTACK_SPACING.INITIATIVE_THEN_END,
    }),
    [3, 10, 10],
  )
})

test("segmentsForAttacks: 'spread' ignores the roll entirely", () => {
  // "Segments 1 and 10". This is the strategy that makes a multi-attack fighter
  // lead the tracker regardless of what their side rolled -- the surprising but
  // correct consequence recorded in the design doc.
  assert.equal(
    segmentsForAttacks({
      count: 2,
      segment: 7,
      strategy: ATTACK_SPACING.SPREAD,
    }),
    [1, 10],
  )
  assert.equal(
    segmentsForAttacks({
      count: 3,
      segment: 7,
      strategy: ATTACK_SPACING.SPREAD,
    }),
    [1, 6, 10],
  )
})

test("segmentsForAttacks: 'even' divides the round by the attack count", () => {
  assert.equal(
    segmentsForAttacks({ count: 2, segment: 4, strategy: ATTACK_SPACING.EVEN }),
    [5, 10],
  )
  assert.equal(
    segmentsForAttacks({ count: 3, segment: 4, strategy: ATTACK_SPACING.EVEN }),
    [3, 7, 10],
  )
})

test("segmentsForAttacks: one attack is the combatant's own segment, always", () => {
  // Every strategy here is a rule about where *extra* attacks go. Letting
  // `spread` or `even` apply to a single attack drags every ordinary combatant
  // onto segment 1 or segment 10 -- which makes initiative meaningless for
  // almost everyone in a fight, since most combatants have one attack most of
  // the time. It would also teleport a 3/2 fighter between rounds: their own
  // segment on odd rounds, segment 1 on even ones.
  Object.values(ATTACK_SPACING).forEach((strategy) => {
    assert.equal(
      segmentsForAttacks({ count: 1, segment: 6, strategy }),
      [6],
      `strategy: ${strategy}`,
    )
  })
})

test("segmentsForAttacks: a 3/2 fighter keeps their segment on odd rounds", () => {
  // The round-to-round consequence of the rule above, stated as the scenario it
  // actually protects: the same fighter, the same roll, two consecutive rounds.
  const odd = segmentsForAttacks({
    count: attackCountFor(1.5, 1),
    segment: 4,
    strategy: ATTACK_SPACING.SPREAD,
  })
  const even = segmentsForAttacks({
    count: attackCountFor(1.5, 2),
    segment: 4,
    strategy: ATTACK_SPACING.SPREAD,
  })

  assert.equal(odd, [4], "one attack, so their own segment")
  assert.equal(even, [1, 10], "two attacks, so the strategy applies")
})

test("segmentsForAttacks: an unknown strategy falls back to 'initiative'", () => {
  // The least surprising answer, and the only one that never invents a position
  // the table did not ask for.
  assert.equal(
    segmentsForAttacks({ count: 2, segment: 5, strategy: "nonsense" }),
    [5, 5],
  )
  assert.equal(segmentsForAttacks({ count: 2, segment: 5 }), [5, 5])
})

test("segmentsForAttacks: everything returned is inside the round", () => {
  const placed = segmentsForAttacks({
    count: 3,
    segment: 99,
    strategy: ATTACK_SPACING.INITIATIVE_THEN_END,
    roundLength: 6,
  })

  assert.equal(placed, [6, 6, 6])
  placed.forEach((segment) => {
    assert.ok(segment >= 1 && segment <= 6)
  })
})

test("segmentsForAttacks: results ascend, so the first is the earliest", () => {
  // The document's `turns` row sorts on the first segment, so this ordering is
  // load-bearing rather than cosmetic.
  const placed = segmentsForAttacks({
    count: 3,
    segment: 8,
    strategy: ATTACK_SPACING.SPREAD,
  })

  assert.equal(
    placed,
    [...placed].sort((a, b) => a - b),
  )
  assert.is(placed[0], 1)
})

test("segmentsForAttacks: a short round still places every attack", () => {
  const placed = segmentsForAttacks({
    count: 3,
    segment: 2,
    strategy: ATTACK_SPACING.SPREAD,
    roundLength: 6,
  })

  assert.is(placed.length, 3)
  assert.equal(placed, [1, 4, 6])
})

test.run()
