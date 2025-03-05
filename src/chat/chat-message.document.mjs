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
    data.content = await TextEditor.enrichHTML(this.content, {
      rollData: this.getRollData(),
    })
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
    if (this.isRoll) await this._renderRollContent(messageData)

    // Define a border color
    if (this.style === CONST.CHAT_MESSAGE_STYLES.OOC) {
      messageData.borderColor = this.author?.color.css
    }

    // Render the chat message
    let html = await renderTemplate(this.template, messageData)
    html = foundry.applications.parseHTML(html)

    // Call hooks
    Hooks.call("renderChatMessageHTML", this, html, messageData)

    return html
  }
}
