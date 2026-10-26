/**
 * @file The Combat document.
 *
 * Foundry's own combat machinery assumes every combatant rolls for itself. Four
 * of its methods quietly do the wrong thing once a group holds the roll, and
 * this class takes ownership of all of them. See section 7 of
 * docs/design/combat-turn-sequence.md.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"
import deterministicId from "../utils/deterministic-id.mjs"
import {
  orderEntries,
  phaseIndexOf,
  unitKeyOf,
} from "../rules-engines/turn-order.mjs"
import {
  DECLARATION_MODE,
  REROLL_CADENCE,
  TURN_GRANULARITY,
  resolveInitiativeConfig,
  safeSetting,
} from "./initiative-config.mjs"
import { blankDeclaration, isDeclarationDirty } from "./declarations.mjs"
import {
  postCombatEndCard,
  postRoundCard,
  refreshRoundCard,
} from "./round-card.mjs"
import { SIDES, SIDE_LABELS, sideFromDisposition } from "./sides.mjs"
import { PIN_SESSION_OPTION, SESSION_ID } from "./combatant-group.document.mjs"
import { SURPRISE_EFFECT, resolveSurprise } from "../rules-engines/surprise.mjs"
import { failsMorale } from "../rules-engines/morale.mjs"
import {
  MORALE_FAILURE_STATUS,
  MORALE_FLAG,
  canCheckMorale,
  dueMoraleChecks,
  moraleUnitOf,
  postMoraleCard,
  storedMorale,
} from "./morale.mjs"
import { CARRY_FLAG, carriesOutOf } from "./spillover.mjs"
import {
  SURPRISE_FLAG,
  losesTurnToSurprise,
  postSurpriseCard,
  storedSurprise,
} from "./surprise.mjs"

/**
 * Is this rolling unit a group, rather than a combatant rolling for itself?
 * @param {CombatantGroup|Combatant} unit - The unit to test.
 * @returns {boolean} True for a group.
 */
const isGroup = (unit) => unit instanceof foundry.documents.CombatantGroup

/**
 * The raw stored roll for a rolling unit.
 *
 * A group's `initiative` is a plain stored field. A combatant's is derived, so
 * reading it would fold in the offset that has already been applied.
 * @param {CombatantGroup|Combatant} unit - The unit to read.
 * @returns {number|null} The stored roll, or null if it has not rolled.
 */
const baseRollOf = (unit) => {
  const value = isGroup(unit) ? unit.initiative : unit._source.initiative
  return Number.isFinite(value) ? value : null
}

/**
 * The raw roll behind a combatant's place in the order.
 *
 * Read from the combatant's rolling unit, and from source rather than from the
 * prepared `initiative`, which is the offset-adjusted result. Feeding that back
 * in would apply the offset a second time.
 * @param {Combatant} combatant - The combatant to score.
 * @returns {number|null} The unit's roll, or null if it has not rolled.
 */
const baseInitiativeFor = (combatant) =>
  baseRollOf(combatant.rollingGroup ?? combatant)

/**
 * The key identifying which rolling unit a combatant belongs to.
 * @param {Combatant} combatant - The combatant to identify.
 * @returns {string} A key shared by every combatant that rolled together.
 */
const unitKeyFor = (combatant) =>
  unitKeyOf({
    combatantId: combatant.id,
    groupId: combatant.rollingGroup?.id ?? null,
  })

/**
 * Sound the dice for a set of initiative rolls.
 *
 * These rolls used to post a chat card of their own. The round card now carries
 * the same scores in a form that says what they mean, so the card was two
 * things saying one thing -- but the dice should still be audible, which is the
 * only part of it worth keeping.
 * @returns {void}
 */
const soundInitiativeDice = () => {
  const src = CONFIG.sounds?.dice
  if (src) game.audio.play(src, { context: game.audio.interface })
}

/**
 * Options that stop a bulk initiative write from firing turn events.
 *
 * Clearing and re-rolling every score churns the turn order, and without this
 * each intermediate state would dispatch start- and end-of-turn events for
 * whichever combatant momentarily sorted into the cursor's position.
 *
 * Returns a fresh object every time, and is emphatically not a frozen constant:
 * Foundry writes its own bookkeeping onto the operation object it is handed
 * (`parent`, `pack`, and more), so a shared or frozen one throws.
 * @returns {object} Options for a database write.
 */
const silentWrite = () => ({ turnEvents: false })

/**
 * The update option that marks the write beginning a round.
 *
 * Read by `_onUpdate` on every client, which is why it travels as an option:
 * options are broadcast with the update, so each client knows to dispatch the
 * round boundary rather than reading it as a rewind.
 * @type {string}
 */
const BEGIN_ROUND = "bagsBeginRound"

/**
 * The flag recording where the previous round stopped, written as the encounter
 * goes between rounds. See `BAGSCombat#closingState`.
 * @type {string}
 */
const CLOSING_STATE_FLAG = "closingState"

/**
 * The flag holding the last closed round's declarations and rolls, so that
 * stepping back into that round can put them back. See `BAGSCombat#previousRound`.
 * @type {string}
 */
const REWIND_FLAG = "rewind"

/**
 * Where the cursor is before a fight has begun: no round, and nobody's turn.
 * @type {object}
 */
const BEFORE_THE_FIGHT = Object.freeze({
  round: 0,
  turn: null,
  combatantId: null,
  tokenId: null,
})

/**
 * The name of the query a player's client sends the GM to open the next round.
 * Registered in `init.combat.mjs`.
 * @type {string}
 */
export const NEXT_ROUND_QUERY = `${SYSTEM_NAME}.nextRound`

/**
 * Per-combat cache of the resolved initiative configuration.
 *
 * Deliberately a module-level WeakMap rather than a private class field. Class
 * fields are initialised *after* `super()` returns, but the Document constructor
 * calls `_initialize()` -- and therefore `prepareBaseData()` -- from inside
 * `super()`. A private field read at that moment does not exist yet and throws
 * "Private element is not present on this object", which Foundry catches and
 * reports as a data preparation failure. `Combat#clone()` hits this on every
 * call, which is how group updates found it.
 * @type {WeakMap<Combat, object>}
 */
const configCache = new WeakMap()

/**
 * What the last unit-granularity step stepped over, per combat.
 *
 * Written by `nextTurn` and read by the turn events that step triggers, so they
 * can tell a turn played in one click from one genuinely skipped. Foundry's own
 * `Combat#previous` cannot answer that: it is not reliably the pre-move cursor
 * when the events run -- immediately after `startCombat` it is still the initial
 * `{combatantId: null, round: 0}`, and the correction silently does nothing.
 *
 * A WeakMap for the same reason `configCache` is one: see above.
 * @type {WeakMap<Combat, {unit: string, round: number}>}
 */
const steppedPast = new WeakMap()

/**
 * Drop every combat's cached configuration and redraw.
 *
 * The cache is cleared in `prepareBaseData`, which covers any change to a combat
 * document. It does not cover the world settings the configuration also reads:
 * changing one of those fires no document update, so nothing re-prepares and the
 * stale answer survives. Settings call this from their `onChange`.
 *
 * Re-preparing is not enough on its own: Foundry only builds the turn order
 * during preparation when there is none yet, so the combatants would pick up
 * their new scores while staying in the old order. Switching to a ruleset where
 * low rolls act first would leave the order backwards until something else
 * happened to re-sort it.
 * @returns {void}
 */
export const invalidateInitiativeConfig = () => {
  game.combats?.forEach((combat) => {
    combat.reset()
    combat.setupTurns()
  })
  ui.combat?.render()
}

/**
 * A combat encounter in which the thing that rolls initiative may be a group.
 */
export default class BAGSCombat extends foundry.documents.Combat {
  /**
   * Which rules this encounter is being run under.
   *
   * Cached because data preparation asks for it once per combatant per render,
   * and resolving it reads a world setting. The cache is dropped at the start of
   * every preparation cycle, which is also what makes it correct: any change to
   * the combat document re-prepares it.
   * @type {import("./initiative-config.mjs").ResolvedInitiativeConfig}
   */
  get initiativeConfig() {
    let config = configCache.get(this)
    if (!config) {
      config = resolveInitiativeConfig(this)
      configCache.set(this, config)
    }
    return config
  }

  /** @inheritDoc */
  prepareBaseData() {
    configCache.delete(this)
    super.prepareBaseData()
  }

  // ===========================================================================
  // ROLLING UNITS
  // ===========================================================================

