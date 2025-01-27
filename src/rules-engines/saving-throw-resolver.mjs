/**
 * @file Manages saving throw systems across different OSR rulesets
 */
import rollDice from "../utils/roll-dice.mjs"

/**
 * @typedef {object} SaveResult
 * @property {boolean} success - Whether the save succeeded
 * @property {Roll[]} rolls - The Roll instances used
 * @property {number} target - The target number for the save
 * @property {string} save - The save key for translation
 */

/**
 * @typedef {object} SystemConfig
 * @property {string} displayName Human-readable system name
 * @property {string[]} saves Save names for this system
 * @property {Record<string, string|string[]>} mappings How saves map to B/X
 * @property {Function} [resolve] Custom save resolution method
 * @property {string} [rollFormula =  '1d20'] Base dice formula for saves
 * @property {string} [operator = ">="] Default comparison operator
 */

export default class SavingThrowResolver {
  /** @type {Map<string, SystemConfig>} */
  static #systems = new Map()

  /**
   * Registers a new saving throw system
   * @param {string} systemId - Unique identifier for the system
   * @param {SystemConfig} config - Configuration for the system
   */
  static registerSystem(systemId, config) {
    this.#systems.set(systemId, {
      ...config,
      // Ensure mappings are always arrays for consistency
      mappings: Object.fromEntries(
        Object.entries(config.mappings).map(([key, value]) => [
          key,
          Array.isArray(value) ? value : [value],
        ]),
      ),
    })
  }

  /**
   * Gets the B/X equivalent(s) for a system's save
   * @param {string} systemId - The system to look up
   * @param {string} saveName - The save to map
   * @returns {string[]} B/X save name(s)
   */
  static getBXEquivalents(systemId, saveName) {
    return this.#systems.get(systemId)?.mappings[saveName] || []
  }

  /**
   * Gets system-specific saves that map to a B/X save
   * @param {string} systemId - The system to look up
   * @param {string} bxSave - The B/X save to map from
   * @returns {string[]} System-specific save names
   */
  static getSystemEquivalents(systemId, bxSave) {
    const system = this.#systems.get(systemId)
    if (!system) return []

    return Object.entries(system.mappings)
      .filter(([_, bxSaves]) => bxSaves.includes(bxSave))
      .map(([save]) => save)
  }

  /**
   * Rolls a save and returns a standardized result
   * @param {Actor} actor - The actor making the save
   * @param {string} systemId - The system being used
   * @param {string} saveName - The name of the save being attempted
   * @param {object} options - Additional options for the save roll
   * @param {number} [options.modifier=0] - Situational modifier
   * @param {string} [options.rollMode] - Roll mode (advantage/disadvantage)
   * @param {string} [options.flavor] - Descriptive text
   * @returns {Promise<SaveResult>} The standardized save result
   */
  static async rollSave(actor, systemId, saveName, options = {}) {
    const system = this.#systems.get(systemId)
    if (!system) {
      throw new Error(`Unknown system: ${systemId}`)
    }

    if (!system.saves.includes(saveName)) {
      throw new Error(`Invalid save "${saveName}" for system ${systemId}`)
    }

    // Use custom resolution if provided
    if (system.resolve) {
      return system.resolve(actor, saveName, options)
    }

    // Default to B/X-style resolution
    return this.#resolveClassicSave(actor, saveName, system, options)
  }

  /**
   * Resolves a classic (B/X-style) saving throw
   * @private
   */
  static async #resolveClassicSave(actor, saveName, system, options) {
    const classItem = actor.items.find((i) => i.type === "class")
    if (!classItem) {
      throw new Error(`${actor.name} has no class to determine saves from`)
    }

    const target = classItem.system.currentLevelDetails.saves[saveName]
    if (target === undefined) {
      throw new Error(
        `Could not find save ${saveName} for ${actor.name}'s class`,
      )
    }

    const roll = await rollDice(actor, system.rollFormula || "1d20", {
      operator: system.operator || ">=",
      target,
      modifier: options.modifier,
      rollType: options.rollMode,
    })

    return {
      success: roll.total >= target,
      rolls: [roll],
      target,
      save: saveName,
    }
  }

  /**
   * Creates a chat message displaying the save result
   * @param {Actor} actor - The actor who made the save
   * @param {SaveResult} result - The result of the save
   * @param {object} options - Additional options for the message
   * @param {string} [options.flavor] - Optional flavor text
   * @returns {Promise<ChatMessage>}
   */
  static async report(actor, result, { flavor = "" } = {}) {
    const saveLabel = game.i18n.localize(`BAGS.Saves.${result.save}`)
    const successLabel = game.i18n.localize(
      result.success ? "BAGS.Saves.Success" : "BAGS.Saves.Failure",
    )

    const content = await renderTemplate(
      "systems/bags/templates/chat/save-roll.hbs",
      {
        actor,
        rolls: result.rolls,
        target: result.target,
        saveLabel,
        successLabel,
        flavor,
      },
    )

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: result.rolls,
      flags: {
        bags: {
          saveResult: result,
        },
      },
    })
  }
}
