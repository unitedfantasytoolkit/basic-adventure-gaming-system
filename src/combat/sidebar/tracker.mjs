/**
 * @file The combat tracker sidebar tab.
 *
 * Foundry's own tracker draws one flat row per combatant, which is the right
 * shape for a game where everyone rolls for themselves and the wrong one for a
 * game where a side rolls once. This subclass replaces the list part -- and only
 * the list part -- with one that draws a block per rolling unit.
 *
 * The header and footer are left alone deliberately. Their buttons already
 * dispatch through `combat[action]()`, so "roll all", "next turn" and the rest
 * reach the overrides on BAGSCombat without any work here.
 */

import { SYSTEM_TEMPLATE_PATH } from "../../config/constants.mjs"
import { NO_DECLARATION } from "../declarations.mjs"
import {
  DECLARATION_MODE,
  TURN_GRANULARITY,
  safeSetting,
} from "../initiative-config.mjs"
import { movementStatusFor } from "../movement.mjs"
import { SIDE_LABELS, colorForGroup } from "../sides.mjs"
import { storedSurprise } from "../surprise.mjs"
import {
  canCheckMorale,
  moraleTriggerLabel,
  moraleUnitName,
} from "../morale.mjs"
import { SURPRISE_EFFECT } from "../../rules-engines/surprise.mjs"
import { phaseIndexOf } from "../../rules-engines/turn-order.mjs"

/**
 * Can this user roll for a rolling unit?
 *
 * Groups fall back to Foundry's document ownership, which a GM can grant to a
 * player so that the party rolls its own initiative. Ungrouped combatants use
 * the ownership the tracker already worked out.
 * @param {CombatantGroup|null} group - The group, if the unit is one.
 * @param {object} turn - Core's render context for the first member.
 * @returns {boolean} Whether to offer a roll control.
 */
const canRollUnit = (group, turn) => {
  if (game.user.isGM) return true
  if (group) return group.testUserPermission(game.user, "OWNER")
  return turn.isOwner
}

/**
 * Arrange rows into the segments they act on.
 *
 * The same shape the round card's ladder uses, and deliberately so: everyone on
 * one stop acted at the same moment, which is what all five rulesets say a tie
 * means and what a flat list cannot express. Drawing the sidebar and the card
 * alike also spares a table one of the two things it would otherwise have to
 * learn about segments.
 *
 * **One row per combatant, placed at the segment they act on first.** The card
 * repeats a combatant once per attack, which it can afford to -- it is captured
 * display data. The tracker cannot: `turns` holds one row each, and a duplicated
 * `data-combatant-id` would give core two rows to bind a context menu to and
 * would light both of them as the active turn. A row's extra segments are shown
 * on the row instead.
 * @param {object[]} units - The rolling units, each with its members.
 * @returns {{ladder: object[], pending: object[]}} Segments, ascending, and
 * everyone with no segment yet.
 */
const buildLadder = (units) => {
  const bySegment = new Map()
  const pending = []

  units.forEach((unit) => {
    unit.members.forEach((turn) => {
      const segment = turn.segments?.[0]

      if (!Number.isFinite(segment)) {
        pending.push(turn)
        return
      }

      if (!bySegment.has(segment)) bySegment.set(segment, [])
      bySegment.get(segment).push(turn)
    })
  })

  return {
    ladder: [...bySegment.entries()]
      .sort(([a], [b]) => a - b)
      .map(([segment, members]) => ({
        segment,
        members,
        active: members.some((member) => member.active),
      })),
    pending,
  }
}

/**
 * Describe the wait between rounds, if the encounter is in it.
 *
 * Between rounds nobody has the turn, so the list alone would look stalled.
 * This says what the round is waiting for -- declarations, morale checks, or
 * the referee's dice -- and gives the referee a way to stop waiting.
 *
 * Morale checks are listed for the referee only. Which monsters are wavering
 * is theirs to know; a player is told only that the referee has something to
 * do.
 * @param {Combat} combat - The encounter on screen.
 * @returns {object|null} What to show, or null when a round is under way.
 */
