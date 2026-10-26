/**
 * @file Mock adapter for testing ActionResolver without Foundry
 */

export class MockFoundryAdapter {
  constructor() {
    this.updates = []
    this.resolvedUuids = new Map()
    this.notifications = []
    this.createdMessages = []
    this.createdEffects = []
    this.executedMacros = []
    this.rolledTables = []
    this.combatSystem = null
    this.savingThrowSystem = null
  }

  /**
   * Mock document update - records the update for inspection
   * @param document
   * @param updateData
   */
  async updateDocument(document, updateData) {
    this.updates.push({ document, updateData })
    return document
  }

  /**
   * Mock UUID resolution - uses pre-configured map
   * @param uuid
   */
  async resolveUuid(uuid) {
    return this.resolvedUuids.get(uuid) || null
  }

  /**
   * Mock property getter - simple nested property access
   * @param obj
   * @param path
   */
  getProperty(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj)
  }

  /**
   * Mock chat message creation
   * @param messageData
   */
  async createChatMessage(messageData) {
    const message = { ...messageData, id: `msg-${this.createdMessages.length}` }
    this.createdMessages.push(message)
    return message
  }

  /**
   * Mock active effect creation
   * @param effectData
   * @param options
   */
  async createActiveEffect(effectData, options) {
    const effect = {
      ...effectData,
      id: `effect-${this.createdEffects.length}`,
      parent: options.parent,
    }
    this.createdEffects.push(effect)
    return effect
  }

  /**
   * Mock roll table rolling
   * @param table
   */
  async rollTable(table) {
    const roll = {
      results: [{ text: "Mock table result" }],
    }
    this.rolledTables.push({ table, roll })
    return roll
  }

  /**
   * Mock macro execution
   * @param macro
   * @param context
   */
  async executeMacro(macro, context) {
    this.executedMacros.push({ macro, context })
    return null
  }

  /**
   * Mock error notification
   * @param message
   */
  notifyError(message) {
    this.notifications.push({ type: "error", message })
  }

  /**
   * Mock warning notification
   * @param message
   */
  notifyWarning(message) {
    this.notifications.push({ type: "warning", message })
  }

  /**
   * Mock combat system
   */
  getCombatSystem() {
    return this.combatSystem
  }

  /**
   * Mock saving throw system
   */
  getSavingThrowSystem() {
    return this.savingThrowSystem
  }

  /**
   * Helper: Set up a UUID to resolve to a specific object
   * @param uuid
   * @param object
   */
  setUuidResolution(uuid, object) {
    this.resolvedUuids.set(uuid, object)
  }

  /**
   * Helper: Set up the combat system
   * @param system
   */
  setCombatSystem(system) {
    this.combatSystem = system
  }

  /**
   * Helper: Set up the saving throw system
   * @param system
   */
  setSavingThrowSystem(system) {
    this.savingThrowSystem = system
  }

  /**
   * Helper: Clear all recorded calls
   */
  reset() {
    this.updates = []
    this.resolvedUuids.clear()
    this.notifications = []
    this.createdMessages = []
    this.createdEffects = []
    this.executedMacros = []
    this.rolledTables = []
  }

  /**
   * Gets the speaker data for a chat message
   * @param options
   */
  getSpeaker(options) {
    return { alias: "Test Speaker" }
  }

  /**
   * Rolls dice - returns a mock roll result
   * @param {object} actor - The actor rolling
   * @param {string} formula - The dice formula
   * @returns {Promise<object>} Mock roll result
   */
  async rollDice(actor, formula) {
    return {
      total: 10, // Fixed value for testing
      formula,
      terms: [],
    }
  }

  /**
   * Normalizes targets from various formats to an array
   * @param targets
   */
  normalizeTargets(targets) {
    if (!targets) return []
    if (!Array.isArray(targets)) return [targets]
    return targets.flat()
  }

  /**
   * Applies a chat mode to message data (mock version).
   *
   * The real adapter hands this to `ChatMessage.applyMode`, so this stands in
   * for it with the same rules Foundry uses: only `blind` is blind, and both
   * `gm` and `blind` go to the gamemasters rather than to the author.
   * @param {object} messageData - The message data to modify
   * @param {string} rollMode - The chat mode
   */
  applyRollMode(messageData, rollMode) {
    switch (rollMode) {
      case "gm":
        messageData.whisper = ["gm1"]
        break
      case "blind":
        messageData.whisper = ["gm1"]
        messageData.blind = true
        break
      case "self":
        messageData.whisper = ["user1"]
        break
      default:
        messageData.whisper = []
    }
  }
}
