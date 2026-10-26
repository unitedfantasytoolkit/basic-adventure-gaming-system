/**
 * @file The Combatant document, extended so that a combatant's initiative can
 * come from the unit it rolled with.
 */

import { clampSegment } from "../rules-engines/segments.mjs"
import { NO_DECLARATION, resolveDeclarationType } from "./declarations.mjs"
import { DECLARATION_MODE, TURN_GRANULARITY } from "./initiative-config.mjs"
import { SIDES } from "./sides.mjs"
import { surpriseDelayFor, surpriseFor } from "./surprise.mjs"
import { carriedSegmentFor, rawSegmentFor, spilloverFor } from "./spillover.mjs"

/**
 * The raw roll a combatant is ordered by, before any offset.
 *
 * A module-level function rather than a private accessor, and that is not a
 * style preference. Private methods and accessors are installed on an instance
 * only *after* `super()` returns, but the Document constructor runs
 * `_initialize()` -- and so `prepareDerivedData()` -- from inside `super()`.
 * Anything reachable from data preparation therefore cannot be private: reading
 * it throws "Private element is not present on this object", which Foundry
 * catches and reports as a failed data preparation for every combatant created.
 * @param {Combatant} combatant - The combatant to read.
 * @returns {number|null} The unit's stored roll, or null if it has not rolled.
 */
const baseRollFor = (combatant) => {
  const group = combatant.rollingGroup
  const base = group ? group.initiative : combatant._source.initiative
  return Number.isFinite(base) ? base : null
}

/**
 * The part of a combatant's offset that its ruleset works out from what they
 * declared. Module-level for the same reason `baseRollFor` is.
 * @param {Combatant} combatant - The combatant to read.
 * @returns {number} Segments to add to the unit's roll.
 */
const declaredOffsetFor = (combatant) => {
  const rules = combatant.parent?.initiativeConfig?.rules
  if (typeof rules?.getInitiativeOffset !== "function") return 0

  const offset = rules.getInitiativeOffset({
    combatant,
    actor: combatant.actor ?? null,
    group: combatant.rollingGroup,
    base: baseRollFor(combatant),
    round: combatant.parent?.round ?? 0,
    declaration: combatant.declaration,
    declarationType: combatant.declarationType,
  })

  return Number.isFinite(offset) ? offset : 0
}

/**
 * A combatant whose initiative is derived rather than stored.
 *
 * The rule this class exists to enforce:
 *
 * > Stored initiative is always the raw roll of whichever unit rolled.
 * > Derived initiative is that roll plus this combatant's own offset.
 *
 * In B/X the offset is always zero and the two are the same number. In AD&D they
 * are not: a side rolls once, and then each caster adds their spell's casting
 * time to work out which segment it goes off in. Members of one side genuinely
 * act at different moments, so the unit's roll is a starting point rather than
 * an answer.
 */
export default class BAGSCombatant extends foundry.documents.Combatant {
  /**
   * The group this combatant rolled with, as a document.
   *
   * Resolved from source rather than read off `this.group`, which is a schema
   * field and therefore holds a plain string id until core's `_prepareGroup`
   * swaps in the document on its last line. When the id does not resolve -- a
   * group that was deleted out from under its members, which Foundry does not
   * cascade -- `this.group` keeps that dangling string, and anything that treats
   * a truthy `this.group` as a document reads `undefined` off it.
   * @type {CombatantGroup|null}
   */
  get rollingGroup() {
    return this.parent?.groups?.get(this._source.group) ?? null
  }

  /**
   * Which faction this combatant fights for.
   *
   * A grouped combatant always takes its group's side. Only an ungrouped one
   * falls back to its own stored value.
   * @type {string}
   */
  get side() {
    return this.rollingGroup?.system?.side || this.system?.side || SIDES.HOSTILE
  }

  /**
   * What this combatant says it is about to do.
   *
   * A combatant's own declaration always beats its group's. The group-level one
   * is for a GM running a mob that acts as one; being auto-grouped into the
   * party should not cost a player the ability to speak for themselves.
   * @type {object|null}
   */
  get declaration() {
    const own = this.system?.declaration
    if (own?.type) return own

    const shared = this.rollingGroup?.system?.declaration
    if (shared?.type) return shared

    return null
  }

  /**
   * Whether this combatant was caught off guard as the fight began.
   *
   * Only ever set in the first round. Under a ruleset where surprise costs
   * segments, `segments` says how many.
   * @type {{_id: string, segments: number}|null}
   */
  get surprise() {
    return surpriseFor(this)
  }

  /**
   * The resolved record for whatever was declared.
   *
   * Never null: an undeclared combatant resolves to `NO_DECLARATION`, so a
   * ruleset's offset hook is spared a null check and can give indecision its own
   * cost if it wants to.
   * @type {object}
   */
  get declarationType() {
    return this.declaration
      ? resolveDeclarationType(this.declaration.type)
      : NO_DECLARATION
  }