const betweenRoundsContext = (combat) => {
  if (!combat.betweenRounds) return null

  const waitingOn = combat.undeclaredPlayerCombatants
    .filter((combatant) => combatant.visible)
    .map((combatant) => combatant.name)
  const { pendingMorale } = combat

  let status = game.i18n.localize("BAGS.Combat.Round.WaitingOnRoll")
  if (waitingOn.length) {
    status = game.i18n.format("BAGS.Combat.Round.WaitingOnNames", {
      names: new Intl.ListFormat(game.i18n.lang).format(waitingOn),
    })
  } else if (pendingMorale.length) {
    status = game.i18n.localize(
      game.user.isGM
        ? "BAGS.Combat.Morale.Waiting"
        : "BAGS.Combat.Round.WaitingOnReferee",
    )
  }

  return {
    round: combat.round,
    status,
    canBegin: game.user.isGM,
    morale: game.user.isGM
      ? pendingMorale.map((check) => ({
          name: moraleUnitName(combat, check.unit),
          reason: moraleTriggerLabel(check.trigger),
        }))
      : [],
  }
}

/**
 * What a row says its combatant has declared.
 * @param {Combatant} combatant - The combatant.
 * @param {boolean} hidden - Whether declarations are being kept from this
 * viewer right now (see `BAGSCombat#declarationsHidden`).
 * @returns {object|null} The tag to draw, or null when nothing was declared.
 */
const declarationTag = (combatant, hidden) => {
  const declared = combatant.declarationType
  if (declared.id === NO_DECLARATION.id) return null

  // Blind: that they have declared, but not what. Your own you always see.
  if (hidden && !combatant.isOwner) {
    return {
      label: game.i18n.localize("BAGS.Combat.Declarations.Hidden"),
      icon: "fa-solid fa-comment-dots",
      inherited: false,
    }
  }

  return {
    label: game.i18n.localize(declared.label),
    icon: declared.icon,
    // A declaration a combatant did not make itself comes from the mob it is
    // part of, and is worth distinguishing.
    inherited: !combatant.system?.declaration?.type,
  }
}

/**
 * Label the phases inside each unit's block.
 *
 * In B/X a side's turn runs in steps -- move, shoot, cast, fight -- and its
 * members are already sorted into them. A heading where the step changes says
 * so. Only drawn in a unit where somebody has declared: otherwise everyone is
 * in the same "after the phases" bucket, and a heading would only add noise.
 * @param {object[]} units - The rolling units, each with its members.
 * @param {Combat} combat - The encounter on screen.
 * @returns {void}
 */
const labelPhases = (units, combat) => {
  const { phases } = combat.initiativeConfig
  if (!phases.length) return

  const labelFor = (index) =>
    game.i18n.localize(phases[index]?.label ?? "BAGS.Combat.Phases.Other")

  units.forEach((unit) => {
    const indices = unit.members.map((turn) =>
      phaseIndexOf(
        combat.combatants.get(turn.id)?.declarationType.id ?? null,
        phases,
      ),
    )
    if (!indices.some((index) => index < phases.length)) return

    unit.members.forEach((turn, position) => {
      if (indices[position] !== indices[position - 1]) {
        Object.assign(turn, { phaseHeading: labelFor(indices[position]) })
      }
    })
  })
}

/**
 * Describe surprise, if there is anything to say about it.
 *
 * A referee sees this before the fight and while the first round waits, so the
 * roll is offered at the moment it belongs to. Everyone sees who was surprised
 * for as long as it matters, which is the first round.
 * @param {Combat} combat - The encounter on screen.
 * @returns {object|null} What to show, or null when there is nothing to say.
 */
