/**
 * @file Setup related to chat message config -- overriding the default document
 * class, template, and so on
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSChatMessage from "../chat/chat-message.document.mjs"
import BAGSActionMessageDataModel from "../chat/chat-message.action.datamodel.mjs"

Hooks.once("init", () => {
  CONFIG.ChatMessage.DocumentClass = BAGSChatMessage
  CONFIG.ChatMessage.dataModels = {
    action: BAGSActionMessageDataModel,
  }
  CONFIG.ChatMessage.template = `${SYSTEM_TEMPLATE_PATH}/chat-cards/chat-message.hbs`
})