  /**
   * How far this combatant's action shifts it away from its unit's roll.
   *
   * The ruleset decides. B/X has nothing that moves a combatant within its
   * side, so its modules do not implement the hook at all and this stays zero;
   * AD&D's weapon speed factors and casting times are exactly what it is for.
   * Keeping the logic on the rules module rather than on the declaration type is
   * what gives the undeclared case somewhere to live.
   *
   * Surprise is added on top, in a ruleset where it costs segments rather than
   * the whole round: a combatant who lost three segments acts three segments
   * later than they otherwise would.
   * @returns {number} An adjustment added to the unit's roll.
   */
  get initiativeOffset() {
    return declaredOffsetFor(this) + surpriseDelayFor(this)
  }

  /**
   * Every segment this combatant acts on this round.
   *
   * One entry per attack, ascending. A ruleset without attack routines never
   * implements the hook, so this is a single-entry array holding whatever
   * `base + offset` came to -- which keeps every caller free of "does this game
   * have multiple attacks" branching.
   *
   * Only the first entry orders the combatant in the tracker, because `turns`
   * holds one row each (§10.3). The rest is what the round card's segment ladder
   * draws, which is the only place a fighter's second attack becomes visible.
   * @returns {number[]|null} Ascending segments, or null if the unit has not
   * rolled.
   */
  get attackSegments() {
    const config = this.parent?.initiativeConfig

    // An action carried over from last round lands where it lands. Checked
    // before the roll, because it does not depend on one.
    const carried = carriedSegmentFor(this)
    if (carried !== null) return [clampSegment(carried, config?.roundLength)]

    const base = baseRollFor(this)
    if (base === null) return null

    const derived = base + this.initiativeOffset
    const rules = config?.rules

    if (typeof rules?.getAttackRoutine !== "function") return [derived]

    const segments = rules.getAttackRoutine({
      combatant: this,
      actor: this.actor ?? null,
      group: this.rollingGroup,
      round: this.parent?.round ?? 0,
      segment: derived,
      spacing: config.attackSpacing,
      roundLength: config.roundLength,
      declaration: this.declaration,
      declarationType: this.declarationType,
    })

    // A ruleset returning nothing usable must not cost the combatant its turn.
    if (!Array.isArray(segments) || !segments.length) return [derived]

    return segments
      .filter((segment) => Number.isFinite(segment))
      .map((segment) => clampSegment(segment, config.roundLength))
      .sort((a, b) => a - b)
  }

  /**
   * A position this combatant's ruleset chose outright, rather than derived.
   *
   * Null in every ruleset without attack routines, which is most of them -- and
   * that distinction is the point. `attackSegments` always returns something so
   * its callers need no branching, but a value that merely *equals*
   * `base + offset` is not a chosen position, and passing it to the engine as
   * one would make every ruleset look like it overrode its own ordering.
   * @returns {number|null} The earliest segment, or null when nothing placed it.
   */
  get placedSegment() {
    // A carried action is placed in every ruleset that carries them.
    if (carriedSegmentFor(this) !== null) return this.attackSegments[0]

    const rules = this.parent?.initiativeConfig?.rules
    if (typeof rules?.getAttackRoutine !== "function") return null

    return this.attackSegments?.[0] ?? null
  }

  /**
   * Whether this combatant is still busy with an action begun last round.
   * @type {boolean}
   */
  get carried() {
    return carriedSegmentFor(this) !== null
  }

  /**
   * Where this combatant's action runs into the next round, if it does: a
   * spell begun too late to go off in this one.
   * @type {{round: number, segment: number}|null}
   */
  get spillover() {
    return spilloverFor(
      this,
      rawSegmentFor(this, baseRollFor(this), declaredOffsetFor(this)),
    )
  }

  /**
   * Work out the number this combatant is actually ordered by.
   *
   * Reads only from source data and from the group's own stored value, never
   * from `this.initiative`. Data preparation can run more than once for a single
   * document, and a version of this that read its own previous output would
   * compound the offset each time.
   * @returns {number|null} Effective initiative, or null if the unit has not
   * rolled.
   */
  get effectiveInitiative() {
    // Under a spacing strategy that ignores the roll -- "first attack on segment
    // 1" -- the position was chosen rather than calculated, and no sum of a roll
    // and an adjustment could produce it. A carried action is the same.
    const placed = this.placedSegment
    if (placed !== null) return placed

    const base = baseRollFor(this)
    if (base === null) return null
    return base + this.initiativeOffset
  }

