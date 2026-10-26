/**
 * @file Works out who is surprised at the start of a fight, from each side's
 * surprise roll.
 *
 * Every game BAGS models rolls surprise the same way: each side rolls a die,
 * and a low enough result means that side was caught off guard. What being
 * surprised *costs* differs:
 *
 * - **The Basic/Expert family and 2nd Edition** -- a surprised side loses the
 *   first round. It does nothing until round two.
 * - **1st Edition** -- a surprised side loses a number of *segments* equal to
 *   the die, and the other side acts freely in them.
 *
 * Pure functions with no Foundry dependencies, so the arithmetic can be tested
 * without a running game.
 */

/**
 * What being surprised costs.
 * @readonly
 * @enum {string}
 */
export const SURPRISE_EFFECT = Object.freeze({
  /** The surprised side loses the whole first round. */
  ROUND: "round",
  /** The surprised side loses as many segments as its die showed. */
  SEGMENTS: "segments",
})

/**
 * One side's surprise roll.
 * @typedef {object} SurpriseRoll
 * @property {string} side - Which side rolled.
 * @property {number} total - What the die showed.
 */

/**
 * One side's surprise roll, with what it means.
 * @typedef {object} SurpriseResult
 * @property {string} side - Which side rolled.
 * @property {number} total - What the die showed.
 * @property {boolean} surprised - Whether this side was caught off guard.
 * @property {number} segments - How many segments this side loses. Always 0
 * when surprise costs a whole round instead.
 */

/**
 * Decide which sides are surprised.
 *
 * **When everyone is surprised, it cancels out.** Nobody gets a free moment
 * if nobody was watching. Under a lost round that means nobody loses it. Under
 * lost segments, the side that lost the fewest loses none, and everyone else
 * loses only the difference -- a side that lost 4 against one that lost 1 has
 * 3 segments of trouble, not 4.
 * @param {SurpriseRoll[]} rolls - One roll per side.
 * @param {object} rule - The ruleset's surprise rule.
 * @param {number} rule.surprisedOn - The highest roll that means surprised.
 * @param {string} rule.effect - One of SURPRISE_EFFECT.
 * @returns {SurpriseResult[]} One result per roll, in the same order.
 */
export const resolveSurprise = (rolls, { surprisedOn, effect }) => {
  const caught = rolls.map(({ side, total }) => ({
    side,
    total,
    surprised: Number.isFinite(total) && total <= surprisedOn,
  }))

  const everyone = caught.length > 0 && caught.every((roll) => roll.surprised)

  if (effect === SURPRISE_EFFECT.SEGMENTS) {
    const lost = caught.map((roll) => (roll.surprised ? roll.total : 0))
    const shared = everyone ? Math.min(...lost) : 0

    return caught.map((roll, index) => {
      const segments = lost[index] - shared
      return { ...roll, surprised: segments > 0, segments }
    })
  }

  return caught.map((roll) => ({
    ...roll,
    surprised: roll.surprised && !everyone,
    segments: 0,
  }))
}
