/**
 * @file Setup related to chat message config -- overriding the default document
 * class, template, and so on
 */

import BAGSChatMessage from "../chat/chat-message.document.mjs"
import BAGSActionMessageDataModel from "../chat/chat-message.action.datamodel.mjs"
import BAGSChatCheckDataModel from "../chat/chat-message.check.datamodel.mjs"

Hooks.once("init", async () => {
  CONFIG.ChatMessage.documentClass = BAGSChatMessage
  CONFIG.ChatMessage.dataModels = {
    action: BAGSActionMessageDataModel,
    check: BAGSChatCheckDataModel,
  }
})