  /**
   * Everything that rolls its own initiative: every group, plus every combatant
   * that is not in one.
   *
   * This is the level the dice are rolled at. It is not the level the turn order
   * is built at -- members of one unit can act at different moments -- so this
   * is used for rolling and nothing else.
   * @type {Array<CombatantGroup|Combatant>}
   */
  get rollingUnits() {
    const ungrouped = this.combatants.filter(
      (combatant) => !combatant.rollingGroup,
    )
    return [...this.groups, ...ungrouped]
  }

  /**
   * Find the rolling unit a combatant belongs to.
   * @param {Combatant} combatant - The combatant to look up.
   * @returns {CombatantGroup|Combatant} Its group, or the combatant itself.
   */
  static unitFor(combatant) {
    return combatant.rollingGroup ?? combatant
  }

  // ===========================================================================
  // TURN ORDER
  // ===========================================================================

  /**
   * Build the ordered list of turns.
   *
   * Overriding this rather than `_sortCombatants` is not a stylistic choice.
   * Foundry calls the comparator as `contents.sort(this._sortCombatants)` -- an
   * unbound reference, so inside it `this` is undefined and it can reach neither
   * the groups nor the selected rules. A pairwise comparator also cannot express
   * ordering that depends on the round.
   *
   * Core's bookkeeping around the sort is kept verbatim; only the sort changes.
   * @override
   * @returns {Combatant[]} The combatants, in the order they act.
   */
  setupTurns() {
    this.turns ||= []

    const { phases } = this.initiativeConfig
    const entries = this.combatants.contents.map((combatant, index) => ({
      combatantId: combatant.id,
      groupId: combatant.rollingGroup?.id ?? null,
      base: baseInitiativeFor(combatant),
      offset: combatant.initiativeOffset,
      // A position the ruleset chose rather than derived. Null in the
      // Basic/Expert family, where `base + offset` is the whole story -- and
      // null rather than absent so that a `BAGS.prepareTurnOrder` handler can
      // see the field and set it, which is the only way a module can move a row
      // outright instead of nudging it.
      segment: combatant.placedSegment,
      // Which step of the unit's turn this combatant acts in, from what they
      // declared. Orders members within a unit, never one unit against
      // another; see `orderEntries`.
      phaseIndex: phaseIndexOf(combatant.declarationType.id, phases),
      stableIndex: index,
    }))

    /**
     * Let modules inspect or amend the turn order before it is sorted.
     *
     * Handlers mutate the array in place; the return value is ignored. This is
     * the seam that lets two modules cooperate on ordering without either having
     * to be the one selected initiative module.
     * @fires BAGS.prepareTurnOrder
     */
    Hooks.callAll("BAGS.prepareTurnOrder", this, entries)

    const ordered = orderEntries(entries, this.initiativeConfig.turnOrder)
    const turns = ordered.map((entry) => this.combatants.get(entry.combatantId))

    /* --- Core's bookkeeping, copied verbatim ---------------------------------
     * Everything below is Foundry's own logic from `Combat#setupTurns`. Only the
     * sort above differs. `turnNumber` is written onto each combatant because
     * that is the contract core establishes and the tracker reads.
     */
    /* eslint-disable no-param-reassign */
    if (this.turn !== null) {
      if (this.turn < 0) this.turn = 0
      else if (this.turn >= turns.length) {
        this.turn = 0
        this.round += 1
      }
      turns.forEach((combatant, index) => {
        combatant.turnNumber = index
      })
    }
    /* eslint-enable no-param-reassign */

    this.current = this._getCurrentState(turns[this.turn])
    if (!this.previous) this.previous = this.current

    this.turns = turns
    return this.turns
  }

  // ===========================================================================
  // TURN CURSOR
  // ===========================================================================

  /**
   * Advance to the next turn.
   *
   * Under unit granularity the cursor steps past every remaining member of the
   * current unit in one move, because a fight between four characters and six
   * orcs is two decisions and should not cost ten clicks to play out.
   *
   * Skipping the cursor does not skip the lifecycle: Foundry walks every index
   * between the old and new turn and fires start- and end-of-turn events for
   * each, so region events and effect durations still happen per combatant.
   *
   * Between rounds there is no turn to advance from, so for a referee this
   * begins the waiting round instead -- the "next turn" is its first one.
   *
   * Honours Skip Defeated the way core does: the cursor lands on the next unit's
   * first member still standing, and a unit with nobody left standing gets no
   * stop at all. Combatants who lose the first round to surprise are passed
   * over the same way, which is why stepping one combatant at a time is
   * written out here too rather than left to core.
   * @override
   * @returns {Promise<this>} This combat.
   */
  async nextTurn() {
    if (this.betweenRounds) return game.user.isGM ? this.beginRound() : this
    if (this.round === 0) return this.nextRound()

    const current = this.turns[this.turn ?? -1]
    if (!current) return super.nextTurn()

    const byUnit = this.initiativeConfig.granularity === TURN_GRANULARITY.UNIT

    // Key on the rolling unit, not on the group. Two ungrouped combatants both
    // have a null group, and treating that as "the same unit" would collapse an
    // entire individual-initiative combat into a single stop.
    const currentUnit = unitKeyFor(current)

    const nextIndex = this.turns.findIndex(
      (combatant, index) =>
        index > this.turn &&
        (!byUnit || unitKeyFor(combatant) !== currentUnit) &&
        this.#canTakeTurn(combatant),
    )

    if (nextIndex === -1) return this.nextRound()

    // Remember what this step is stepping past, so the turn events it triggers
    // can tell "played in one click" from "genuinely skipped". Recorded here
    // rather than inferred later from `Combat#previous`, which is not reliably
    // the pre-move cursor by the time those events run -- immediately after
    // `startCombat` it is still the initial `{combatantId: null, round: 0}`.
    if (byUnit) steppedPast.set(this, { unit: currentUnit, round: this.round })

    const advanceTime = this.getTimeDelta(
      this.round,
      this.turn,
      this.round,
      nextIndex,
    )
    const updateData = { round: this.round, turn: nextIndex }
    const updateOptions = { direction: 1, worldTime: { delta: advanceTime } }

    Hooks.callAll("combatTurn", this, updateData, updateOptions)
    await this.#pinWrite
    await this.update(updateData, updateOptions)

    return this
  }

  // ===========================================================================
  // ROLLING
  // ===========================================================================

  /**
   * Roll initiative for a set of rolling units.
   *
   * Foundry's own `rollInitiative` writes one score per combatant and posts one
   * chat card each -- ten dice and ten cards for a fight that needs two. This
   * rolls once per unit and reports the whole thing in a single message.
   * @param {Array<CombatantGroup|Combatant>} units - The units to roll for.
   * @param {object} [options] - Options.
   * @param {string} [options.formula] - Override the ruleset's formula.
   * @returns {Promise<this>} This combat.
   */
  async rollUnitInitiative(units, { formula } = {}) {
    if (!units.length) return this

    const expression = formula || this.initiativeConfig.formula

    /**
     * Let a module veto a unit's roll -- for a side that is surprised, say, or
     * one whose initiative some other rule has already decided.
     *
     * Dispatched with `call` rather than `callAll` precisely so that returning
     * false cancels; the unit keeps whatever base it already had.
     * @fires BAGS.rollInitiative
     */
    const rolling = units.filter(
      (unit) => Hooks.call("BAGS.rollInitiative", this, unit) !== false,
    )
    if (!rolling.length) return this

    const results = await Promise.all(
      rolling.map(async (unit) => {
        // A group has no single actor to draw roll data from, so formulas that
        // reference actor values only mean anything for individual rolls.
        const rollData = isGroup(unit) ? {} : (unit.actor?.getRollData() ?? {})
        const roll = foundry.dice.Roll.create(expression, rollData)
        await roll.evaluate()
        return { unit, roll }
      }),
    )

    const toUpdate = ({ unit, roll }) => ({
      _id: unit.id,
      initiative: roll.total,
    })
    const groupUpdates = results.filter((r) => isGroup(r.unit)).map(toUpdate)
    const soloUpdates = results.filter((r) => !isGroup(r.unit)).map(toUpdate)

    if (groupUpdates.length) {
      await this.updateEmbeddedDocuments(
        "CombatantGroup",
        groupUpdates,
        silentWrite(),
      )
    }
    if (soloUpdates.length) {
      await this.updateEmbeddedDocuments(
        "Combatant",
        soloUpdates,
        silentWrite(),
      )
    }

    soundInitiativeDice()

    return this
  }

