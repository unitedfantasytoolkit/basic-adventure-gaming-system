/**
 * @file An overriding document class for Item documents in the BAGS system.
 */
import ActionResolver from "../rules-engines/action-resolver.mjs"

/**
 * Extends the base Foundry VTT Item document class with BAGS-specific
 * functionality.
 * Handles actions, effects, equipment state, and other item-related features.
 * @augments {Item}
 */
export default class BAGSItem extends Item {
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
      "system.actions": this.system.actions.filter(({ id }) => id === actionId),
    })
  }

  // === Action effect management ==============================================
  // Note: Action effects are different from *active effects*, which are a
  // document type in Foundry.

  /**
   * Creates a new effect for a specific action
   * @param {string} actionId - The unique identifier of the action to add the
   * effect to
   * @returns {Promise<void>} A Promise that resolves when the effect is created
   */
  async createEffect(actionId) {
    const { actions: actionSchema } = this.document.system.schema.fields
    const effect = foundry.utils.mergeObject(
      actionSchema.element.fields.effects.element.getInitialValue(),
      {
        id: foundry.utils.randomID(),
      },
    )
    const { actions } = this.document.system
    const actionIndex = actions.findIndex((a) => a.id === actionId)

    return this.document.system.actions.forEach((a, index) => {
      if (index === actionIndex) a.effects.push(effect)
    })
  }

  /**
   * Retrieves an effect from an action
   * @param {string} actionId - The unique identifier of the action
   * @param {string} effectId - The unique identifier of the effect
   * @returns {Object|undefined} The effect object if found, undefined otherwise
   */
  getEffect(actionId, effectId) {
    return this.getAction(actionId).effects.find(({ id }) => id === effectId)
  }

  /**
   * Gets the index of an effect within an action's effects array
   * @param {string} actionId - The unique identifier of the action
   * @param {string} effectId - The unique identifier of the effect
   * @returns {number} The index of the effect, or -1 if not found
   */
  getEffectIndex(actionId, effectId) {
    return this.getAction(actionId).effects.findIndex(
      ({ id }) => id === effectId,
    )
  }

  /**
   * Updates an existing effect with new data
   * @param {string} actionId - The unique identifier of the action
   * @param {string} effectId - The unique identifier of the effect
   * @param {Object} updates - The properties to update on the effect
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   * @throws {Error} If the effect is not found
   */
  updateEffect(actionId, effectId, updates) {
    const updatedEffectIndex = this.getEffectIndex(actionId, effectId)

    if (updatedEffectIndex < 0)
      throw new Error("Failed to update effect: effect not found")

    const action = this.getAction(actionId)
    action.effects[updatedEffectIndex] = {
      ...action.effects[updatedEffectIndex],
      ...updates,
    }

    return this.updateAction(actionId, action)
  }

  /**
   * Deletes an effect from an action
   * @param {string} actionId - The unique identifier of the action
   * @param {string} effectId - The unique identifier of the effect to delete
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   * @throws {Error} If the effect is not found
   */
  deleteEffect(actionId, effectId) {
    const deletedEffectIndex = this.getEffectIndex(actionId, effectId)

    if (deletedEffectIndex < 0)
      throw new Error("Failed to update effect: effect not found")

    const action = this.getAction(actionId)
    action.effects.splice(deletedEffectIndex, 1)

    return this.updateAction(actionId, action)
  }

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
}
