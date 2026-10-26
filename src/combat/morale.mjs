/**
 * @file Morale: which monsters owe a check, rolling it, and marking the ones
 * who break.
 *
 * The rules -- when a check is owed, what fails -- live in
 * `src/rules-engines/morale.mjs`. This file is the part that touches Foundry.
 *
 * **Checked between rounds, by the referee.** A morale check is something the
 * referee does as one round ends and the next begins, the same window in which
 * players declare. So when a round closes with checks owed, the next round
 * waits for them the way it waits for declarations, and the tracker offers the
 * referee the roll.
 *
 * **Rolled per combatant.** Each monster rolls against its own rating, and the
 * ones who fail get a "Morale Failure" status. What failing means -- fleeing,
 * surrendering, fighting on in desperation -- is the referee's call.
 */

import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import { MORALE_TRIGGER, moraleTriggers } from "../rules-engines/morale.mjs"
import { SIDE_LABELS } from "./sides.mjs"

/**
 * The combat flag recording morale checks: `{fired, pending}`.
 *
 * `fired` lists every check triggered this fight, so none triggers twice.
 * `pending` lists the checks the next round is waiting on. Lists rather than
 * keyed objects, because a flag update merges objects but replaces lists.
 * @type {string}
 */
export const MORALE_FLAG = "morale"

/**
 * The status given to a combatant whose nerve breaks.
 * @type {string}
 */
export const MORALE_FAILURE_STATUS = "moraleFailure"

/**
 * Translation keys for why a check is owed.
 * @type {Readonly<Record<string, string>>}
 */
const TRIGGER_LABELS = Object.freeze({
  [MORALE_TRIGGER.DEATH]: "BAGS.Combat.Morale.Triggers.Death",
  [MORALE_TRIGGER.HALF]: "BAGS.Combat.Morale.Triggers.Half",
})

/**
 * Add the "Morale Failure" status to the ones Foundry offers.
 *
 * Run once at init. Pushed onto Foundry's own list, rather than replacing it,
 * so the core statuses stay available.
 * @returns {void}
 */
export const registerMoraleStatus = () => {
  if (CONFIG.statusEffects.some((s) => s.id === MORALE_FAILURE_STATUS)) return
  CONFIG.statusEffects.push({
    id: MORALE_FAILURE_STATUS,
    name: "BAGS.Combat.Morale.Failure",
    img: "icons/svg/terror.svg",
  })
}

/**
 * The stored morale record for a combat.
 * @param {Combat} combat - The encounter.
 * @returns {{fired: string[], pending: object[]}} The record, empty when
 * nothing has been triggered.
 */
export const storedMorale = (combat) => {
  const stored = combat?.flags?.[SYSTEM_NAME]?.[MORALE_FLAG]
  return {
    fired: Array.isArray(stored?.fired) ? stored.fired : [],
    pending: Array.isArray(stored?.pending) ? stored.pending : [],
  }
}

/**
 * Which group a combatant checks morale with.
 *
 * Their combat group when they have one, and otherwise everyone on their side.
 * Under individual initiative nobody is grouped, and "the orcs" is then the
 * only sensible group to ask about.
 * @param {Combatant} combatant - The combatant.
 * @returns {string} A key shared by everyone who checks together.
 */
export const moraleUnitOf = (combatant) => {
  const group = combatant.rollingGroup
  return group ? `group:${group.id}` : `side:${combatant.side}`
}

/**
 * A name for a morale group, for the tracker and the card.
 * @param {Combat} combat - The encounter.
 * @param {string} unit - A key from `moraleUnitOf`.
 * @returns {string} The group's name, or the side's.
 */
export const moraleUnitName = (combat, unit) => {
  const [kind, id] = unit.split(":")
  if (kind === "group") return combat.groups.get(id)?.name ?? id
  return game.i18n.localize(SIDE_LABELS[id] ?? id)
}

/**
 * Why a check is owed, in words.
 * @param {string} trigger - One of MORALE_TRIGGER.
 * @returns {string} A short reason.
 */
export const moraleTriggerLabel = (trigger) =>
  game.i18n.localize(TRIGGER_LABELS[trigger] ?? trigger)

/**
 * Can this combatant check morale?
 *
 * Only a monster still standing, run by the referee, with a rating to roll
 * against, and not already broken. Player characters decide for themselves.
 * @param {Combatant} combatant - The combatant.
 * @returns {boolean} Whether they can roll.
 */
export const canCheckMorale = (combatant) => {
  if (combatant.hasPlayerOwner || combatant.isDefeated) return false
  const { actor } = combatant
  if (!Number.isFinite(actor?.system?.morale?.value)) return false
  return !actor.statuses?.has(MORALE_FAILURE_STATUS)
}

/**
 * Find the checks that have become due since the last time anyone looked.
 * @param {Combat} combat - The encounter.
 * @returns {object[]} Newly owed checks: `{unit, trigger, key}`.
 */
export const dueMoraleChecks = (combat) => {
  const units = new Map()

  combat.combatants.forEach((combatant) => {
    const key = moraleUnitOf(combatant)
    const unit = units.get(key) ?? {
      key,
      size: 0,
      defeated: 0,
      importantDeath: false,
      canCheck: false,
    }

    unit.size += 1
    if (combatant.isDefeated) {
      unit.defeated += 1
      if (combatant.actor?.system?.morale?.isWorthPanickingOverDying) {
        unit.importantDeath = true
      }
    } else if (canCheckMorale(combatant)) unit.canCheck = true

    units.set(key, unit)
  })

  return moraleTriggers([...units.values()], storedMorale(combat).fired)
}

/**
 * Announce morale results to the referee.
 *
 * Whispered to the GMs, because whether the orcs are about to break is the
 * referee's knowledge until the orcs act on it.
 * @param {object[]} results - `{combatant, roll, rating, failed}` per check.
 * @returns {Promise<ChatMessage|null>} The message, or null with nothing to say.
 */
export const postMoraleCard = async (results) => {
  if (!results.length) return null

  const content = await foundry.applications.handlebars.renderTemplate(
    `${SYSTEM_TEMPLATE_PATH}/chat-cards/morale.hbs`,
    {
      results: results.map(({ combatant, roll, rating, failed }) => ({
        name: combatant.name,
        total: roll.total,
        rating,
        failed,
      })),
    },
  )

  const ChatMessage = foundry.documents.ChatMessage.implementation
  return ChatMessage.create({
    content,
    rolls: results.map((result) => result.roll),
    speaker: { alias: game.i18n.localize("BAGS.Combat.Morale.Title") },
    whisper: ChatMessage.getWhisperRecipients("GM").map((user) => user.id),
  })
}
