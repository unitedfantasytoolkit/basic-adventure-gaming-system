import { SYSTEM_NAME } from "../config/constants.mjs"

/**
 * @file Manages registration and access to system configurations
 */

/**
 * @typedef {object} SystemComponent
 * @property {string} id - Unique identifier for this component
 * @property {string} name - Human-readable name
 * @property {string} [description] - Optional description
 * @property {string} [author] - Optional author attribution
 * @property {string} [version] - Optional version number
 */

class SystemRegistry {
  /**
   * The categories that rule variations can fit into.
   * @readonly
   * @enum {string}
   */
  static categories = {
    ABILITY_SCORES: "AbilityScores",
    SAVING_THROWS: "SavingThrows",
    COMBAT: "Combat",
    INITIATIVE: "Initiative",
    MOVEMENT: "Movement",
    ENCUMBRANCE: "Encumbrance",
    CHARACTER_ACTIONS: "CharacterActions",
  }

  /**
   *
   * @type {Map<string, Map<string, SystemComponent>>}
   */
  static #registry = new Map(
    Object.values(this.categories).map((cat) => [cat, new Map()]),
  )

  /**
   * Register a system component
   * @param {string} category - One of SystemRegistry.categories
   * @param {SystemComponent} component - The component to register
   */
  static register(category, component) {
    if (!this.#registry.has(category)) {
      throw new Error(`Invalid category: ${category}`)
    }

    if (!component.id) {
      throw new Error("Component must have an id")
    }

    this.#registry.get(category).set(component.id, component)
  }

  /**
   * Get all registered components for a category
   * @param {string} category
   * @returns {SystemComponent[]}
   */
  static getAll(category) {
    return Array.from(this.#registry.get(category)?.values() ?? [])
  }

  /**
   * Get a specific component
   * @param {string} category
   *@param {string} id
   * @returns {SystemComponent|undefined}
   */
  static get(category, id) {
    return this.#registry.get(category)?.get(id)
  }

  /**
   * Get the selected category's selected component.
   * @param {string} category - The category to get.
   * @returns {object} The requested component
   */
  static getSelectedOfCategory(category) {
    try {
      return this.get(
        category,
        game.settings.get(SYSTEM_NAME, `selected${category}`),
      )
    } catch {
      return undefined
    }
  }

  static getDefaultOfCategory(category) {
    const entries = this.#registry.get(category).entries()

    return entries.find((e) => e.default) || {}
  }
}

export default SystemRegistry
