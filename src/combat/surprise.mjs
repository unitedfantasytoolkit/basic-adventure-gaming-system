/**
 * @file Surprise: who was caught off guard as a fight began, and what that
 * costs them.
 *
 * The arithmetic lives in `src/rules-engines/surprise.mjs`. This file is the
 * part that touches Foundry: where the result is stored, how a combatant reads
 * it, and the chat card that announces it.
 *
 * **Stored on the combat, not on each combatant.** Surprise is decided once,
 * for the whole fight, and only matters until the first round is over. A flag
 * on the combat is one write to set and one to clear, and it can be stepped
 * back into with the rest of the round (see `BAGSCombat#previousRound`).
 */

import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import { SURPRISE_EFFECT } from "../rules-engines/surprise.mjs"
import { SIDE_LABELS } from "./sides.mjs"

/**
 * The combat flag holding the surprise result.
 *
 * Its value is `{sides, combatants}`: each side's roll as the card showed it,
 * and one `{_id, segments}` entry per surprised combatant. Both are lists,
 * because a flag update merges objects -- a combatant marked by mistake would
 * linger in a keyed object after being unmarked -- but replaces lists whole.
 * @type {string}
 */
export const SURPRISE_FLAG = "surprise"

/**
 * The stored surprise result for a combat.
 * @param {Combat} combat - The encounter.
 * @returns {{sides: object[], combatants: object[]}|null} The result, or null
 * when nobody has rolled for surprise.
 */
export const storedSurprise = (combat) =>
  combat?.flags?.[SYSTEM_NAME]?.[SURPRISE_FLAG] ?? null

/**
 * Whether a combatant is surprised, and by how much.
 *
 * Surprise only ever affects the first round, so this is null from round two
 * on even if the flag is somehow still there.
 *
 * Reached from data preparation (through `initiativeOffset`), which is why it
 * reads the flag object directly rather than calling `getFlag`, and why it is
 * a plain function rather than a private method. See `baseRollFor` in
 * `combatant.document.mjs` for the full story.
 * @param {Combatant} combatant - The combatant to check.
 * @returns {{_id: string, segments: number}|null} Their entry, or null when
 * they are not surprised.
 */
export const surpriseFor = (combatant) => {
  const combat = combatant?.parent
  if (!combat || combat.round > 1) return null
  if (!combat.initiativeConfig?.surprise) return null

  const entries = storedSurprise(combat)?.combatants
  if (!Array.isArray(entries)) return null
  return entries.find((entry) => entry._id === combatant.id) ?? null
}

/**
 * How far surprise pushes a combatant back in the order.
 *
 * Only under lost segments. A ruleset where surprise costs the whole round
 * keeps the surprised in their place and simply skips their turn instead (see
 * `BAGSCombat#canTakeTurn`).
 *
 * Signed for the ruleset's direction, so that "later" means later whichever
 * way the order is read: a larger number under low-acts-first, a smaller one
 * under high-acts-first.
 * @param {Combatant} combatant - The combatant to check.
 * @returns {number} A number to add to their offset. Zero when not surprised.
 */
export const surpriseDelayFor = (combatant) => {
  const config = combatant?.parent?.initiativeConfig
  if (config?.surprise?.effect !== SURPRISE_EFFECT.SEGMENTS) return 0

  const segments = surpriseFor(combatant)?.segments
  if (!Number.isFinite(segments) || segments <= 0) return 0

  return config.turnOrder?.direction === "high" ? -segments : segments
}

/**
 * Whether surprise costs this combatant their turn in a round.
 * @param {Combatant} combatant - The combatant to check.
 * @param {number} [round] - The round to ask about. Defaults to the current
 * one; passed explicitly while a round is being opened, when the combat's own
 * round number still says the round before.
 * @returns {boolean} True when they lose the round.
 */
export const losesTurnToSurprise = (
  combatant,
  round = combatant?.parent?.round,
) => {
  const config = combatant?.parent?.initiativeConfig
  if (config?.surprise?.effect !== SURPRISE_EFFECT.ROUND) return false
  return round === 1 && !!surpriseFor(combatant)
}

/**
 * Describe a surprise result for a card or the tracker.
 * @param {object} result - One side's result, from `resolveSurprise`.
 * @param {string} effect - One of SURPRISE_EFFECT.
 * @returns {string} A short line, such as "Surprised: loses 3 segments".
 */
export const describeOutcome = (result, effect) => {
  if (!result.surprised) return game.i18n.localize("BAGS.Combat.Surprise.Ready")
  if (effect === SURPRISE_EFFECT.SEGMENTS) {
    return game.i18n.format("BAGS.Combat.Surprise.LosesSegments", {
      segments: result.segments,
    })
  }
  return game.i18n.localize("BAGS.Combat.Surprise.LosesRound")
}

/**
 * Announce a surprise roll in chat.
 *
 * Follows the roller's chosen message mode, the way any other roll does. A
 * referee who rolls the monsters' surprise in secret can keep it secret.
 * @param {Combat} combat - The encounter.
 * @param {object[]} results - One result per side, from `resolveSurprise`.
 * @param {Roll[]} rolls - The rolls behind them, in the same order.
 * @returns {Promise<ChatMessage>} The posted message.
 */
export const postSurpriseCard = async (combat, results, rolls) => {
  const { effect } = combat.initiativeConfig.surprise
  const content = await foundry.applications.handlebars.renderTemplate(
    `${SYSTEM_TEMPLATE_PATH}/chat-cards/surprise.hbs`,
    {
      sides: results.map((result) => ({
        label: game.i18n.localize(SIDE_LABELS[result.side] ?? result.side),
        total: result.total,
        surprised: result.surprised,
        outcome: describeOutcome(result, effect),
      })),
      nobody: !results.some((result) => result.surprised),
    },
  )

  const ChatMessage = foundry.documents.ChatMessage.implementation
  const messageData = {
    content,
    rolls,
    speaker: { alias: game.i18n.localize("BAGS.Combat.Surprise.Title") },
  }
  ChatMessage.applyMode(messageData)

  return ChatMessage.create(messageData)
}
