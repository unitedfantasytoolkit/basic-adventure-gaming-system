/**
 * @file Setup related to chat message config -- overriding the default document
 * class, template, and so on
 */

import BAGSChatMessage from "../chat/chat-message.document.mjs"
import BAGSActionMessageDataModel from "../chat/chat-message.action.datamodel.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

Hooks.once("init", async () => {
  CONFIG.ChatMessage.documentClass = BAGSChatMessage
  CONFIG.ChatMessage.dataModels = {
    action: BAGSActionMessageDataModel,
  }

  await loadTemplates({
    // Chat cards > Actions > General partials
    actionHeader: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/action-header.hbs`,
    actionIcons: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/action-icons.hbs`,
    // Chat cards > Actions > Attempt templates
    actionAttempt: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/action-attempt.hbs`,
    actionAttemptStatic: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/attempt.hbs`,
    actionAttemptAttack: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/attempt-attack.hbs`,
    // Chat cards > Actions > Effect templates
    actionEffectTargetsNoneOrOne: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-one-target.hbs`,
    actionEffectTargetsMany: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-many-targets.hbs`,
    // Chat cards > Actions > Effect partials
    actionEffectDamage: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-damage.hbs`,
    actionEffectGeneric: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-generic.hbs`,
    actionEffectMessage: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-message.hbs`,
  })
})
