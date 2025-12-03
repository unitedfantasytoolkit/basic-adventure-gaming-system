/**
 * @file Adapter for Foundry VTT document operations
 * This isolates all Foundry-specific I/O so ActionResolver logic can be tested
 */

export class FoundryDocumentAdapter {
  /**
   * Updates a document with the given data
   * @param {object} document - The Foundry document to update
   * @param {object} updateData - The update data
   * @returns {Promise<object>} The updated document
   */
  async updateDocument(document, updateData) {
    return document.update(updateData)
  }

  /**
   * Resolves a UUID to a document
   * @param {string} uuid - The UUID to resolve
   * @returns {Promise<object|null>} The resolved document or null
   */
  async resolveUuid(uuid) {
    return fromUuid(uuid)
  }

  /**
   * Gets a nested property value from an object using Foundry's utility
   * @param {object} obj - The object to query
   * @param {string} path - The property path
   * @returns {*} The property value
   */
  getProperty(obj, path) {
    return foundry.utils.getProperty(obj, path)
  }

  /**
   * Creates a chat message
   * @param {object} messageData - The message data
   * @returns {Promise<object>} The created message
   */
  async createChatMessage(messageData) {
    return ChatMessage.create(messageData)
  }

  /**
   * Gets the speaker data for a chat message
   * @param {object} options - Speaker options (e.g., { actor })
   * @returns {object} Speaker data
   */
  getSpeaker(options) {
    return ChatMessage.getSpeaker(options)
  }

  /**
   * Rolls dice using the Foundry dice system
   * @param {object} actor - The actor rolling
   * @param {string} formula - The dice formula
   * @returns {Promise<object>} The roll result
   */
  async rollDice(actor, formula) {
    const rollDice = (await import("../utils/roll-dice.mjs")).default
    return rollDice(actor, formula)
  }

  /**
   * Creates an active effect on a target
   * @param {object} effectData - The effect data
   * @param {object} options - Creation options (including parent)
   * @returns {Promise<object>} The created effect
   */
  async createActiveEffect(effectData, options) {
    return ActiveEffect.create(effectData, options)
  }

  /**
   * Rolls on a roll table
   * @param {object} table - The roll table document
   * @returns {Promise<object>} The roll result
   */
  async rollTable(table) {
    return table.roll()
  }

  /**
   * Executes a macro
   * @param {object} macro - The macro document
   * @param {object} context - The execution context
   * @returns {Promise<*>} The macro result
   */
  async executeMacro(macro, context) {
    return macro.execute(context)
  }

  /**
   * Shows an error notification
   * @param {string} message - The error message
   */
  notifyError(message) {
    ui.notifications.error(message)
  }

  /**
   * Shows a warning notification
   * @param {string} message - The warning message
   */
  notifyWarning(message) {
    ui.notifications.warn(message)
  }

  /**
   * Gets the selected combat system from the registry
   * @returns {object} The combat system
   */
  getCombatSystem() {
    return CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )
  }

  /**
   * Gets the selected saving throw system from the registry
   * @returns {object} The saving throw system
   */
  getSavingThrowSystem() {
    return CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
    )
  }

  /**
   * Normalizes targets from various formats to an array
   * @param {*} targets - Raw targets (UserTargets, array, single, or null)
   * @returns {Array} Normalized array of targets
   */
  normalizeTargets(targets) {
    if (!targets) return []
    if (targets instanceof UserTargets) {
      // UserTargets is a Map, entries() returns [key, token] pairs
      // We only want the token (second element)
      return Array.from(targets.values())
    }
    if (!Array.isArray(targets)) return [targets]
    return targets.flat()
  }

  /**
   * Applies roll mode to message data
   * @param {object} messageData - The message data to modify
   * @param {string} rollMode - The roll mode (public, private, blind, self)
   */
  applyRollMode(messageData, rollMode) {
    switch (rollMode) {
      case CONST.DICE_ROLL_MODES.PRIVATE:
      case 'private':
        messageData.whisper = [game.user.id]
        break
      case CONST.DICE_ROLL_MODES.BLIND:
      case 'blind':
        messageData.whisper = game.users.filter(u => u.isGM).map(u => u.id)
        messageData.blind = true
        break
      case CONST.DICE_ROLL_MODES.SELF:
      case 'self':
        messageData.whisper = [game.user.id]
        messageData.blind = true
        break
      // PUBLIC is default, no additional properties needed
    }
  }
}
