/**
 * @file Segments: how many times a combatant acts in a round, and when.
 *
 * AD&D measures a round in segments rather than in "who won", and two questions
 * follow from that which the B/X family never has to ask:
 *
 * 1. **How many attacks does this combatant get this round?** Rates are 1, 3/2,
 *    2, 5/2, or 3, and a fractional rate spreads over two rounds -- so the answer
 *    depends on which round it is.
 * 2. **Which segments do those attacks land on?** Published practice varies, and
 *    the variation is a genuine table preference rather than an edition
 *    difference, so it is a setting rather than a rule.
 *
 * Like `turn-order.mjs`, this module is pure: plain numbers in, plain numbers
 * out, no Foundry, no clock, no dice. That matters more here than usual, because
 * this is the part of the initiative work most likely to be argued about, and an
 * argument is much easier to settle against a test than against a running game.
 *
 * See docs/design/combat-turn-sequence.md, sections 3 and 5.8.
 */

/**
 * How many segments a round lasts when a ruleset does not say.
 *
 * Both AD&D editions use ten. It is a constant here rather than a literal in the
 * strategies below so that a module running a shorter round changes one field on
 * its rules component instead of reimplementing the placement logic.
 * @type {number}
 */
export const DEFAULT_ROUND_LENGTH = 10

/**
 * Keep a segment inside the round.
 *
 * Segments can fall outside it in both directions: a dexterity adjustment on a
 * roll of 1 gives 0 or less, and a long casting time gives more than the round
 * holds. Within a round, a spell that would resolve past the end resolves
 * last; `overflowOf` says how far into the next round it belongs (§10.5).
 * @param {number} segment - The segment to constrain.
 * @param {number} [roundLength] - How many segments the round has.
 * @returns {number} A segment within `[1, roundLength]`.
 */
export const clampSegment = (segment, roundLength = DEFAULT_ROUND_LENGTH) => {
  const last = Math.max(1, Math.trunc(roundLength) || DEFAULT_ROUND_LENGTH)
  if (!Number.isFinite(segment)) return last
  return Math.min(Math.max(Math.round(segment), 1), last)
}

/**
 * How far past the end of the round a segment falls.
 *
 * A seven-segment spell begun on segment 6 goes off on segment 13 -- which is
 * segment 3 of the *next* round. This is that 3. A segment inside the round
 * has no overflow.
 * @param {number} segment - The segment, before clamping.
 * @param {number} [roundLength] - How many segments the round has.
 * @returns {number} The segment it lands on in the next round, or 0 when it
 * lands in this one.
 */
export const overflowOf = (segment, roundLength = DEFAULT_ROUND_LENGTH) => {
  const last = Math.max(1, Math.trunc(roundLength) || DEFAULT_ROUND_LENGTH)
  if (!Number.isFinite(segment)) return 0
  return Math.max(Math.round(segment) - last, 0)
}

/**
 * How many attacks a rate is worth in a given round.
 *
 * A rate of 3/2 means three attacks across two rounds. Which round gets the
 * extra one is a convention rather than a deduction, and BAGS settles it as
 * **even rounds**: 3/2 is one attack in round 1 and two in round 2; 5/2 is two
 * then three.
 *
 * Round 0 -- the state before `startCombat` -- yields the whole number, and a
 * combatant joining a fight halfway through simply inherits the world's round
 * parity. Neither is special-cased, because neither is worth the branch.
 * @param {number} rate - Attacks per round: 1, 1.5, 2, 2.5, 3.
 * @param {number} round - The current round number.
 * @returns {number} A whole number of attacks, never below 1.
 */
export const attackCountFor = (rate, round) => {
  if (!Number.isFinite(rate) || rate <= 0) return 1

  const whole = Math.floor(rate)
  const hasHalf = rate % 1 !== 0
  const isEvenRound = Number.isFinite(round) && round > 0 && round % 2 === 0

  return Math.max(1, whole + (hasHalf && isEvenRound ? 1 : 0))
}