  /** @inheritDoc */
  async rollInitiative(ids, options = {}) {
    const requested = (typeof ids === "string" ? [ids] : ids) ?? []

    // Rolling "for a combatant" means rolling for whatever unit it belongs to.
    // Two members of one group asked to roll is still one roll.
    const units = new Set(
      requested
        .map((id) => this.combatants.get(id))
        .filter(Boolean)
        .map((combatant) => BAGSCombat.unitFor(combatant)),
    )

    return this.rollUnitInitiative([...units], options)
  }

  /**
   * Roll for every unit, whether or not it has rolled already.
   *
   * Two departures from Foundry, and the second is the interesting one.
   *
   * Foundry filters on `combatant.initiative === null`, which stops meaning
   * anything useful once initiative is derived: a grouped combatant's score is
   * non-null the instant its group rolls, whether or not that combatant was
   * asked for.
   *
   * It also means "roll the ones that have not rolled" -- so once a round is
   * under way the header's Roll All button silently does nothing, and there is
   * no way to roll again without first clearing every score by hand. **Every
   * ruleset BAGS models rerolls initiative each round**, so rerolling is the
   * ordinary operation rather than an exceptional one, and a labelled button the
   * GM deliberately pressed is clear enough intent to act on. Roll All therefore
   * rerolls. Roll NPCs does not; see {@link rollNPC}.
   * @override
   * @param {object} [options] - Options forwarded to the roll.
   * @returns {Promise<this>} This combat.
   */
  async rollAll(options) {
    return this.rollUnitInitiative(this.rollingUnits, options)
  }

  /**
   * Roll for every unit made up entirely of non-player characters that has not
   * rolled yet.
   *
   * Unlike Roll All, this fills gaps rather than rerolling. The button exists so
   * a referee can roll for the monsters while the players roll their own, and
   * pressing it after one side of orcs has already rolled should not quietly
   * change that roll. Rounds roll anyone still missing when they begin, so a
   * reroll is never what this button is needed for.
   * @override
   * @param {object} [options] - Options forwarded to the roll.
   * @returns {Promise<this>} This combat.
   */
  async rollNPC(options) {
    const units = this.rollingUnits.filter((unit) => {
      if (baseRollOf(unit) !== null) return false
      const members = isGroup(unit) ? [...unit.members] : [unit]
      return members.length > 0 && members.every((member) => member.isNPC)
    })
    return this.rollUnitInitiative(units, options)
  }

  /**
   * Clear every initiative score.
   *
   * Foundry's version iterates combatants only and never touches groups, so
   * under group initiative it clears values that are immediately re-derived from
   * the untouched group -- the button appears to do nothing at all.
   * @override
   * @returns {Promise<this>} This combat.
   */
  async resetAll() {
    const clear = (document) => ({ _id: document.id, initiative: null })

    if (this.groups.size) {
      await this.updateEmbeddedDocuments(
        "CombatantGroup",
        this.groups.map(clear),
        silentWrite(),
      )
    }
    if (this.combatants.size) {
      await this.updateEmbeddedDocuments(
        "Combatant",
        this.combatants.map(clear),
        silentWrite(),
      )
    }

    return this
  }

  /**
   * Set a single combatant's initiative by hand.
   *
   * Writes to the combatant's rolling unit, since that is where the number that
   * actually orders the round lives.
   * @override
   * @param {string} id - The combatant's id.
   * @param {number} value - The value to store.
   * @returns {Promise<void>} Resolves once the write completes.
   */
  async setInitiative(id, value) {
    const combatant = this.combatants.get(id, { strict: true })
    await BAGSCombat.unitFor(combatant).update({ initiative: value })
  }

  /**
   * Shift a rolling unit's initiative by a fixed amount.
   *
   * For tables that let initiative be bought or spent: a metacurrency that buys
   * a side a better moment, a class feature worth a segment, a ruling made on
   * the spot. Whether that moves one combatant or a whole side is not this
   * method's decision -- it follows the ruleset, because in a side-initiative
   * game there is no such thing as one character's roll to adjust.
   *
   * **Adjusts the stored roll, not the derived score.** Effective initiative is
   * `base + offset` (or a segment the ruleset chose), recomputed on every data
   * preparation, so anything written to the derived value is overwritten the
   * moment anyone declares an action. Adding to the base is the only adjustment
   * that survives.
   * @param {string} id - A combatant in the unit to adjust.
   * @param {number} delta - How far to shift it. Negative is allowed, and under
   * a low-acts-first ruleset is the direction that buys you an earlier turn.
   * @returns {Promise<Combatant|CombatantGroup|null>} The document written to,
   * or null when the unit has not rolled and there is nothing to adjust.
   */
  async adjustInitiative(id, delta) {
    if (!Number.isFinite(delta) || delta === 0) return null

    const combatant = this.combatants.get(id, { strict: true })
    const unit = BAGSCombat.unitFor(combatant)
    // The stored roll, never `unit.initiative`: for a combatant rolling alone
    // that is the derived score, offset already included, and writing it back
    // as the base would count the offset twice.
    const base = baseRollOf(unit)

    // Nothing to shift. Rolling first is a different decision from adjusting,
    // and quietly turning one into the other would hand out a roll nobody asked
    // for -- with the adjustment folded invisibly into it.
    if (!Number.isFinite(base)) return null

    await unit.update({ initiative: base + delta })
    return unit
  }

  // ===========================================================================
  // SURPRISE
  // ===========================================================================

  /**
   * Can surprise still be rolled or changed?
   *
   * Before the fight, or while the first round waits to begin. Once anyone has
   * acted, deciding they were surprised after all would rewrite a round that is
   * already being played -- and under lost segments, could drop someone who has
   * already acted back in front of the cursor.
   * @type {boolean}
   */
  get canChangeSurprise() {
    if (!this.initiativeConfig.surprise) return false
    return !this.started || (this.round === 1 && this.betweenRounds)
  }

  /**
   * Roll surprise for every side in the fight.
   *
   * One roll per side, as every game BAGS models has it: a party is caught off
   * guard together, not one member at a time. Everyone on a surprised side is
   * marked, and a card in chat shows the dice.
   * @returns {Promise<object[]|null>} One result per side, or null when
   * surprise cannot be rolled now.
   */
  async rollSurprise() {
    const rule = this.initiativeConfig.surprise
    if (!game.user.isGM || !this.canChangeSurprise) return null

    const sides = [
      ...new Set(this.combatants.map((combatant) => combatant.side)),
    ]
    if (!sides.length) return null

    const rolls = await Promise.all(
      sides.map(async () => {
        const roll = foundry.dice.Roll.create(rule.formula)
        await roll.evaluate()
        return roll
      }),
    )
    const results = resolveSurprise(
      sides.map((side, index) => ({ side, total: rolls[index].total })),
      rule,
    )

    const lost = new Map(
      results
        .filter((result) => result.surprised)
        .map((result) => [result.side, result.segments]),
    )
    const combatants = this.combatants
      .filter((combatant) => lost.has(combatant.side))
      .map((combatant) => ({
        _id: combatant.id,
        segments: lost.get(combatant.side),
      }))

    await this.#writeSurprise({ sides: results, combatants })
    await postSurpriseCard(this, results, rolls)

    return results
  }

  /**
   * Mark one combatant surprised, or not, by hand.
   *
   * For the cases the dice do not cover: the sentry who was asleep, the one
   * character who was looking the right way. Under lost segments, a combatant
   * marked by hand loses what their side lost if it was surprised, and rolls
   * the ruleset's die otherwise.
   * @param {Combatant} combatant - Who to mark.
   * @param {boolean} surprised - Whether they were caught off guard.
   * @returns {Promise<void>} Resolves once the write lands.
   */
  async setSurprised(combatant, surprised) {
    const rule = this.initiativeConfig.surprise
    if (!game.user.isGM || !this.canChangeSurprise) return

    const stored = storedSurprise(this) ?? { sides: [], combatants: [] }
    const combatants = (stored.combatants ?? []).filter(
      (entry) => entry._id !== combatant.id,
    )

    if (surprised) {
      let segments = 0
      if (rule.effect === SURPRISE_EFFECT.SEGMENTS) {
        const side = stored.sides?.find(
          (result) => result.side === combatant.side && result.surprised,
        )
        if (side) segments = side.segments
        else {
          const roll = foundry.dice.Roll.create(rule.formula)
          await roll.evaluate()
          segments = roll.total
        }
      }
      combatants.push({ _id: combatant.id, segments })
    }

    await this.#writeSurprise({ sides: stored.sides ?? [], combatants })
  }

