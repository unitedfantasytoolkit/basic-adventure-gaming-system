/**
 * @file Initiative rules modules for the Advanced games -- AD&D 1st and 2nd
 * Edition.
 *
 * These are the first modules BAGS ships that measure a round in **segments**,
 * and that changes what the roll means. In the Basic/Expert family a side's d6
 * is a contest: high wins, and everyone on the winning side goes first. Here the
 * roll is a *starting position*, offsets count upward from it, and segment 1
 * acts before segment 10.
 *
 * That is why both modules read `direction: "low"` even though 1st Edition's
 * side-initiative d6 is usually played as high-wins at the table. The two are
 * incompatible: `base + offset` is the only arithmetic the engine does, and
 * `direction` flips the comparison rather than the sum -- so under "high", a
 * casting time of 3 would make a spell resolve *sooner*. Segments are what these
 * editions are actually about, so segments win.
 *
 * See docs/design/combat-turn-sequence.md, section 3.
 */

import { resolveAttackRate, speedFactorFor } from "../combat/attack-rate.mjs"
import {
  ATTACK_SPACING,
  DEFAULT_ROUND_LENGTH,
  attackCountFor,
  clampSegment,
  segmentsForAttacks,
} from "../rules-engines/segments.mjs"
import { SURPRISE_EFFECT } from "../rules-engines/surprise.mjs"

/**
 * How far a combatant can move before it costs them a segment.
 *
 * One segment per ten feet. The distance itself is supplied when the action is
 * declared rather than read from the token, because declaring happens before
 * anyone has moved -- that is what declaring *is*.
 * @type {number}
 */
const FEET_PER_SEGMENT = 10

/**
 * Read a number a combatant supplied when declaring.
 * @param {object|null} declaration - The declaration, if there is one.
 * @param {string} name - Which of its values to read.
 * @returns {number} The value, or 0 when it is absent or nonsense.
 */
const declaredValue = (declaration, name) => {
  const value = declaration?.values?.[name]
  return Number.isFinite(value) ? value : 0
}

/**
 * Fields both Advanced modules share.
 */
