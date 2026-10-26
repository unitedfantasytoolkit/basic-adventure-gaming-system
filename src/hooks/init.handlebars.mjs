/**
 * @file Register helpers for Handlebars.
 */
import formatRoll from "../utils/format-roll.mjs"
import getActionFlavorText from "../utils/get-action-flavor-text.mjs"
import getBlindFlavorText from "../utils/get-blind-flavor-text.mjs"
import numberToOrdinal from "../utils/number-to-ordinal.mjs"
import signNumber from "../utils/sign-number.mjs"
import secondsToFriendlyTime from "../utils/seconds-to-friendly-time.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

Hooks.once("init", async () => {
  Handlebars.registerHelper({
    add: (a, b) => a + b,
    divide: (a, b) => Math.floor((a / b) * 100),
    repeat: (length) => new Array(length).fill(null),
    replace: (str, from, to) => str.replace(from, to),
    ordinal: (value) => numberToOrdinal(value || 0),
    toArray: (obj) => {
      try {
        return Array.from(obj)
      } catch {
        return []
      }
    },
    statusEffect: (key) => CONFIG.statusEffects.find((s) => s.id === key),
    padArray(array, length, placeholder = null) {
      const arr = Array.isArray(array) ? array : []
      if (arr.length >= length) return arr.slice()
      return [...arr, ...Array(length - arr.length).fill(placeholder)]
    },
    isEmptyArray(array) {
      if (!Array.isArray(array)) return true
      return !array.length
    },
    signNumber,
    formatRoll,
    getActionFlavorText,
    getBlindFlavorText,
    secondsToFriendlyTime,
  })

  await foundry.applications.handlebars.loadTemplates({
    /* ======================================================================
     * Helpers
     * ====================================================================== */
    sheetTab: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab.hbs`,

    /* ======================================================================
     * Combat
     * ====================================================================== */
    bagsGroupManagerRow: `${SYSTEM_TEMPLATE_PATH}/combat/group-manager-row.hbs`,

    /* ======================================================================
     * Applications
     * ====================================================================== */

    // === Action Editor =======================================================

    // --- Detail pane ---------------------------------------------------------
    actionEditorDetailsSettings: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-settings.hbs`,
    actionEditorDetailsDescription: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-description.hbs`,
    actionEditorDetailsAttempt: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-attempt.hbs`,
    actionEditorDetailsAttemptMessages: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-attempt-messages.hbs`,
    actionEditorDetailsEffects: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-effects.hbs`,
    actionEditorDetailsConsumption: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-consumption.hbs`,
    actionEditorDetailsRestrictions: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-restrictions.hbs`,

    /* ======================================================================
     * Chat cards
     * ====================================================================== */

    // === Actions =============================================================

    // --- General partials ----------------------------------------------------
    chatActionHeader: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/action-header.hbs`,
    chatActionIcons: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/action-icons.hbs`,

    // --- Attempt templates ---------------------------------------------------
    chatActionAttempt: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/action-attempt.hbs`,
    chatActionAttemptStatic: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/attempt.hbs`,
    chatActionAttemptAttack: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/attempt-attack.hbs`,

    // --- Effect templates ----------------------------------------------------
    chatActionEffectTargetsNoneOrOne: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-one-target.hbs`,
    chatActionEffectTargetsMany: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-many-targets.hbs`,

    // --- Effect partials -----------------------------------------------------
    chatActionEffectDamage: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-damage.hbs`,
    chatActionEffectGeneric: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-generic.hbs`,
    chatActionEffectMessage: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-message.hbs`,

    // === Rounds ==============================================================

    // One combatant's line. Shared by the round card's two layouts -- a block
    // per side for the Basic/Expert family, a ladder of segments for AD&D.
    chatRoundMember: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/round-member.hbs`,

    // === Combat tracker ======================================================

    // One combatant's row. Shared by the tracker's two layouts -- blocks per
    // rolling unit, or a flat list once members of a unit act at different
    // moments and there are no contiguous blocks left to draw.
    combatTrackerRow: `${SYSTEM_TEMPLATE_PATH}/combat/partials/combatant-row.hbs`,
  })
})