  /**
   * Forget the surprise roll, so nobody is surprised.
   * @returns {Promise<void>} Resolves once the write lands.
   */
  async clearSurprise() {
    if (!game.user.isGM || !this.canChangeSurprise) return
    await this.#endSurprise()
  }

  /**
   * Store a surprise result.
   * @param {object} surprise - `{sides, combatants}`; see SURPRISE_FLAG.
   * @returns {Promise<void>} Resolves once the write lands.
   */
  async #writeSurprise(surprise) {
    await this.update(
      { [`flags.${SYSTEM_NAME}.${SURPRISE_FLAG}`]: surprise },
      silentWrite(),
    )
  }

  /**
   * Remove the surprise result outright.
   *
   * Also how surprise ends as the first round closes. Removing it before the
   * next round opens, rather than leaving it for `surpriseFor` to ignore, means
   * the order and the first turn of round two are worked out without it.
   * @returns {Promise<void>} Resolves once the write lands.
   */
  async #endSurprise() {
    if (!storedSurprise(this)) return
    await this.update(
      {
        flags: {
          [SYSTEM_NAME]: {
            [SURPRISE_FLAG]: foundry.data.operators.ForcedDeletion.create(),
          },
        },
      },
      silentWrite(),
    )
  }

  // ===========================================================================
  // MORALE
  // ===========================================================================

  /**
   * Morale checks the waiting round is held up for.
   * @type {object[]} `{unit, trigger, key}` per check.
   */
  get pendingMorale() {
    if (!this.initiativeConfig.morale) return []
    return storedMorale(this).pending
  }

  /**
   * Roll morale for some combatants, and mark the ones who break.
   *
   * Each rolls against their own rating. Anyone who cannot check -- a player
   * character, the defeated, a monster with no rating, one already broken --
   * is left out. The results go to the referee in a whispered card.
   * @param {Combatant[]} combatants - Who to roll for.
   * @returns {Promise<object[]>} `{combatant, roll, rating, failed}` for each
   * combatant who rolled.
   */
  async rollMorale(combatants) {
    const rule = this.initiativeConfig.morale
    if (!game.user.isGM || !rule) return []

    const results = await Promise.all(
      combatants.filter(canCheckMorale).map(async (combatant) => {
        const { actor } = combatant
        const roll = foundry.dice.Roll.create(rule.formula, actor.getRollData())
        await roll.evaluate()
        const rating = actor.system.morale.value
        return {
          combatant,
          roll,
          rating,
          failed: failsMorale(roll.total, rating),
        }
      }),
    )

    // One at a time, and once per actor: combatants can share an actor, and
    // two toggles racing on one would both see no status and add two.
    const broken = new Set(
      results.filter((result) => result.failed).map((r) => r.combatant.actor),
    )
    await [...broken].reduce(
      (chain, actor) =>
        chain.then(() =>
          actor.toggleStatusEffect(MORALE_FAILURE_STATUS, { active: true }),
        ),
      Promise.resolve(),
    )

    await postMoraleCard(results)
    return results
  }

  /**
   * Make the morale checks the waiting round is held up for, then begin it if
   * nothing else is in the way.
   * @returns {Promise<object[]>} The results, as from `rollMorale`.
   */
  async resolvePendingMorale() {
    if (!game.user.isGM) return []

    const units = new Set(this.pendingMorale.map((check) => check.unit))
    const results = await this.rollMorale(
      this.combatants.filter((combatant) => units.has(moraleUnitOf(combatant))),
    )
    await this.#settleMorale()
    return results
  }

  /**
   * Let the waiting round go ahead without its morale checks.
   * @returns {Promise<void>} Resolves once the write lands.
   */
  async skipPendingMorale() {
    if (!game.user.isGM) return
    await this.#settleMorale()
  }

  /**
   * Carry any action that runs past the end of this round into the next.
   *
   * Written fresh every time a round closes, replacing what was carried into
   * this one. An action long enough to run past the next round as well is
   * found again when that round closes, and carried again.
   * @returns {Promise<string[]>} The combatants whose actions were carried.
   */
  async #carryOver() {
    const carries = carriesOutOf(this)
    const stored = this.getFlag(SYSTEM_NAME, CARRY_FLAG)
    if (!carries.length && !stored?.length) return []

    await this.update(
      { [`flags.${SYSTEM_NAME}.${CARRY_FLAG}`]: carries },
      silentWrite(),
    )
    return carries.map((carry) => carry._id)
  }

  /**
   * Note the checks that have just become due, so the next round waits for
   * them.
   *
   * Run as a round closes, before the next one opens -- opening is where the
   * round decides whether it can begin at once.
   * @returns {Promise<void>} Resolves once the write lands.
   */
  async #queueMorale() {
    if (!this.initiativeConfig.morale) return

    const due = dueMoraleChecks(this)
    if (!due.length) return

    const { fired, pending } = storedMorale(this)
    await this.update(
      {
        [`flags.${SYSTEM_NAME}.${MORALE_FLAG}`]: {
          fired: [...fired, ...due.map((check) => check.key)],
          pending: [...pending, ...due],
        },
      },
      silentWrite(),
    )
  }

  /**
   * Clear the waiting checks, and begin the round if that was all it waited on.
   * @returns {Promise<void>} Resolves once the write lands.
   */
  async #settleMorale() {
    if (!storedMorale(this).pending.length) return
    await this.update(
      { [`flags.${SYSTEM_NAME}.${MORALE_FLAG}.pending`]: [] },
      silentWrite(),
    )
    // Awaited here rather than left to `#beginRoundIfReady`, which does not
    // wait: whoever pressed the button should get back a round that has begun.
    if (this.betweenRounds && this.#readyToBegin) await this.beginRound()
  }

  // ===========================================================================
  // ROUND LIFECYCLE
  // ===========================================================================

  /**
   * Is the encounter between rounds -- the next round announced, but nobody
   * acting in it yet?
   *
   * This is the window in which declarations are made and initiative is rolled.
   * It needs no data of its own: Foundry already has a way to say "it is nobody's
   * turn", which is a `turn` of null. Core's `nextRound` preserves a null turn
   * rather than resetting it, and `nextTurn` steps out of it onto the first turn,
   * so a started combat whose cursor is on nobody is a state core already
   * understands.
   * @type {boolean}
   */
  get betweenRounds() {
    return this.started && this.turn === null
  }

  /**
   * Player characters who have not yet said what they are doing.
   *
   * Only player characters count. A referee should not have to declare for
   * every orc before the dice can come out -- monster intentions are theirs to
   * keep, and are optional by design.
   * @type {Combatant[]}
   */
  get undeclaredPlayerCombatants() {
    if (this.initiativeConfig.declarationMode === DECLARATION_MODE.OFF)
      return []

    return this.combatants.filter(
      (combatant) =>
        combatant.hasPlayerOwner && !combatant.system?.declaration?.type,
    )
  }

  /**
   * Are declarations being kept from other players right now?
   *
   * Under blind declarations, until the round begins. Once it has, everyone
   * has committed, and seeing what the others chose can no longer change it.
   *
   * **Known leak:** where declarations move combatants -- AD&D's offsets --
   * the order itself can give a choice away under the "keep" cadence, since
   * last round's rolls are still there to be offset. Under "reroll", rolls are
   * cleared while declarations are taken, and there is nothing to read.
   * @type {boolean}
   */
  get declarationsHidden() {
    if (this.initiativeConfig.declarationMode === DECLARATION_MODE.OFF) {
      return false
    }
    if (!safeSetting("blindDeclarations", false)) return false
    return !this.started || this.betweenRounds
  }

  /**
   * Is the encounter still waiting on its players before the round can begin?
   * @type {boolean}
   */
  get awaitingDeclarations() {
    return this.undeclaredPlayerCombatants.length > 0
  }

  /**
   * Is the round waiting on the referee to roll?
   *
   * Only under the "reset" cadence, which is a table saying it rolls by hand.
   * Every other cadence rolls whatever is missing when the round begins.
   * @type {boolean}
   */
  get #waitsForRoll() {
    if (this.initiativeConfig.rerollCadence !== REROLL_CADENCE.RESET) {
      return false
    }
    return this.rollingUnits.some((unit) => baseRollOf(unit) === null)
  }

  /**
   * Can the round begin as soon as it opens, with nothing to wait for?
   * @type {boolean}
   */
  get #readyToBegin() {
    return (
      !this.awaitingDeclarations &&
      !this.#waitsForRoll &&
      !this.pendingMorale.length
    )
  }

  /**
   * Where the cursor lands when a round begins.
   *
   * Core's own rule from `Combat#nextRound`: the first combatant, or the first
   * one still standing when defeated combatants are skipped.
   * @param {number} [round] - The round beginning. Passed while a round is
   * being opened, when `this.round` still holds the one before it.
   * @returns {number|null} A turn index, or null if nobody is in the fight.
   */
  #firstTurn(round = this.round) {
    if (!this.turns.length) return null

    const index = this.turns.findIndex((combatant) =>
      this.#canTakeTurn(combatant, round),
    )
    return index === -1 ? 0 : index
  }

  /**
   * Can the cursor stop on this combatant?
   *
   * Not when they are defeated and the encounter skips the defeated, which is
   * core's own rule and setting. Not in the first round, either, when surprise
   * cost them that round.
   * @param {Combatant} combatant - The combatant to check.
   * @param {number} [round] - The round in question; see `#firstTurn`.
   * @returns {boolean} Whether they get a turn.
   */
  #canTakeTurn(combatant, round = this.round) {
    if (this.settings.skipDefeated && combatant.isDefeated) return false
    return !losesTurnToSurprise(combatant, round)
  }

  /**
   * The last moment of the round that has just been closed.
   *
   * Foundry decides which turn events to fire by comparing where the cursor was
   * with where it is now. Between rounds the cursor is on nobody, and core reads
   * a step from "nobody" to the first turn as a rewind -- so the round would
   * begin without a single start-of-round or start-of-turn event. Remembering
   * where the previous round actually stopped lets the round's beginning be
   * dispatched as the boundary it is. See `_onUpdate`.
   *
   * Stored on the document when the round closes, so a referee reloading in the
   * middle of declarations does not lose it. If it is missing, the end of the
   * previous round is the honest guess.
   * @type {object}
   */
  get #closingState() {
    const stored = this.getFlag(SYSTEM_NAME, CLOSING_STATE_FLAG)
    if (stored && stored.round < this.round) return stored

    const round = this.round - 1
    if (round < 1) return { ...BEFORE_THE_FIGHT }
    const last = this.turns.at(-1)
    return {
      round,
      turn: this.turns.length - 1,
      combatantId: last?.id ?? null,
      tokenId: last?.tokenId ?? null,
    }
  }

  /**
   * Begin the encounter.
   *
   * Opens round one. Declarations made before the fight are kept, because they
   * were made *for* round one -- clearing them here is how a table that
   * declared and then pressed Begin used to lose everything it had said.
   * @override
   * @returns {Promise<this>} This combat.
   */
  async startCombat() {
    // Only a referee can roll for a group, and only a referee is offered the
    // button. Anyone else reaching this gets Foundry's own behaviour.
    if (!game.user.isGM) return super.startCombat()

    this._playCombatSound("startEncounter")
    // Explicitly "before the fight" rather than wherever the cursor happens to
    // sit in an unstarted combat, which can be turn 0 -- and would have that
    // combatant's turn end before the fight had begun.
    await this.#openRound({ ...BEFORE_THE_FIGHT }, { start: true })
    await foundry.documents.ActiveEffect.registry.refresh("combatStart", {
      combat: this,
    })

    return this
  }

  /**
   * Close the current round and open the next.
   *
   * **Closing** is where the old round's intentions are wiped: a declaration
   * belongs to the round it was made in. The reroll cadence applies here too.
   *
   * **Opening** either begins the new round at once or leaves the encounter
   * between rounds, waiting. It waits when the players have declarations to
   * make, or when the table rolls initiative by hand. While it waits, nobody
   * has the turn, no turn events fire and nobody is told it is their turn --
   * all of that happens when the round actually begins, against the order the
   * dice produced. See {@link beginRound}.
   *
   * A player cannot do most of this: they cannot clear other people's
   * declarations or roll for a group. Their request is passed to the referee.
   * @override
   * @returns {Promise<this>} This combat.
   */
  async nextRound() {
    if (!game.user.isGM) return this.#askGMForNextRound()

    // A round that never began has nothing of its own to remember; where the
    // last real one stopped is still the right place to dispatch from.
    const closing = this.betweenRounds
      ? this.#closingState
      : this._getCurrentState()

    // Taken before anything is cleared, so a referee who pressed Next Round by
    // mistake can step back without the table declaring and rolling again.
    const rewind = this.#captureRound()

    // Before declarations are cleared: whether an action runs on into the
    // next round depends on what was declared. A caster mid-spell keeps their
    // declaration, since they are still doing what they said.
    const carried = await this.#carryOver()

    await this.clearDeclarations({ keep: carried })
    await this.#queueMorale()
    if (this.round === 1) await this.#endSurprise()
    await this.#applyRerollCadence()
    await this.#openRound(closing, { rewind })

    return this
  }

  /**
   * Step back into the previous round, as it was when it closed.
   *
   * Two things core does not do. Between rounds, core would keep the cursor on
   * nobody and simply lower the round number, leaving the previous round stuck
   * between rounds; going back here means going back to that round's last turn.
   * And closing a round cleared its declarations and may have rerolled its
   * initiative, so a referee stepping back would find the round they left with
   * nobody's intentions in it and a different order. When the round being
   * returned to is the one most recently closed, its declarations and rolls are
   * put back as they were.
   *
   * Only one round deep. Stepping back a second time moves the cursor but has
   * nothing to restore.
   * @override
   * @returns {Promise<this>} This combat.
   */
  async previousRound() {
    const snapshot = this.#rewindSnapshot
    if (!snapshot && (!this.betweenRounds || this.round <= 1)) {
      return super.previousRound()
    }

    const round = this.round - 1
    const turn = Math.max(this.turns.length - 1, 0)
    const updateData = { round, turn }
    const updateOptions = {
      direction: -1,
      worldTime: {
        delta: this.getTimeDelta(this.round, this.turn, round, turn),
      },
    }
    // Surprise is part of the first round. Put back with the cursor, rather
    // than afterwards, so the order is right for the round as soon as it is
    // back in it.
    if (snapshot?.surprise && round === 1) {
      updateData[`flags.${SYSTEM_NAME}.${SURPRISE_FLAG}`] = snapshot.surprise
    }
    Hooks.callAll("combatRound", this, updateData, updateOptions)

    // The cursor moves first. While the encounter is between rounds, putting
    // declarations and rolls back could complete what the round is waiting on
    // and begin it -- on another referee session, where nothing here can stop
    // it. Once the cursor is on a turn, there is no round waiting to begin.
    await this.#pinWrite
    await this.update(updateData, updateOptions)
    if (snapshot) await this.#restoreRound(snapshot, turn)

    return this
  }

  /**
   * Step back one turn -- out of the previous round, when this one has not
   * begun.
   * @override
   * @returns {Promise<this>} This combat.
   */
  async previousTurn() {
    if (this.betweenRounds) return this.previousRound()
    if (this.initiativeConfig.granularity !== TURN_GRANULARITY.UNIT) {
      return super.previousTurn()
    }

    // Under unit granularity, back to where the previous unit's turn began --
    // the same stop Next Turn would have landed on -- rather than one member
    // at a time into the middle of it.
    const current = this.turns[this.turn ?? -1]
    if (this.round === 0 || !current) return super.previousTurn()

    // The nearest earlier unit with anyone in it who can act. Units are
    // contiguous here, because unit granularity only applies when nobody in a
    // unit is offset from the rest of it.
    const currentUnit = unitKeyFor(current)
    const before = this.turns
      .slice(0, this.turn)
      .findLast(
        (combatant) =>
          unitKeyFor(combatant) !== currentUnit && this.#canTakeTurn(combatant),
      )
    if (!before) return this.previousRound()

    const previousUnit = unitKeyFor(before)
    const turn = this.turns.findIndex(
      (combatant) =>
        unitKeyFor(combatant) === previousUnit && this.#canTakeTurn(combatant),
    )

    const updateData = { round: this.round, turn }
    const updateOptions = {
      direction: -1,
      worldTime: {
        delta: this.getTimeDelta(this.round, this.turn, this.round, turn),
      },
    }
    Hooks.callAll("combatTurn", this, updateData, updateOptions)
    await this.#pinWrite
    await this.update(updateData, updateOptions)

    return this
  }

  /**
   * Start the round that is waiting.
   *
   * Rolls for any unit that has not rolled, then puts the cursor on the first
   * turn. This is what runs once the last player has declared, and what the
   * referee's Next Turn and Begin Round controls do -- so a player who never
   * declares holds nothing up for longer than the referee lets them.
   *
   * Never runs twice at once. Beginning a round writes to the very documents
   * whose changes ask for it to begin, and a referee's click can race the
   * automatic start; a second caller simply waits for the first.
   * @returns {Promise<this>} This combat.
   */
  async beginRound() {
    if (!this.betweenRounds) return this

    this.#beginning ??= (async () => {
      await this.#rollUnrolled()
      await this.#pinWrite

      const updateData = { turn: this.#firstTurn() }
      // A referee beginning the round with morale checks still listed has
      // chosen not to make them. Left in place, they would hold up the round
      // after this one instead.
      if (this.pendingMorale.length) {
        updateData[`flags.${SYSTEM_NAME}.${MORALE_FLAG}.pending`] = []
      }
      await this.update(updateData, { [BEGIN_ROUND]: true })
      return this
    })().finally(() => {
      this.#beginning = null
    })

    return this.#beginning
  }

  /**
   * Make the step out of "between rounds" read as the round boundary it is.
   *
   * Foundry compares the state before an update with the state after it to
   * decide which turn events to fire, and it reads the state before from
   * `this.current`. Between rounds that is "round N, nobody's turn", and the
   * step to "round N, first turn" is one core treats as a rewind. Swapping in
   * where the previous round stopped -- just for this update, on every client --
   * lets core fire the end of that round, the start of this one, and the first
   * turn, exactly as if the round had advanced in one step.
   *
   * Also re-sorts when this encounter's own rule overrides change. Core only
   * rebuilds the turn order when combatants change, so switching one fight to
   * a different ruleset would otherwise leave it in the old ruleset's order.
   * Surprise changing does the same, since it can push combatants back.
   * @inheritDoc
   */
  _onUpdate(changed, options, userId) {
    // A new round can mean a new order -- an action carried over from last
    // round, a second attack that only comes every other round -- and core
    // reads the order to decide whose turn has started. Re-sorted first, so it
    // reads the new one, while keeping core's record of where the cursor was.
    if ("round" in changed) {
      const prior = this.current
      this.setupTurns()
      this.current = prior
    }

    // Only when this update is the one that moved the cursor. If two referee
    // sessions both begin the round, the second write changes nothing and comes
    // back with no `turn` in it; swapping then would replay the round's start.
    if (options?.[BEGIN_ROUND] && "turn" in changed) {
      this.current = this.#closingState
    }
    super._onUpdate(changed, options, userId)

    // Flags too, because surprise lives in one and can push combatants back.
    if ("system" in changed || "flags" in changed) this.setupTurns()
  }

  /**
   * Begin the round automatically once there is nothing left to wait for.
   *
   * Called whenever a combatant or group changes, since any of those -- the
   * last declaration, the last group rolling, an undeclared player leaving the
   * fight -- can be the thing the round was waiting on.
   *
   * Runs on one client only.
   * @returns {void}
   */
  #beginRoundIfReady() {
    if (!game.user.isActiveGM || !this.betweenRounds) return
    if (this.#beginning || !this.#readyToBegin) return

    this.beginRound()
  }

  /**
   * A round being begun right now, if there is one.
   * @type {Promise<this>|null}
   */
  #beginning = null

  /**
   * Move into a new round: round one from `startCombat`, the next from
   * `nextRound`.
   *
   * Written out rather than delegated to core, which offers no way to choose
   * where the cursor lands or to hold back the turn events.
   * @param {object} closing - Where the previous round stopped.
   * @param {object} [options] - Options.
   * @param {boolean} [options.start] - Whether this starts the encounter.
   * @param {object} [options.rewind] - The closed round's declarations and
   *   rolls, from `#captureRound`, kept so the round can be stepped back into.
   * @returns {Promise<void>} Resolves once the round has opened.
   */
  async #openRound(closing, { start = false, rewind = null } = {}) {
    const begins = this.#readyToBegin
    if (begins) await this.#rollUnrolled()

    const round = start ? 1 : this.round + 1
    const turn = begins ? this.#firstTurn(round) : null
    const updateData = { round, turn }
    const updateOptions = {
      direction: 1,
      worldTime: {
        delta: this.getTimeDelta(this.round, this.turn, round, turn),
      },
    }

    if (rewind) updateData[`flags.${SYSTEM_NAME}.${REWIND_FLAG}`] = rewind

    if (!begins) {
      updateData[`flags.${SYSTEM_NAME}.${CLOSING_STATE_FLAG}`] = closing
      // Nobody's turn has started, so nothing should hear that one has. The
      // events for this boundary fire when the round begins.
      updateOptions.turnEvents = false
    }

    if (start) Hooks.callAll("combatStart", this, updateData)
    else Hooks.callAll("combatRound", this, updateData, updateOptions)

    await this.#pinWrite
    await this.update(updateData, updateOptions)

    // Posted as the round opens rather than when it begins, because the card is
    // where players are invited to declare.
    if (safeSetting("postRoundCard", true)) await postRoundCard(this)
  }

  /**
   * Apply the table's reroll cadence to the round about to open.
   * @returns {Promise<void>} Resolves once any writes land.
   */
  async #applyRerollCadence() {
    switch (this.initiativeConfig.rerollCadence) {
      case REROLL_CADENCE.REROLL:
        // Clear rather than roll when the table declares first. The dice come
        // out when the round begins; rolling now would publish the order before
        // anyone had committed to anything.
        if (this.awaitingDeclarations) await this.resetAll()
        // Roll every unit outright rather than clearing and re-rolling: one
        // round of writes instead of two, and the order never passes through
        // an all-unrolled state that the tracker would briefly render.
        else await this.rollUnitInitiative(this.rollingUnits)
        break
      case REROLL_CADENCE.RESET:
        await this.resetAll()
        break
      default:
        break
    }
  }

  /**
   * Roll for every unit that has no roll yet.
   * @returns {Promise<void>} Resolves once any roll is written.
   */
  async #rollUnrolled() {
    const unrolled = this.rollingUnits.filter(
      (unit) => baseRollOf(unit) === null,
    )
    if (unrolled.length) await this.rollUnitInitiative(unrolled)
  }

  /**
   * Record this round's declarations and rolls, before closing it clears them.
   *
   * Read from source, so a grouped combatant's own stored roll is kept as it
   * is rather than replaced with the group's. Lists rather than objects keyed
   * by id, because a flag update merges objects -- a combatant who left the
   * fight would linger in a keyed object forever -- but replaces lists whole.
   * @returns {object} The round's state, for `#restoreRound`.
   */
  #captureRound() {
    const capture = (document) => ({
      _id: document.id,
      initiative: document._source.initiative ?? null,
      declaration: foundry.utils.deepClone(
        document._source.system?.declaration ?? blankDeclaration(),
      ),
    })

    return {
      round: this.round,
      combatants: this.combatants.map(capture),
      groups: this.groups.map(capture),
      surprise: foundry.utils.deepClone(storedSurprise(this)),
    }
  }

  /**
   * The last closed round's state, if the cursor is about to step back into
   * that round and this user can write it back.
   * @type {object|null}
   */
  get #rewindSnapshot() {
    if (!game.user.isGM) return null

    const snapshot = this.getFlag(SYSTEM_NAME, REWIND_FLAG)
    if (snapshot?.round !== this.round - 1) return null
    return snapshot
  }

  /**
   * Put a closed round's declarations and rolls back.
   *
   * Restoring rolls re-sorts the turn order, and each write would normally
   * move the cursor to follow whoever was acting. Passing the turn explicitly
   * holds it where the rewind put it: on the last turn of the round as it was.
   * Anyone who joined after the round closed keeps what they have.
   * @param {object} snapshot - From `#captureRound`.
   * @param {number} combatTurn - Where the cursor should stay.
   * @returns {Promise<void>} Resolves once the writes land.
   */
  async #restoreRound(snapshot, combatTurn) {
    const options = { ...silentWrite(), combatTurn }

    /**
     * Turn stored entries into updates, for documents that still exist.
     * @param {foundry.utils.Collection} collection - Where they live now.
     * @param {object[]} [entries] - The stored entries.
     * @returns {object[]} Update data.
     */
    const updatesFor = (collection, entries = []) =>
      entries
        .filter((entry) => collection.has(entry._id))
        .map(({ _id, initiative, declaration }) => ({
          _id,
          initiative,
          system: { declaration },
        }))

    const groups = updatesFor(this.groups, snapshot.groups)
    if (groups.length) {
      await this.updateEmbeddedDocuments("CombatantGroup", groups, options)
    }

    const combatants = updatesFor(this.combatants, snapshot.combatants)
    if (combatants.length) {
      await this.updateEmbeddedDocuments("Combatant", combatants, options)
    }
  }

  /**
   * Pass a player's "next round" to the referee.
   *
   * Opening a round clears everyone's declarations and may roll for groups,
   * none of which a player is allowed to write. Doing the part they can and
   * skipping the rest would run the next round on last round's dice, so the
   * whole request goes to the active GM instead -- or, with no GM present, it
   * is refused out loud.
   * @returns {Promise<this>} This combat.
   */
  async #askGMForNextRound() {
    const gm = game.users.activeGM
    if (!gm) {
      ui.notifications.warn("BAGS.Combat.Round.NeedsGM", { localize: true })
      return this
    }

    await gm.query(NEXT_ROUND_QUERY, { combatId: this.id }).catch((error) => {
      console.warn("BAGS | Could not ask the GM to open the next round.", error)
    })
    return this
  }

  /**
   * Correct core's "skipped" flag for turns that were not skipped.
   *
   * Stepping the cursor past a whole unit does fire per-member turn events --
   * core walks every intermediate index (`combat.mjs:924`) -- but it flags all
   * of them `skipped: true`, reserving `false` for the one the cursor lands on
   * (`:930`). That flag is passed to `ActiveEffect.registry.refresh` and to
   * region events, where handlers reasonably read it as "fast-forwarded, do not
   * apply".
   *
   * Under unit granularity that is exactly backwards. A referee clicking once to
   * play a side of six orcs played all six turns; an effect that should have
   * expired on the fourth orc's turn genuinely reached it. Left uncorrected,
   * durations quietly run long and only in group-initiative games -- the kind of
   * bug a player finds when their *bless* outlasts its welcome.
   *
   * **Mutates the context object rather than returning.** That is what makes it
   * work: core hands the same object to `_onStartTurn`, then spreads it into the
   * effect refresh and passes it to region events, all *after* this runs
   * (`combat.mjs:1075-1078`).
   * @param {Combatant} combatant - Whose turn it is.
   * @param {object} context - The turn context, modified in place.
   * @returns {void}
   */
  #normalizeSkipped(combatant, context) {
    if (!context?.skipped) return

    const step = steppedPast.get(this)
    if (!step) return

    // Only turns in the round that step happened in. A referee jumping several
    // rounds forward sweeps whole rounds into one interval, and those turns were
    // genuinely never played -- including later rounds' turns belonging to the
    // very unit the cursor was sitting in, which is the case that makes this
    // check necessary rather than merely tidy.
    if (context.round !== step.round) return

    // Only the members of the unit that was stepped over. Anyone else caught in
    // the same interval really was passed over.
    if (unitKeyFor(combatant) !== step.unit) return

    context.skipped = false
  }

  /** @inheritDoc */
  async _onStartTurn(combatant, context) {
    this.#normalizeSkipped(combatant, context)
    await super._onStartTurn(combatant, context)
  }

  /** @inheritDoc */
  async _onEndTurn(combatant, context) {
    this.#normalizeSkipped(combatant, context)
    await super._onEndTurn(combatant, context)
  }

  /**
   * Keep movement history for the whole round.
   *
   * Core clears **every** token's history at the start of **every** turn
   * (`combat.mjs:1107`), which is right for a game where movement is a turn's
   * allowance. In all five games BAGS models it is a *round's*: a character has
   * so many feet of encounter movement per round, spent whenever they like
   * within it. Clearing per turn would wipe the record the moment anyone else
   * acted, so nobody could see what they had left -- and under unit granularity
   * it would wipe it mid-side.
   *
   * A no-op rather than a narrower clear. The clearing happens in
   * `_onStartRound`, which is the boundary that actually means something.
   *
   * The empty body is the entire implementation, so the two rules complaining
   * about it are both wrong here: there is nothing for it to do with `this`, and
   * its emptiness is what it is for.
   * @inheritDoc
   */
  /* eslint-disable-next-line class-methods-use-this, no-empty-function */
  async _clearMovementHistoryOnStartTurn() {}

  /**
   * Guard round-zero bookkeeping.
   *
   * Starting a combat fires an end-of-round event for round 0, a round that
   * never happened.
   * @inheritDoc
   */
  async _onEndRound(context) {
    if (context.round > 0) await super._onEndRound(context)
  }

  /**
   * A round has begun: hand back everyone's movement, and make sure it has a
   * card.
   *
   * Declarations are deliberately *not* cleared here. By the time a round
   * begins, its declarations are the ones the table has just made -- they are
   * cleared as the previous round closes, in `nextRound`.
   * @inheritDoc
   */
  async _onStartRound(context) {
    await super._onStartRound(context)

    // The round is the unit of movement in every game BAGS models, so this is
    // the boundary at which everyone's allowance comes back -- taking over the
    // job core does per turn, which `_clearMovementHistoryOnStartTurn` declines.
    await this.clearMovementHistories()

    if (safeSetting("postRoundCard", true)) await postRoundCard(this)
    // The card was captured while declarations were hidden; now that the round
    // has begun, it can say what everyone chose.
    if (safeSetting("blindDeclarations", false)) refreshRoundCard(this)
  }

  /**
   * Forget what everyone said they were doing.
   *
   * A declaration belongs to the round it was made in. Left standing, a
   * character who said "I cast a spell" in round one would still be paying that
   * spell's initiative penalty three rounds later, and the chat card for every
   * later round would repeat an intention nobody has restated.
   *
   * **The whole declaration goes, not just its type.** A declaration can carry
   * numbers now -- a casting time, a distance -- and an update *merges* into a
   * SchemaField, so clearing only `type` would leave a casting time of 7 in
   * place to be silently reapplied the next time its declarer picked a spell.
   * @param {object} [options] - Options.
   * @param {string[]} [options.keep] - Combatants whose declarations stay,
   * because they are still carrying them out (see `#carryOver`).
   * @returns {Promise<void>} Resolves once the writes land.
   */
  async clearDeclarations({ keep = [] } = {}) {
    // Tested with `isDeclarationDirty` rather than on `type`, because a
    // declaration's numbers outlive the type that asked for them: anything that
    // empties the type without naming every value leaves a casting time behind
    // in a declaration that reads as empty, and a filter on `type` skips exactly
    // those combatants.
    const declared = this.combatants.filter(
      (combatant) =>
        !keep.includes(combatant.id) &&
        isDeclarationDirty(combatant.system?.declaration),
    )
    const groups = this.groups.filter((group) =>
      isDeclarationDirty(group.system?.declaration),
    )

    if (declared.length) {
      await this.updateEmbeddedDocuments(
        "Combatant",
        declared.map((combatant) => ({
          _id: combatant.id,
          system: { declaration: blankDeclaration() },
        })),
        silentWrite(),
      )
    }
    if (groups.length) {
      await this.updateEmbeddedDocuments(
        "CombatantGroup",
        groups.map((group) => ({
          _id: group.id,
          system: { declaration: blankDeclaration() },
        })),
        silentWrite(),
      )
    }
  }

  // ===========================================================================
  // GROUPING
  // ===========================================================================

  /**
   * Rebuild the turn order after a group changes.
   *
   * Every one of Foundry's three descendant-document hooks opens with
   * `if (collection !== "combatants") return`, so a change to a CombatantGroup
   * triggers none of the work that a change to a Combatant does. Nothing
   * re-sorts, and -- because updating one embedded document does not re-prepare
   * its siblings -- the combatants that derive their initiative from the group
   * keep the value they worked out from the *previous* group data.
   *
   * `reset()` re-runs preparation for the whole encounter, which is what makes
   * the members pick up the new roll; `setupTurns` then re-sorts them, since
   * `prepareDerivedData` only builds turns when there are none.
   *
   * **The cursor stays on whoever is acting.** `BAGSCombatantGroup` works out
   * where that combatant lands and sends it as `combatTurn`, the same option
   * Foundry uses for combatant writes -- but Foundry only ever acts on it for
   * combatants. The client ignores it for groups (`combat.mjs:757`), and so does
   * the server, which has no group handler at all. So it is applied here on
   * every client, before the re-sort, and saved by the one client that made
   * the change. Without the save, a reload would put the cursor back on
   * whoever now sits at the old index.
   *
   * "The one client" is a browser session, not a user. A referee with the
   * world open in two windows is one user in two sessions, and if both saved
   * the pin, the second save could land after the cursor had moved on -- a
   * round that had just opened, for one, would find itself back on a turn.
   * @param {object} [options] - The operation's options.
   * @private
   */
  #onModifyGroups(options = {}) {
    const { combatTurn } = options
    const pinned = Number.isInteger(combatTurn) && combatTurn !== this.turn
    if (pinned) this.updateSource({ turn: combatTurn })

    this.reset()
    this.setupTurns()
    this._updateTurnMarkers()
    if (this.isView) ui.combat?.render()

    // `diff: false` because this client's source already holds the new turn, so
    // a diffed update would find nothing to send.
    //
    // Not awaited -- this runs inside a document hook -- but kept, because a
    // write that moves the cursor next must not be overtaken by this one.
    // Clearing the rolls as a round closes re-sorts and pins like any other
    // group change, and if that save landed after the round opened, it would
    // put the cursor back on a turn and the round would never wait.
    if (pinned && options[PIN_SESSION_OPTION] === SESSION_ID) {
      const write = this.update(
        { turn: combatTurn },
        { ...silentWrite(), diff: false },
      )
        .catch((error) => {
          console.warn("BAGS | Could not save the turn cursor.", error)
        })
        .finally(() => {
          if (this.#pinWrite === write) this.#pinWrite = null
        })
      this.#pinWrite = write
    }
  }

  /**
   * A cursor pin still being saved, if there is one. Anything about to move
   * the cursor itself waits for it first. See `#onModifyGroups`.
   * @type {Promise<void>|null}
   */
  #pinWrite = null

  /** @inheritDoc */
  _onCreateDescendantDocuments(parent, collection, documents, data, ...rest) {
    super._onCreateDescendantDocuments(
      parent,
      collection,
      documents,
      data,
      ...rest,
    )

    refreshRoundCard(this)

    if (collection === "groups") {
      this.#onModifyGroups(...rest)
      return
    }
    if (collection !== "combatants") return
    if (!game.user.isActiveGM) return
    if (!this.initiativeConfig.rollsByGroup) return

    // Group exactly the combatants this call delivered, and nobody else. A
    // version that scans every ungrouped combatant will happily undo a GM's
    // decision to take someone out of a group: auto-grouping is a convenience
    // for the moment tokens are dropped in, not a standing policy.
    this.#groupArrivals(documents)
  }

  /** @inheritDoc */
  _onUpdateDescendantDocuments(
    parent,
    collection,
    documents,
    changes,
    ...rest
  ) {
    super._onUpdateDescendantDocuments(
      parent,
      collection,
      documents,
      changes,
      ...rest,
    )

    refreshRoundCard(this)

    if (collection === "groups") this.#onModifyGroups(...rest)

    // The last declaration, or the last unit rolling, may be what the round
    // was waiting on.
    this.#beginRoundIfReady()
  }

  /**
   * Draw a line under the encounter in chat as it goes away.
   *
   * `_onDelete` rather than `_preDelete`: the document keeps its data in memory
   * after removal, so the round count is still readable, and the card cannot
   * end up posted for a deletion that was then refused.
   * @inheritDoc
   */
  _onDelete(options, userId) {
    super._onDelete(options, userId)

    if (game.user.isActiveGM && safeSetting("postRoundCard", true)) {
      postCombatEndCard(this)
    }
  }

  /** @inheritDoc */
  _onDeleteDescendantDocuments(parent, collection, documents, ids, ...rest) {
    super._onDeleteDescendantDocuments(
      parent,
      collection,
      documents,
      ids,
      ...rest,
    )

    refreshRoundCard(this)

    if (collection === "groups") this.#onModifyGroups(...rest)

    // An undeclared player character leaving the fight may have been the only
    // thing the round was waiting on.
    this.#beginRoundIfReady()
  }

  /**
   * Gather ungrouped combatants into a group matching their token's disposition.
   *
   * Debounced, and deliberately not done per combatant. Foundry dispatches its
   * per-combatant entry hook without awaiting, so six orcs dropped in at once
   * would run six concurrent "find or create the hostile group" handlers, each
   * checking before any of them had resolved -- and produce up to six duplicate
   * groups of one orc each. Reconciling the whole set at once, in two batched
   * writes, is the only version of this that survives a handful of tokens being
   * dragged in together.
   *
   * The 50ms window matches Foundry's own `debounceSetup`. The work is
   * idempotent, so a trailing run costs nothing.
   * @param {Combatant[]} arrivals - The combatants that have just joined.
   * @returns {Promise<void>} Resolves once they have been grouped.
   * @private
   */
  async #groupArrivals(arrivals) {
    const ids = arrivals.map((combatant) => combatant.id)

    // Serialise against any grouping already in flight. Two create operations
    // landing close together would otherwise both look up the hostile group,
    // both fail to find it, and both make one.
    const previous = this.#grouping
    let release
    this.#grouping = new Promise((resolve) => {
      release = resolve
    })
    await previous

    try {
      // Re-read membership *here*, rather than before the await. Between a
      // combatant entering and this running, its group can have been decided --
      // by the operation that created it, or by a GM moving it straight back
      // out. Filtering on a stale read is how an explicitly ungrouped combatant
      // ends up back in a group it was just taken out of.
      const ungrouped = ids
        .map((id) => this.combatants.get(id))
        .filter((combatant) => combatant && !combatant.rollingGroup)
      if (!ungrouped.length) return

      await this.#assignArrivals(ungrouped)
    } finally {
      release()
    }
  }

  /**
   * A promise that resolves once any in-flight grouping has finished.
   * @type {Promise<void>}
   */
  #grouping = Promise.resolve()

  /**
   * Put a set of newly-arrived combatants into groups matching their sides.
   * @param {Combatant[]} ungrouped - Combatants that arrived without a group.
   * @returns {Promise<void>} Resolves once the writes land.
   * @private
   */
  async #assignArrivals(ungrouped) {
    const wanted = ungrouped.reduce((bySide, combatant) => {
      const side = sideFromDisposition(combatant.token?.disposition)
      bySide.set(side, [...(bySide.get(side) ?? []), combatant])
      return bySide
    }, new Map())

    const existing = new Map(
      this.groups.map((group) => [group.system.side, group]),
    )

    const missing = [...wanted.keys()].filter((side) => !existing.has(side))
    if (missing.length) {
      // Derive the id from the encounter and the side rather than letting
      // Foundry pick one. A referee with the world open twice is one User in two
      // sessions, and both answer `true` to `isActiveGM` -- so both run this and
      // both create a group. Asking for the same id makes the second attempt
      // collide instead, which is exactly what should happen.
      await this.createEmbeddedDocuments(
        "CombatantGroup",
        missing.map((side) => ({
          _id: deterministicId(`bags.group:${this.id}:${side}`),
          name: game.i18n.localize(SIDE_LABELS[side]),
          system: { side },
        })),
        { render: false, keepId: true },
      ).catch(() => [])

      // Re-read rather than trusting what came back: on a collision the other
      // session's group is the one that exists.
      this.groups.forEach((group) => existing.set(group.system.side, group))
    }

    const updates = [...wanted.entries()].flatMap(([side, combatants]) => {
      const group = existing.get(side)
      if (!group) return []
      return combatants.map((combatant) => ({
        _id: combatant.id,
        group: group.id,
      }))
    })

    if (updates.length) {
      await this.updateEmbeddedDocuments("Combatant", updates)
    }
  }

  /**
   * Create a new, empty group.
   * @param {string} [side] - The side the group fights for.
   * @returns {Promise<CombatantGroup>} The created group.
   */
  async createGroup(side = SIDES.HOSTILE) {
    const [group] = await this.createEmbeddedDocuments("CombatantGroup", [
      {
        name: game.i18n.localize("BAGS.Combat.Groups.NewGroup"),
        system: { side },
      },
    ])
    return group
  }
}
