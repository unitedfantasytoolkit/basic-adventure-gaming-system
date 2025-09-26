import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class AbilityScoreRoll extends Roll {
  /**
   * A specialized Roll subclass designed for OSR ability score checks
   * Evaluates success based on rolling below (or above) a target ability score
   * @param {string} formula - The formula to roll, typically "1d20" or similar
   * @param {object} data - The data object against which to parse
   * attributes within the formula
   * @param {object} options - Additional options that modify the roll
   * @param {number} options.target - The target ability score value to
   * roll against
   * @param {boolean} options.rollBelow - Whether success is determined by
   * rolling below the target (default: true)
   * @param {string} options.rollMode - The roll mode (roll, gmroll,
   * blindroll, selfroll)
   * @param {string} options.abilityName - The name of the ability being checked
   */
  constructor(formula, data = {}, options = {}) {
    super(formula, data, options)

    this.target = options.target ?? null
    this.rollBelow = options.rollBelow ?? true
    this.rollMode = options.rollMode ?? game.settings.get("core", "rollMode")
    this.abilityName = options.abilityName ?? ""

    if (this.target === null)
      throw new Error("AbilityScoreRoll requires a target value")
    if (!this.abilityName)
      throw new Error("AbilityScore requires an ability score type")
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
  static CHAT_TEMPLATE = `${SYSTEM_TEMPLATE_PATH}/chat-cards/ability-score-roll.hbs`

  /** @override */
  async _prepareChatRenderContext(options = {}) {
    const context = await super._prepareChatRenderContext(options)
    const isPrivate =
      this.rollMode === CONST.DICE_ROLL_MODES.PRIVATE ||
      this.rollMode === CONST.DICE_ROLL_MODES.BLIND

    return {
      ...context,
      target: isPrivate ? "?" : this.target,
      isSuccess: isPrivate ? null : this.isSuccess,
      abilityName: this.abilityName,
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
