/**
 * @file An overriding document class for Item documents in the BAGS system.
 */
import {
  DEFAULT_ART_ITEM_ABILITY,
  DEFAULT_ART_ITEM_ARMOR,
  DEFAULT_ART_ITEM_CHARACTER_CLASS,
  DEFAULT_ART_ITEM_IDENTITY,
  DEFAULT_ART_ITEM_ITEM,
  DEFAULT_ART_ITEM_SPELL,
  DEFAULT_ART_ITEM_WEAPON,
} from "../config/constants.mjs"
import ActionResolver from "../rules-engines/action-resolver.mjs"

/**
 * Extends the base Foundry VTT Item document class with BAGS-specific
 * functionality.
 * Handles actions, effects, equipment state, and other item-related features.
 * @augments {Item}
 */
export default class BAGSItem extends Item {
  static getDefaultArtwork(actorData) {
    let art = ""

    switch (actorData.type) {
      case "weapon":
        art = DEFAULT_ART_ITEM_WEAPON
        break
      case "armor":
        art = DEFAULT_ART_ITEM_ARMOR
        break
      case "class":
        art = DEFAULT_ART_ITEM_CHARACTER_CLASS
        break
      case "identity":
        art = DEFAULT_ART_ITEM_IDENTITY
        break
      case "spell":
        art = DEFAULT_ART_ITEM_SPELL
        break
      case "ability":
        art = DEFAULT_ART_ITEM_ABILITY
        break
      default:
        art = DEFAULT_ART_ITEM_ITEM
        break
    }

    return {
      img: art || this.DEFAULT_ICON,
    }
  }

  /** @type {string[]} Types of items that are considered physical objects */
  static PHYSICAL_TYPES = ["weapon", "armor", "item"]

  /**
   * Whether this item represents a physical object that can be equipped
   * @type {boolean}
   * @readonly
   */
  get isPhysical() {
    return BAGSItem.PHYSICAL_TYPES.includes(this.type)
  }

  /**
   * HTML strings representing parts of the item's tooltip
   * @returns {{[key: string]: string}} The strings used to build the tooltip.
   */
  get tooltipHTML() {
    return {
      controls: this.system._tooltipControlsHTML,
      logistics: this.system._tooltipLogisticsHTML,
      body: this.system._tooltipContentHTML,
    }
  }

  // === Action management =====================================================

  /**
   * Creates a new action for this item
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   */
  async createAction() {
    const actions = [
      ...this.system.actions,
      {
        ...this.system.schema.fields.actions.element.getInitialValue(),
        id: foundry.utils.randomID(),
      },
    ]
    return this.update({ "system.actions": actions })
  }

  /**
   * Retrieves an action by its ID
   * @param {string} actionId - The unique identifier of the action
   * @returns {Object|undefined} The action object if found, undefined otherwise
   */
  getAction(actionId) {
    return this.system.actions.find(({ id }) => id === actionId)
  }

  /**
   * Gets the index of an action in the actions array
   * @param {string} actionId - The unique identifier of the action
   * @returns {number} The index of the action, or -1 if not found
   */
  getActionIndex(actionId) {
    return this.system.actions.findIndex(({ id }) => id === actionId)
  }

  /**
   * Resolves an action using the ActionResolver
   * @see {@link ../rules-engines/action-resolver.mjs}
   * @param {string|Object} action - Either an action ID or the action object
   * itself
   * @returns {Promise<Object>} The result of the action resolution
   */
  async resolveAction(action) {
    const fetchedAction =
      typeof action === "string" ? this.getAction(action) : action

    const resolver = new ActionResolver(
      fetchedAction,
      this,
      this.parent,
      game.user.targets,
    )

    return resolver.resolve()
  }

