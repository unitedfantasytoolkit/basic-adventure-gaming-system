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
   */
  async updateDocument(document, updateData) {
    this.updates.push({ document, updateData })
    return document
  }

  /**
   * Mock UUID resolution - uses pre-configured map
   */
  async resolveUuid(uuid) {
    return this.resolvedUuids.get(uuid) || null
  }

  /**
   * Mock property getter - simple nested property access
   */
  getProperty(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Mock chat message creation
   */
  async createChatMessage(messageData) {
    const message = { ...messageData, id: `msg-${this.createdMessages.length}` }
    this.createdMessages.push(message)
    return message
  }

  /**
   * Mock active effect creation
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
   */
  async rollTable(table) {
    const roll = {
      results: [{ text: 'Mock table result' }],
    }
    this.rolledTables.push({ table, roll })
    return roll
  }

  /**
   * Mock macro execution
   */
  async executeMacro(macro, context) {
    this.executedMacros.push({ macro, context })
    return null
  }

  /**
   * Mock error notification
   */
  notifyError(message) {
    this.notifications.push({ type: 'error', message })
  }

  /**
   * Mock warning notification
   */
  notifyWarning(message) {
    this.notifications.push({ type: 'warning', message })
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
   */
  setUuidResolution(uuid, object) {
    this.resolvedUuids.set(uuid, object)
  }

  /**
   * Helper: Set up the combat system
   */
  setCombatSystem(system) {
    this.combatSystem = system
  }

  /**
   * Helper: Set up the saving throw system
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
   */
  getSpeaker(options) {
    return { alias: 'Test Speaker' }
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
   */
  normalizeTargets(targets) {
    if (!targets) return []
    if (!Array.isArray(targets)) return [targets]
    return targets.flat()
  }

  /**
   * Applies roll mode to message data (mock version)
   * @param {object} messageData - The message data to modify
   * @param {string} rollMode - The roll mode
   */
  applyRollMode(messageData, rollMode) {
    // Mock implementation - just sets properties for testing
    switch (rollMode) {
      case 'private':
        messageData.whisper = ['user1']
        break
      case 'blind':
        messageData.whisper = ['gm1']
        messageData.blind = true
        break
      case 'self':
        messageData.whisper = ['user1']
        messageData.blind = true
        break
      // public is default, no changes
    }
  }
}