/**
 * The ways a table can space a combatant's extra attacks across a round.
 *
 * Every published phrasing of this rule describes *two* attacks -- "segments 1
 * and 10", "on initiative and 10", "1 and on initiative" -- and none of them
 * says what a three-attack fighter does, or what a 3/2 fighter does in an odd
 * round when they only get one. So a strategy is a function of the count rather
 * than a pair of segments.
 * @type {Record<string, string>}
 */
export const ATTACK_SPACING = Object.freeze({
  /** Everything resolves on the declared segment. The simplest reading. */
  INITIATIVE: "initiative",
  /** The first on the segment, the rest at the end of the round. */
  INITIATIVE_THEN_END: "initiative-then-end",
  /** First and last segments, extras between. Ignores the roll entirely. */
  SPREAD: "spread",
  /** The round divided by the attack count. */
  EVEN: "even",
})

/**
 * Spread `count` values evenly across `[from, to]`, inclusive of both ends.
 * @param {number} count - How many values are wanted.
 * @param {number} from - The first value.
 * @param {number} to - The last value.
 * @returns {number[]} The spread values, rounded to whole segments.
 */
const spreadBetween = (count, from, to) => {
  if (count <= 1) return [from]

  const stride = (to - from) / (count - 1)
  return Array.from({ length: count }, (_, index) =>
    Math.round(from + stride * index),
  )
}

/**
 * Work out which segments a combatant's attacks land on.
 *
 * The returned array is ascending and has one entry per attack. Duplicates are
 * possible and are not an error: under `initiative` a three-attack fighter
 * resolves all three on the same segment, which is exactly what that strategy
 * means.
 * @param {object} options - The placement inputs.
 * @param {number} options.count - How many attacks, from `attackCountFor`.
 * @param {number} options.segment - The segment the combatant's roll put them on.
 * @param {string} [options.strategy] - One of `ATTACK_SPACING`. Anything
 * unrecognised falls back to `initiative`, which is the least surprising answer
 * and never invents a position the table did not ask for.
 * @param {number} [options.roundLength] - How many segments the round has.
 * @returns {number[]} Ascending segments, one per attack, each within the round.
 */
export const segmentsForAttacks = ({
  count,
  segment,
  strategy = ATTACK_SPACING.INITIATIVE,
  roundLength = DEFAULT_ROUND_LENGTH,
}) => {
  const last = Math.max(1, Math.trunc(roundLength) || DEFAULT_ROUND_LENGTH)
  const attacks = Math.max(1, Math.trunc(count) || 1)
  const first = clampSegment(segment, last)

  // A single attack always resolves on the combatant's own segment, whatever the
  // table's preference. Every one of these strategies is a rule about where
  // *extra* attacks go, and the two that ignore the roll would otherwise drag
  // every ordinary combatant onto segment 1 or segment 10 -- which is to say
  // they would make initiative meaningless for almost everyone in the fight,
  // since most combatants have one attack most of the time. A 3/2 fighter would
  // also teleport between rounds: segment 1 on even rounds, their own segment on
  // odd ones.
  if (attacks === 1) return [first]

  const placed = (() => {
    switch (strategy) {
      case ATTACK_SPACING.INITIATIVE_THEN_END:
        // The extras bunch at the end of the round rather than spreading, which
        // is what "and 10" says: a second and a third attack both land there.
        return [first, ...Array.from({ length: attacks - 1 }, () => last)]

      case ATTACK_SPACING.SPREAD:
        return spreadBetween(attacks, 1, last)

      case ATTACK_SPACING.EVEN:
        // Divide the round into `attacks` slices and act at the end of each, so
        // a two-attack fighter goes on 5 and 10 rather than on 1 and 6.
        return Array.from({ length: attacks }, (_, index) =>
          Math.round((last * (index + 1)) / attacks),
        )

      case ATTACK_SPACING.INITIATIVE:
      default:
        return Array.from({ length: attacks }, () => first)
    }
  })()

  return placed.map((value) => clampSegment(value, last)).sort((a, b) => a - b)
}