  /**
   * Updates an existing action with new data
   * @param {string} actionId - The unique identifier of the action to update
   * @param {Object} updates - The properties to update on the action
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   * @throws {Error} If the action is not found
   */
  async updateAction(actionId, updates) {
    const updatedActionIndex = this.getActionIndex(actionId)

    if (updatedActionIndex < 0)
      throw new Error("Failed to update action: action not found")

    const updatedActions = this.system.actions.map((a) => {
      if (a.id !== actionId) return a
      return {
        ...a,
        ...updates,
      }
    })

    return this.update({
      "system.actions": updatedActions,
    })
  }

  /**
   * Deletes an action from this item
   * @param {string} actionId - The unique identifier of the action to delete
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   */
  async deleteAction(actionId) {
    return this.update({
      "system.actions": this.system.actions.filter(({ id }) => id !== actionId),
    })
  }

  // === Action effect management ==============================================
  // Note: Action effects are different from *active effects*, which are a
  // document type in Foundry.
  // Effect management is now handled by the ActionEditor and
  // ActionEffectEditor applications.

  // === Consumption management ================================================

  /**
   * Handles the consumption of resources when an action is used
   * @param {string} actionId - The unique identifier of the action being used
   * @param {Object} attempt - The attempt object containing roll results
   * @param {Actor} target - The target of the action
   * @returns {Promise<void>} A Promise that resolves when consumption is
   * handled
   */
  async onConsumption(actionId, attempt, target) {
    console.info(this, this.parent, attempt, target)
  }

  // === Equip state management ================================================

  /**
   * Equips this item if it's a physical item type
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   */
  equip() {
    return this.#toggleEquipState(true)
  }

  /**
   * Unequips this item if it's a physical item type
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   */
  unequip() {
    return this.#toggleEquipState(false)
  }

  /**
   * Set a physical item's equipped state.
   * @param setState {Boolean} - A state to force this item's isEquipped
   * property to.
   * @returns {Promise} The attempt to update this Item document.
   */
  async #toggleEquipState(setState) {
    if (!this.isPhysical)
      throw new Error(`Items of type ${this.type} cannot be equipped.`)

    const newState =
      typeof setState === "boolean" ? setState : !this.system.isEquipped

    return this.update({ "system.isEquipped": newState })
  }

  // === Container Management ==================================================

  /**
   * Add this item to a container.
   * Validates that the target is a container and prevents circular references.
   * @param {Item} container - The container to add this item to
   * @returns {Promise<Item>} The updated container
   * @throws {Error} If target is not a container or would create circular ref
   */
  async addToContainer(container) {
    const { addItemToContainer, wouldCreateCircularRef } = await import(
      "../utils/container-utils.mjs"
    )

    if (wouldCreateCircularRef(this, container)) {
      throw new Error(
        "Cannot add item to container: would create circular reference",
      )
    }

    return addItemToContainer(this, container)
  }

  /**
   * Remove this item from its parent container.
   * @returns {Promise<Item|null>} The updated container, or null if not in a container
   */
  async removeFromContainer() {
    const { removeItemFromContainer } = await import(
      "../utils/container-utils.mjs"
    )
    return removeItemFromContainer(this)
  }

  // === Lifecycle Hooks =======================================================

  /**
   * Pre-update hook to clean invalid container references.
   * @override
   */
  async _preUpdate(changes, options, user) {
    // Clean invalid container refs when updating
    if (
      changes.system?.container?.contains &&
      this.system.container?.isContainer
    ) {
      changes.system.container.contains = await this._cleanContainerRefs(
        changes.system.container.contains,
      )
    }

    return super._preUpdate(changes, options, user)
  }

  /**
   * Remove invalid UUIDs from container references.
   * Ensures all UUIDs resolve to valid items in the same actor.
   * @param {string[]} uuids - Array of item UUIDs to validate
   * @returns {Promise<string[]>} Filtered array of valid UUIDs
   * @private
   */
  async _cleanContainerRefs(uuids) {
    const { cleanContainerRefs } = await import("../utils/container-utils.mjs")
    return cleanContainerRefs(uuids, this.actor)
  }
}
