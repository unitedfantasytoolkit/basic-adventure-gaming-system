import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

/**
 * A specialized Roll subclass designed for OSR saving throws
 * Evaluates success based on rolling above (or below) a target save value
 */
export default class SavingThrowRoll extends Roll {
  /**
   * @param {string} formula - The formula to roll, typically "1d20" or similar
   * @param {object} data - The data object against which to parse attributes
   * within the formula
   * @param {object} options - Additional options that modify the roll
   * @param {number} options.target - The target save value to roll against
   * @param {boolean} options.rollBelow - Whether success is determined by
   * rolling below target (default: false)
   * @param {string} options.rollMode - The roll mode (roll, gmroll, blindroll,
   * selfroll)
   * @param {string} options.saveType - The type/category of save being
   * attempted (e.g., "death", "wands", etc.)
   */
  constructor(formula, data = {}, options = {}) {
    super(formula, data, options)

    // Store the target value and whether to roll below
    this.target = options.target ?? null
    // Default is to roll ABOVE for saves in most OSR games
    this.rollBelow = options.rollBelow ?? false
    this.rollMode = options.rollMode ?? game.settings.get("core", "rollMode")
    this.saveType = options.saveType ?? ""

    // Validate that we have a target value
    if (this.target === null)
      throw new Error("SavingThrowRoll requires a target value")
    if (!this.saveType)
      throw new Error("SavingThrowRoll requires a saving throw type")
  }

  /**
   * Determine if the roll succeeded based on the target value and rollBelow
   * setting
   * @returns {boolean} Whether the roll was successful
   */
  get isSuccess() {
    if (!this._evaluated) return null
    return this.rollBelow
      ? this.total <= this.target
      : this.total >= this.target
  }

  /** @override */
  static CHAT_TEMPLATE = `${SYSTEM_TEMPLATE_PATH}/chat-cards/saving-throw-roll.hbs`

  /** @override */
  async _prepareChatRenderContext(options = {}) {
    const context = await super._prepareChatRenderContext(options)
    const isPrivate =
      this.rollMode === CONST.DICE_ROLL_MODES.PRIVATE ||
      this.rollMode === CONST.DICE_ROLL_MODES.BLIND

    // Add our special context data
    return {
      ...context,
      target: isPrivate ? "?" : this.target,
      isSuccess: isPrivate ? null : this.isSuccess,
      saveType: this.saveType,
      rollBelow: this.rollBelow,
    }
  }

  async toMessage(messageData = {}, { rollMode, create = true } = {}) {
    if (rollMode === "roll") rollMode = undefined
    rollMode ||= game.settings.get("core", "rollMode")

    // Perform the roll, if it has not yet been rolled
    if (!this._evaluated)
      await this.evaluate({
        allowInteractive: rollMode !== CONST.DICE_ROLL_MODES.BLIND,
      })

    // Prepare chat data
    messageData = foundry.utils.mergeObject(
      {
        author: game.user.id,
        content: String(this.total),
        sound: CONFIG.sounds.dice,
        type: "check",
      },
      messageData,
    )
    messageData.rolls = [this]

    // Either create the message or just return the chat data
    const Cls = getDocumentClass("ChatMessage")
    const msg = new Cls(messageData)
    msg.applyRollMode(rollMode)

    // Either create or return the data
    if (create) return Cls.create(msg)
    return msg.toObject()
  }
}
