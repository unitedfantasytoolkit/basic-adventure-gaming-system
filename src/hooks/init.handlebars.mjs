/**
 * @file Register helpers for Handlebars.
 */
import formatRoll from "../utils/format-roll.mjs"
import getActionFlavorText from "../utils/get-action-flavor-text.mjs"
import getBlindFlavorText from "../utils/get-blind-flavor-text.mjs"
import numberToOrdinal from "../utils/number-to-ordinal.mjs"
import signNumber from "../utils/sign-number.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

Hooks.once("init", async () => {
  Handlebars.registerHelper({
    add: (a, b) => a + b,
    repeat: (length) => new Array(length).fill(null),
    ordinal: (value) => numberToOrdinal(value || 0),
    signNumber,
    formatRoll,
    getActionFlavorText,
    getBlindFlavorText,
  })

  await loadTemplates({
    /* ======================================================================
     * Applications
     * ====================================================================== */

    // === Action Editor =======================================================

    // --- Detail pane ---------------------------------------------------------
    actionEditorDetailsBasic: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-details.hbs`,
    actionEditorDetailsFlags: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-flags.hbs`,
    actionEditorDetailsAttempt: `${SYSTEM_TEMPLATE_PATH}/action-editor/section-attempt.hbs`,
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
  })
})