  /**
   * Whether this combatant's declaration is settled for the round.
   *
   * Declaring is a commitment made *before* the round is played -- that is the
   * whole point of it in the Advanced games. Declarations are taken before the
   * fight starts and between rounds; once a round has begun, the commitment is
   * made.
   *
   * It is also a correctness matter rather than only a fictional one. Changing a
   * declaration changes the offset, which changes the segment, which re-sorts
   * `turns`; under segments that can drop a combatant who has already acted back
   * in front of the cursor and hand them a second turn. In the Basic/Expert
   * family offsets are always zero, so a declaration only moves someone within
   * their own side's phases -- which only matters when stepping one combatant
   * at a time.
   * @type {boolean}
   */
  get declarationsLocked() {
    const combat = this.parent
    if (!combat?.started) return false

    const config = combat.initiativeConfig
    if (config?.declarationMode === DECLARATION_MODE.OFF) return false

    // Still casting last round's spell. There is nothing to declare until it
    // goes off, and changing the declaration would cancel a spell that is
    // half cast -- a ruling for the referee, not a dropdown.
    if (carriedSegmentFor(this) !== null) return true

    // Only where a declaration can move someone past the cursor. In the
    // Basic/Expert family every member of a side shares its roll, so a change
    // of mind never moves anyone out of their side. It can move them *within*
    // it, now that a side's turn runs in phases -- but while the cursor steps a
    // whole side at a time that is harmless, since the side acts as one. Only
    // stepping one combatant at a time gives a reshuffled side a cursor to
    // jump back past.
    const reordersAcrossUnits = config?.turnOrder?.perMemberOffsets === true
    const reordersWithinUnit =
      config?.phases?.length > 0 &&
      config.granularity === TURN_GRANULARITY.COMBATANT
    if (!reordersAcrossUnits && !reordersWithinUnit) return false

    // Locked by the round beginning, not by the dice. Keying on the roll used
    // to lock everyone for the rest of the fight under the "keep" cadence,
    // where last round's roll is still there when the next round's
    // declarations are wanted. Between rounds the cursor is on nobody.
    return combat.turn !== null
  }

  /**
   * Refuse a declaration that arrives after the round has begun, and carry a
   * group's roll to a combatant leaving it (see `#takeGroupRollOnLeaving`).
   *
   * The declaration lock is enforced on the writing client rather than server-side, because Foundry runs
   * no system code on the server -- only schema validation, which cannot express
   * "depends on whether this combat has rolled". That is proportionate: this
   * exists to stop a well-meaning mid-round edit from silently reordering a
   * round, not to defend against a player editing their own browser.
   *
   * A GM is never blocked. Overriding a declaration is a normal thing for a
   * referee to do, and the interface offers no other way to correct a mistake.
   * @inheritDoc
   */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user)
    if (allowed === false) return false

    this.#takeGroupRollOnLeaving(changes)

    if (!changes.system?.declaration) return allowed
    if (user?.isGM) return allowed
    if (!this.declarationsLocked) return allowed

    // Said out loud, because the alternative is a button that does nothing. An
    // earlier version of this feature failed silently for players and only for
    // players, and it took a while to find.
    ui.notifications.warn(
      game.i18n.format("BAGS.Combat.Declarations.Locked", {
        name: this.name,
      }),
    )

    return false
  }

  /**
   * Give a combatant its group's roll as it leaves the group.
   *
   * A grouped combatant's own stored roll is never read -- the group's is used
   * instead -- so it is whatever was there before they joined, which may be
   * from rounds ago. Without this, taking someone out of a group would hand
   * them that old roll and move them somewhere arbitrary in the order. Taking
   * the group's roll instead keeps them where they were: they were acting with
   * the group a moment ago, and leaving it is not a reason to act at a
   * different time. If the group has not rolled, neither have they.
   *
   * Applies however the combatant leaves: ungrouped from the tracker or the
   * group manager, moved to another group, or released because the group was
   * deleted. An update that sets an initiative of its own is left alone.
   * @param {object} changes - The pending changes, modified in place.
   * @returns {void}
   */
  #takeGroupRollOnLeaving(changes) {
    if (!("group" in changes) || "initiative" in changes) return

    const group = this.rollingGroup
    if (!group || changes.group === group.id) return

    // Writing to `changes` is how a pre-update hook amends the update.
    // eslint-disable-next-line no-param-reassign
    changes.initiative = Number.isFinite(group.initiative)
      ? group.initiative
      : null
  }

  /**
   * Replace core's initiative assignment with the offset-adjusted value.
   *
   * The design document nominates `_prepareGroup` as the override point. This
   * overrides `prepareDerivedData` instead, which is where core calls
   * `_prepareGroup` from, and unconditionally -- so one assignment here covers
   * grouped and ungrouped combatants alike, where hooking `_prepareGroup` would
   * mean either a second assignment for the ungrouped case or a method whose
   * name promises it only touches groups doing rather more than that.
   * @inheritDoc
   */
  prepareDerivedData() {
    // Core's implementation ends by calling `_prepareGroup`, which resolves
    // `this.group` to a document and assigns the group's raw roll to
    // `this.initiative`. That raw roll is the base this then adjusts.
    super.prepareDerivedData()

    this.initiative = this.effectiveInitiative
  }
}
