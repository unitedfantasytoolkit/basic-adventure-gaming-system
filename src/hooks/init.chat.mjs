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
    actionAttemptStatic: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/attempt.hbs`,
    actionAttemptAttack: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/attempt-attack.hbs`,
    actionEffectTargetsNone: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-no-target.hbs`,
    actionEffectTargetsOne: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-one-target.hbs`,
    actionEffectTargetsMany: `${SYSTEM_TEMPLATE_PATH}/chat-cards/partials/effect-many-targets.hbs`,
  })
})