const ADVANCED = {
  ruleset: "adnd",
  /**
   * Lower segments act first. See the file comment -- this is a modelling
   * decision about what the roll *means*, not a claim about how 1st Edition's
   * d6 is read at the table.
   */
  direction: "low",
  /** Segments are whole numbers; Foundry's default would render "4.00". */
  decimals: 0,
  /**
   * The reason this family needs everything the Basic/Expert family does not.
   * A side rolls once, and then a caster's spell and a fighter's sword land at
   * different moments -- so a side is not a block, and the tracker cannot step
   * past one in a single click.
   */
  perMemberOffsets: true,
  /** Ten segments to the round in both editions. */
  roundLength: DEFAULT_ROUND_LENGTH,
  /**
   * Says this ruleset has attack routines at all, which is what keeps the
   * spacing setting out of the combat tracker's config in a B/X world.
   */
  usesAttackRoutines: true,
  usesRateOfFire: true,
  /** What a table sees when it has not chosen a spacing strategy. */
  defaultAttackSpacing: ATTACK_SPACING.INITIATIVE,
  /**
   * 2d6 against the monster's morale rating, the way the Basic/Expert family
   * does it. 1st Edition's own check is a percentage built up from a list of
   * modifiers; a monster's 2-12 rating stands in for the result of that list.
   * 2nd Edition replaces this with its own scale.
   */
  morale: { formula: "2d6" },
  /**
   * Declarations that can run past the end of the round. A spell with a long
   * casting time, begun late, goes off in the *next* round -- and the caster
   * spends this one still casting. Swinging a sword is never that slow, so
   * only casting carries over.
   */
  carriesOver: ["bags.cast"],

  /**
   * Work out how far a combatant's action shifts them from their side's roll.
   *
   * Everything here counts upward: a bigger number means acting later in the
   * round.
   *
   * **Movement is added to whatever else was declared, not chosen instead of
   * it.** Closing to melee and then swinging is one of the most common things
   * anyone does in a fight, and the ground covered delays the swing. Only a
   * combatant who does nothing *but* move declares "move".
   * @param {object} context - Everything known about the combatant.
   * @param {Actor|null} context.actor - The actor, when there is one.
   * @param {object|null} context.declaration - What they said they would do.
   * @param {object} context.declarationType - The resolved declaration record.
   * @returns {number} Segments to add to the unit's roll.
   */
  getInitiativeOffset({ actor, declaration, declarationType }) {
    const movement = Math.ceil(
      declaredValue(declaration, "distance") / FEET_PER_SEGMENT,
    )

    switch (declarationType?.id) {
      case "bags.cast":
        return movement + declaredValue(declaration, "castingTime")

      // A weapon's speed factor is what decides who lands first between two
      // combatants who rolled the same segment, which is most of what makes
      // 2nd Edition's initiative its own thing. It applies to the swing, so a
      // spell being cast is not slowed by the sword on the caster's belt.
      case "bags.melee":
      case "bags.missile":
        return movement + speedFactorFor({ actor, declaration })

      default:
        return movement
    }
  },

  /**
   * Work out which segments a combatant's attacks land on.
   *
   * Two questions, answered in order: how many attacks does this rate give this
   * round, and where does the table's chosen strategy put them?
   *
   * Only the *first* segment ends up ordering the combatant in the tracker --
   * `turns` holds one row each -- but the whole array is what the round card's
   * segment ladder draws, which is where a fighter's second attack becomes
   * visible. See section 10.3 of the design document.
   * @param {object} context - Everything known about the combatant.
   * @param {Actor|null} context.actor - The actor, when there is one.
   * @param {object|null} context.declaration - What they said they would do.
   * @param {object} context.declarationType - The resolved declaration record.
   * @param {number} context.round - The round being resolved.
   * @param {number} context.segment - Where their roll and offset put them.
   * @param {string} [context.spacing] - The table's chosen strategy.
   * @returns {number[]} Ascending segments, one per attack.
   */
  getAttackRoutine({
    actor,
    declaration,
    declarationType,
    round,
    segment,
    spacing,
  }) {
    // Asked for rather than read off the actor, because a bow's rate of fire
    // answers this question instead of the wielder's attacks per round -- and
    // because that lookup is where weapon specialization will eventually land.
    const { rate } = resolveAttackRate({ actor, declaration, declarationType })

    return segmentsForAttacks({
      count: attackCountFor(rate, round),
      segment: clampSegment(segment, this.roundLength),
      strategy: spacing ?? this.defaultAttackSpacing,
      roundLength: this.roundLength,
    })
  },
}

/**
 * AD&D 1st Edition: a side rolls 1d6, and each member counts up from it.
 *
 * The d6 gives the side's starting segment. A caster adds their spell's casting
 * time to find the segment it goes off on, which is the mechanism the whole
 * offset system was built for.
 */
export const advancedFirstEditionInitiative = {
  ...ADVANCED,
  id: "advanced-1e",
  name: "AD&D, 1st Edition",
  formula: "1d6",
  rollingUnit: "group",
  /**
   * Each side rolls 1d6, and a 1 or 2 is a surprise -- but rather than losing
   * the round, a surprised side loses that many segments, and the other side
   * acts freely in them.
   */
  surprise: {
    formula: "1d6",
    surprisedOn: 2,
    effect: SURPRISE_EFFECT.SEGMENTS,
  },
}

/**
 * AD&D 2nd Edition: everyone rolls 1d10 for themselves, low first.
 *
 * Group initiative is an option in 2nd Edition rather than the default, so the
 * rolling unit differs from 1st Edition's while everything else is shared.
 */
export const advancedSecondEditionInitiative = {
  ...ADVANCED,
  id: "advanced-2e",
  name: "AD&D, 2nd Edition",
  formula: "1d10",
  rollingUnit: "individual",
  /**
   * Weapon properties these editions read, and the Basic/Expert family does not.
   *
   * Declared rather than assumed so the weapon sheet can offer a field only to
   * tables whose rules do something with it. A B/X referee has no use for a
   * speed factor, and asking them to fill one in is asking them to guess at a
   * number nothing will read.
   */
  usesWeaponSpeed: true,
  /**
   * Each side rolls 1d10, and a 1, 2 or 3 is a surprise. A surprised side
   * loses the first round.
   */
  surprise: { formula: "1d10", surprisedOn: 3, effect: SURPRISE_EFFECT.ROUND },
  /** Morale ratings run from 2 to 20, rolled against on 2d10. */
  morale: { formula: "2d10" },
}

export default [advancedFirstEditionInitiative, advancedSecondEditionInitiative]