const surpriseContext = (combat) => {
  if (!combat.initiativeConfig.surprise) return null

  const stored = storedSurprise(combat)
  const canRoll = game.user.isGM && combat.canChangeSurprise
  if (!canRoll && !(stored && combat.round <= 1)) return null

  const names = combat.turns
    .filter((combatant) => combatant.surprise && combatant.visible)
    .map((combatant) => combatant.name)

  let summary = game.i18n.localize("BAGS.Combat.Surprise.NotRolled")
  if (names.length) {
    summary = game.i18n.format("BAGS.Combat.Surprise.SurprisedNames", {
      names: new Intl.ListFormat(game.i18n.lang).format(names),
    })
  } else if (stored) {
    summary = game.i18n.localize("BAGS.Combat.Surprise.Nobody")
  }

  // Nothing worth a strip for a player: nobody they can see was surprised.
  if (!canRoll && !names.length) return null

  return { summary, canRoll, rolled: !!stored }
}

/**
 * A combat tracker that groups combatants by whatever rolled for them.
 */
export default class BAGSCombatTracker extends foundry.applications.sidebar.tabs
  .CombatTracker {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    actions: {
      rollUnit: BAGSCombatTracker.#onRollUnit,
      beginRound: BAGSCombatTracker.#onBeginRound,
      rollSurprise: BAGSCombatTracker.#onRollSurprise,
      clearSurprise: BAGSCombatTracker.#onClearSurprise,
      rollMorale: BAGSCombatTracker.#onRollMorale,
      skipMorale: BAGSCombatTracker.#onSkipMorale,
      manageGroups: BAGSCombatTracker.#onManageGroups,
      declareAction: BAGSCombatTracker.#onDeclareAction,
      adjustInitiative: BAGSCombatTracker.#onAdjustInitiative,
      trackerSettings: BAGSCombatTracker.#onConfigure,
    },
  }

  /** @inheritdoc */
  static PARTS = {
    ...super.PARTS,
    tracker: {
      template: `${SYSTEM_TEMPLATE_PATH}/combat/tracker.hbs`,
      scrollable: [""],
    },
  }

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  /**
   * Gather the flat turn order into one entry per rolling unit.
   *
   * Core builds `context.turns` in turn order and skips combatants this viewer
   * cannot see. Walking that array rather than the combat's own collections
   * keeps both properties: units come out in the order they act, and a hidden
   * combatant stays hidden.
   * @inheritDoc
   */
  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options)

    const combat = this.viewed
    if (!combat) return

    const config = combat.initiativeConfig
    const declarationsOn = config.declarationMode !== DECLARATION_MODE.OFF
    const hidden = combat.declarationsHidden && !game.user.isGM
    // Once members of one side act at different moments they are no longer
    // contiguous in the turn order -- a caster's spell landing after the orcs
    // have swung is the rule working, not a sorting fault -- so there are no
    // blocks left to draw. The tracker falls back to a flat list, and each row
    // carries a badge naming the unit it rolled with.
    const isFlat = config.turnOrder?.perMemberOffsets === true
    const showMovement = safeSetting("showMovementBudget", true)
    const unitGranularity = config.granularity === TURN_GRANULARITY.UNIT
    const losesSegments = config.surprise?.effect === SURPRISE_EFFECT.SEGMENTS
    const turnsById = new Map((context.turns ?? []).map((t) => [t.id, t]))

    const units = []
    const byKey = new Map()

    combat.turns.forEach((combatant) => {
      const turn = turnsById.get(combatant.id)
      if (!turn) return

      const group = combatant.rollingGroup
      const key = group?.id ?? combatant.id

      let unit = byKey.get(key)
      if (!unit) {
        const canRoll = canRollUnit(group, turn)
        const hasInitiative = turn.initiative !== null && turn.initiative !== ""
        const side = group?.system?.side || combatant.system?.side || null
        const name = group?.name || turn.name
        const sideLabel = side ? game.i18n.localize(SIDE_LABELS[side]) : null

        unit = {
          id: key,
          isGroup: !!group,
          name,
          img: group?.img || turn.img,
          side,
          // Written inline rather than left to a `[data-side]` stylesheet rule,
          // so that a group's own colour and the side's default resolve in one
          // place instead of two that can disagree.
          color: group ? colorForGroup(group) : null,
          // Auto-created groups are named after the side they fight for, so
          // showing both would read "Party — PARTY". The colour already says
          // which side this is; the label only earns its place once a GM has
          // renamed the group to something else.
          sideLabel:
            sideLabel && sideLabel.toLowerCase() !== name.toLowerCase()
              ? sideLabel
              : null,
          initiative: turn.initiative,
          canRoll,
          hasInitiative,
          // The block header's copy of the adjustment control. A flat list has
          // no headers, so there it goes on a row instead.
          canAdjust: !isFlat && !!group && canRoll && hasInitiative,
          active: false,
          // Whether the one control for shifting this unit's roll has been
          // given to a row yet. See `canAdjustInitiative` below.
          adjustOffered: false,
          members: [],
        }
        byKey.set(key, unit)
        units.push(unit)
      }

      // Declarations are shown inline so "who has declared" is legible without
      // opening anything -- and, since they are optional, so that a blank is
      // visibly a blank rather than an unanswered question.
      Object.assign(turn, {
        // Withdrawn once the round begins, so nobody is offered a control that
        // would refuse them. A GM keeps it -- correcting a declaration is a
        // normal referee job, and this is the only way to do it.
        canDeclare:
          declarationsOn &&
          combatant.isOwner &&
          (game.user.isGM || !combatant.declarationsLocked),
        declaration: declarationTag(combatant, hidden),
        // Under lost segments the tag says how many, since that is the whole
        // of what surprise did to them. Under a lost round it needs no number.
        surprise: combatant.surprise
          ? { segments: losesSegments ? combatant.surprise.segments : null }
          : null,
        // A spell that will not go off until next round, and one carried over
        // from last round. Both say when it lands, because "last" on a ladder
        // and "first" on the next one are otherwise indistinguishable from an
        // ordinary turn.
        spillover: combat.started ? combatant.spillover : null,
        carried: combatant.carried ? { segment: combatant.initiative } : null,
      })

      unit.members.push(turn)
      if (turn.active) unit.active = true

      // When the cursor steps a whole unit at a time, "whose turn is it" is
      // answered by the side, not by one of its members -- the side acts at
      // once, and any of its rows may resolve first. Highlighting a single row
      // implies an order within the side that does not exist, so the highlight
      // moves to the block header instead, which is already styled for it.
      if (unitGranularity && unit.isGroup) {
        turn.css = (turn.css ?? "")
          .split(" ")
          .filter((name) => name && name !== "active")
          .join(" ")
      }

      // What a flat row needs that a grouped one gets from its block: which
      // side it fights for, and the segments it acts on. Assigned even in block
      // mode, because it costs nothing and keeps the two paths reading alike.
      Object.assign(turn, {
        side: unit.side,
        color: unit.color,
        unitId: unit.id,
        unitName: unit.isGroup ? unit.name : null,
        canRollUnit: unit.canRoll,
        // Whether this row's score is its own to edit. A grouped combatant's is
        // derived from its unit's roll, and a player cannot write to a group
        // anyway. Keyed on the row rather than on which layout is being drawn,
        // because a flat list has grouped rows in it too.
        ownsInitiative: !unit.isGroup,
        // On a ladder the stop a row hangs from already shows its segment, so a
        // rolled row needs no initiative control. An unrolled one still needs
        // its die: in an edition where everyone rolls alone, it is the only way
        // a player has to roll for their own character.
        showInitiativeControl:
          !unit.isGroup && (!isFlat || !unit.hasInitiative),
        // Only while a fight is actually running: before that everyone's
        // allowance is untouched, and a row of full bars says nothing.
        movement:
          showMovement && combat.started ? movementStatusFor(combatant) : null,
        // Adjusting is offered to whoever could have rolled the unit, and only
        // once there is a roll to adjust -- shifting nothing by two is not a
        // meaningful request, and answering it by rolling first would hand out a
        // roll nobody asked for.
        //
        // Once per unit, because a group has one roll: the same button on every
        // member's row reads as though each could be moved on their own. In
        // blocks the group's header carries it; on a flat list, which has no
        // header, the group's first row does.
        canAdjustInitiative:
          unit.canRoll &&
          unit.hasInitiative &&
          (!unit.isGroup || (isFlat && !unit.adjustOffered)),
        segments: combatant.attackSegments ?? null,
        // Only worth showing when there is more than one; a single segment is
        // the initiative already displayed beside it.
        extraSegments:
          combatant.attackSegments?.length > 1
            ? combatant.attackSegments.slice(1)
            : null,
      })
      if (turn.canAdjustInitiative) unit.adjustOffered = true
    })

    // Blocks only: a flat list is the segment games, which have no phases.
    // Not while declarations are blind, either, since a "Magic" heading over
    // someone's row says what they declared.
    if (!isFlat && !hidden) labelPhases(units, combat)

    Object.assign(context, {
      units,
      isFlat,
      ...(isFlat ? buildLadder(units) : { ladder: [], pending: [] }),
      // Only draw unit chrome when something is actually grouped. A world
      // running individual initiative gets the plain list it expects.
      showUnits: !isFlat && units.some((unit) => unit.isGroup),
      canManageGroups: game.user.isGM && !!combat,
      rollsByGroup: config.rollsByGroup,
      betweenRounds: betweenRoundsContext(combat),
      surprise: surpriseContext(combat),
    })
  }

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  /**
   * Roll initiative for one rolling unit.
   * @this {BAGSCombatTracker}
   * @param {PointerEvent} event - The triggering event.
   * @param {HTMLElement} target - The button that was clicked.
   * @returns {Promise<void>} Resolves once the roll is written.
   */
  static async #onRollUnit(event, target) {
    const combat = this.viewed
    const { unitId } = target.closest("[data-unit-id]")?.dataset ?? {}
    if (!combat || !unitId) return

    const unit =
      combat.groups.get(unitId) ?? combat.combatants.get(unitId) ?? null
    if (!unit) return

    await combat.rollUnitInitiative([unit])
  }

  /**
   * Start the round that is waiting, rolling for anyone who has not rolled.
   * @this {BAGSCombatTracker}
   * @returns {Promise<void>} Resolves once the round has begun.
   */
  static async #onBeginRound() {
    await this.viewed?.beginRound()
  }

  /**
   * Roll surprise for every side.
   * @this {BAGSCombatTracker}
   * @returns {Promise<void>} Resolves once the roll is written.
   */
  static async #onRollSurprise() {
    await this.viewed?.rollSurprise()
  }

  /**
   * Forget the surprise roll.
   * @this {BAGSCombatTracker}
   * @returns {Promise<void>} Resolves once the write lands.
   */
  static async #onClearSurprise() {
    await this.viewed?.clearSurprise()
  }

  /**
   * Make the morale checks the waiting round is held up for.
   * @this {BAGSCombatTracker}
   * @returns {Promise<void>} Resolves once the checks are made.
   */
  static async #onRollMorale() {
    await this.viewed?.resolvePendingMorale()
  }

  /**
   * Let the waiting round go ahead without its morale checks.
   * @this {BAGSCombatTracker}
   * @returns {Promise<void>} Resolves once the write lands.
   */
  static async #onSkipMorale() {
    await this.viewed?.skipPendingMorale()
  }

  /**
   * Open the declaration dialog for one combatant.
   * @this {BAGSCombatTracker}
   * @param {PointerEvent} event - The triggering event.
   * @param {HTMLElement} target - The button that was clicked.
   * @returns {Promise<void>} Resolves once the dialog is rendered.
   */
  static async #onDeclareAction(event, target) {
    const { combatantId } = target.closest("[data-combatant-id]")?.dataset ?? {}
    const combatant = this.viewed?.combatants.get(combatantId)
    if (!combatant) return

    const { default: BAGSDeclarationDialog } = await import("./declaration.mjs")
    new BAGSDeclarationDialog({ combatant }).render({ force: true })
  }

  /**
   * Shift a rolled initiative up or down.
   *
   * Asks for the amount rather than stepping by one, because the reasons a table
   * shifts initiative -- a metacurrency spent, a class feature, a ruling -- come
   * with their own sizes, and clicking a button five times to spend five points
   * is not an interface.
   *
   * The dialog names whatever will actually be written to, which under side
   * initiative is the whole side. That is worth saying plainly: a player
   * expecting to buy their own character a better moment has instead bought it
   * for everyone, and there is no version of this where that is a surprise
   * worth preserving.
   * @this {BAGSCombatTracker}
   * @param {PointerEvent} event - The triggering event.
   * @param {HTMLElement} target - The button that was clicked.
   * @returns {Promise<void>} Resolves once the adjustment is written.
   */
  static async #onAdjustInitiative(event, target) {
    const combat = this.viewed
    // From a row, or from a group's header -- which has no combatant of its
    // own, so any member stands in for the group it belongs to.
    const { combatantId } = target.closest("[data-combatant-id]")?.dataset ?? {}
    const { unitId } = target.closest("[data-unit-id]")?.dataset ?? {}
    const combatant =
      combat?.combatants.get(combatantId) ??
      combat?.groups.get(unitId)?.members.values().next().value ??
      null
    if (!combatant) return

    const group = combatant.rollingGroup
    const unit = group ?? combatant
    const { DialogV2 } = foundry.applications.api
    const hint = group
      ? "BAGS.Combat.Initiative.AdjustGroupHint"
      : "BAGS.Combat.Initiative.AdjustHint"

    const delta = await DialogV2.prompt({
      window: { title: "BAGS.Combat.Initiative.Adjust" },
      content: `
        <p>${game.i18n.format(hint, {
          name: foundry.utils.escapeHTML(unit.name ?? combatant.name),
          current: unit.initiative,
        })}</p>
        <input type="number" name="delta" value="0" step="1" autofocus>
      `,
      ok: {
        label: "BAGS.Combat.Initiative.Apply",
        callback: (_event, button) => Number(button.form.delta.value),
      },
      rejectClose: false,
    })

    if (!Number.isFinite(delta) || delta === 0) return

    await combat.adjustInitiative(combatant.id, delta)
  }

  /**
   * Open the tracker's configuration, with the system's own preferences in it.
   *
   * Core's gear button points at its own dialog; this replaces that so the
   * turn-sequence settings are where a referee will look for them.
   * @returns {Promise<void>} Resolves once the dialog is rendered.
   */
  static async #onConfigure() {
    const { default: BAGSCombatTrackerConfig } = await import(
      "./tracker-config.mjs"
    )
    new BAGSCombatTrackerConfig().render({ force: true })
  }

  /**
   * Open the group manager.
   * @this {BAGSCombatTracker}
   * @returns {Promise<void>} Resolves once the app is rendered.
   */
  static async #onManageGroups() {
    const combat = this.viewed
    if (!combat) return

    const { default: BAGSGroupManager } = await import("./group-manager.mjs")
    new BAGSGroupManager({ combat }).render({ force: true })
  }

  // ===========================================================================
  // CONTEXT MENU
  // ===========================================================================

  /**
   * Add "take out of its group" to the per-combatant context menu.
   *
   * Reassigning a combatant is GM-only whether we like it or not: Foundry's
   * Combatant permissions let a player write `initiative`, `flags`, `defeated`
   * and `system`, but not `group`.
   * @inheritDoc
   */
  _getEntryContextOptions() {
    const combatantFrom = (li) =>
      this.viewed?.combatants.get(li.dataset.combatantId)

    return [
      ...super._getEntryContextOptions(),
      {
        label: "BAGS.Combat.Groups.Ungroup",
        icon: '<i class="fa-solid fa-link-slash"></i>',
        visible: (li) => game.user.isGM && !!combatantFrom(li)?.rollingGroup,
        onClick: (event, li) => combatantFrom(li)?.update({ group: null }),
      },
      // By hand, for what the dice do not cover: the sentry who was asleep,
      // the one character looking the right way.
      {
        label: "BAGS.Combat.Surprise.Mark",
        icon: '<i class="fa-solid fa-bolt"></i>',
        visible: (li) =>
          game.user.isGM &&
          !!this.viewed?.canChangeSurprise &&
          !combatantFrom(li)?.surprise,
        onClick: (event, li) =>
          this.viewed?.setSurprised(combatantFrom(li), true),
      },
      {
        label: "BAGS.Combat.Surprise.Unmark",
        icon: '<i class="fa-solid fa-eye"></i>',
        visible: (li) =>
          game.user.isGM &&
          !!this.viewed?.canChangeSurprise &&
          !!combatantFrom(li)?.surprise,
        onClick: (event, li) =>
          this.viewed?.setSurprised(combatantFrom(li), false),
      },
      // For the moments the automatic checks do not cover: a spell of fear, a
      // referee's sense that the goblins have had enough.
      {
        label: "BAGS.Combat.Morale.Check",
        icon: '<i class="fa-solid fa-person-running"></i>',
        visible: (li) => {
          const combatant = combatantFrom(li)
          return (
            game.user.isGM &&
            !!this.viewed?.initiativeConfig.morale &&
            !!combatant &&
            canCheckMorale(combatant)
          )
        },
        onClick: (event, li) => this.viewed?.rollMorale([combatantFrom(li)]),
      },
    ]
  }

  /**
   * Add group management to the encounter menu.
   *
   * This lives beside "Reset Initiative" and "End Combat" rather than as a
   * button in the list, because the tracker part has to render exactly one root
   * element -- and because organising sides is an encounter-level decision, which
   * is precisely what that menu is for.
   * @inheritDoc
   */
  _getCombatContextOptions() {
    return [
      {
        label: "BAGS.Combat.Groups.Manage",
        icon: '<i class="fa-solid fa-flag"></i>',
        visible: () => game.user.isGM && !!this.viewed,
        onClick: () => BAGSCombatTracker.#onManageGroups.call(this),
      },
      {
        // Declarations clear themselves as every round closes. This is for
        // the rounds that go wrong -- a misread, a rules argument, a player who
        // declared for the wrong character -- where the table wants to say what
        // it is doing again without waiting for the round to end.
        label: "BAGS.Combat.Declarations.ClearAll",
        icon: '<i class="fa-solid fa-comment-slash"></i>',
        visible: () =>
          game.user.isGM &&
          !!this.viewed &&
          this.viewed.initiativeConfig.declarationMode !== DECLARATION_MODE.OFF,
        onClick: () => this.viewed?.clearDeclarations(),
      },
      ...super._getCombatContextOptions(),
    ]
  }

  /**
   * Work around a core crash when a combat other than the viewed one updates.
   *
   * `CombatTracker._onRender` (`combat-tracker.mjs:186-188`) reads:
   *
   * ```js
   * let data = {}
   * if ( Array.isArray(renderData) ) data = renderData.find(d => d._id === this.viewed?.id)
   * if ( … && ("turn" in data) ) {
   * ```
   *
   * `Array#find` returns `undefined` when nothing matches, which overwrites the
   * `{}` default -- and `"turn" in undefined` throws. It misses whenever an
   * update lands on a combat that is not the one on screen, or when no combat is
   * viewed at all, and the exception surfaces as an unhandled rejection with no
   * hint of where it came from.
   *
   * Nothing is lost by skipping the branch: all it does is scroll the active
   * combatant into view, and the combat it would scroll for is not the one being
   * displayed. Core still runs when the data is well-formed, so the scrolling
   * that matters is untouched.
   *
   * Remove this once core guards that lookup.
   * @inheritDoc
   */
  async _onRender(context, options) {
    const data = Array.isArray(options?.renderData)
      ? options.renderData.find((entry) => entry._id === this.viewed?.id)
      : {}

    if (data === undefined) {
      await super._onRender(context, { ...options, renderData: undefined })
      return
    }

    await super._onRender(context, options)
  }
}
