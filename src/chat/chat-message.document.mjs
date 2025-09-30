/**
 * @file An override for Foundry's ChatMessage class.
 */

import ActionResolver from "../rules-engines/action-resolver.mjs"

export default class BAGSChatMessage extends ChatMessage {
  /**
   * Get the template path based on the message type
   * @returns {string} The path to the template
   * @private
   */
  get template() {
    return this?.system?.template ?? CONFIG.ChatMessage.template
  }

  /**
   * Given a message of type "action", prepare the action's details for display.
   * @todo This might break if the user switches between descending and
   * ascending AC.
   * @returns {object} the action details to display
   */
  async #prepareActionDetails() {
    // TODO: What to do if the actor's already been deleted?
    const actor = await fromUuid(this.system.actor)
    // TODO: What to do if the item's already been deleted?
    const item = await fromUuid(this.system.item)
    let details
    try {
      details = (item || actor).system.actions.find(
        (a) => a.id === this.system.action,
      )
    } catch {
      // no-op
    }
    const outcome = await Promise.all(
      this.system.outcome.map(async (o) => ({
        ...o,
        target:
          o.target === ActionResolver.KEY_WITH_NO_TARGETS
            ? undefined
            : await fromUuid(o.target),
      })),
    )

    if (details?.attempt.flags.isLikeAttack)
      details.attempt.usesDescendingAC =
        CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
          CONFIG.BAGS.SystemRegistry.categories.COMBAT,
        )?.descending || false

    return {
      actor,
      item,
      details,
      outcome,
    }
  }

  /**
   * @override
   */
  async renderHTML(options = {}) {
    const { canDelete, canClose = false } = options
    const finalCanDelete = canDelete ?? game.user.isGM

    // Determine some metadata
    const data = this.toObject(false)
    data.content = await foundry.applications.ux.TextEditor.enrichHTML(
      this.content,
      {
        rollData: this.getRollData(),
      },
    )
    data.rolls = data.rolls.map((r) => {
      if (typeof r === "string") return JSON.parse(r)
      return r
    })
    const isWhisper = this.whisper.length

    const cssClass = [
      this.style === CONST.CHAT_MESSAGE_STYLES.IC ? "ic" : null,
      this.style === CONST.CHAT_MESSAGE_STYLES.EMOTE ? "emote" : null,
      isWhisper ? "whisper" : null,
      this.blind ? "blind" : null,
    ]

    if (options.classes) {
      cssClass.push(...options.classes)
    }

    // Construct message data
    const messageData = {
      canDelete: finalCanDelete,
      canClose,
      message: data,
      user: game.user,
      author: this.author,
      alias: this.alias,
      cssClass: cssClass.filterJoin(" "),
      isWhisper: this.whisper.length,
      isGM: game.user.isGM,
      whisperTo: this.whisper
        .map((u) => {
          const user = game.users.get(u)
          return user ? user.name : null
        })
        .filterJoin(", "),
    }

    if (this.type === "action")
      messageData.action = await this.#prepareActionDetails()

    // Render message data specifically for ROLL type messages
    if (this.isRoll) await this.#renderRollContent(messageData)

    // Define a border color
    if (this.style === CONST.CHAT_MESSAGE_STYLES.OOC) {
      messageData.borderColor = this.author?.color.css
    }

    // Render the chat message
    let html = await foundry.applications.handlebars.renderTemplate(
      this.template,
      messageData,
    )
    html = foundry.utils.parseHTML(html)

    // Call hooks
    Hooks.call("renderChatMessageHTML", this, html, messageData)

    return html
  }

  /**
   * Render the inner HTML content for ROLL type messages. Note: this comes
   * from Foundry.
   * @param {object} messageData - The chat message data used to render the
   * message HTML
   * @returns {Promise<void>}
   */
  async #renderRollContent(messageData) {
    const data = messageData.message
    // Suppress the "to:" whisper flavor for private rolls
    if (this.blind || this.whisper.length) messageData.isWhisper = false
    // Display standard Roll HTML content
    if (this.isContentVisible) {
      const el = document.createElement("div")
      el.innerHTML = data.content // Ensure the content does not already contain custom HTML
      if (!el.childElementCount && this.rolls.length)
        data.content = await this.#renderRollHTML(false)
    }
    // Otherwise, show "rolled privately" messages for Roll content
    else {
      const name = this.author?.name ?? game.i18n.localize("CHAT.UnknownUser")
      data.flavor = game.i18n.format("CHAT.PrivateRollContent", {
        user: foundry.utils.escapeHTML(name),
      })
      data.content = await this.#renderRollHTML(true)
      messageData.alias = name
    }
  }

  /**
   * Render HTML for the array of Roll objects included in this message. Note:
   * this comes from Foundry.
   * @param {boolean} isPrivate - Is the chat message private?
   * @returns {Promise<string>} - The rendered HTML string
   */
  async #renderRollHTML(isPrivate) {
    let html = ""
    for (const roll of this.rolls) {
      html += await roll.render({ isPrivate, message: this })
    }
    return html
  }
}
