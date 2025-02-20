/**
 * @file An overriding document class for Item documents.
 */
import ActionResolver from "../rules-engines/action-resolver.mjs"

export default class BAGSItem extends Item {
  static PHYSICAL_TYPES = ["weapon", "armor", "item"]

  get isPhysical() {
    return BAGSItem.PHYSICAL_TYPES.includes(this.type)
  }

  // === Action management =====================================================

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

  getAction(actionId) {
    return this.system.actions.find(({ id }) => id === actionId)
  }

  getActionIndex(actionId) {
    return this.system.actions.findIndex(({ id }) => id === actionId)
  }

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

  async deleteAction(actionId) {
    return this.update({
      "system.actions": this.system.actions.filter(({ id }) => id === actionId),
    })
  }

  // === Action effect management ==============================================
  // Note: Action effects are different from *active effects*, which are a
  // document type in Foundry.

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

  getEffect(actionId, effectId) {
    return this.getAction(actionId).effects.find(({ id }) => id === effectId)
  }

  getEffectIndex(actionId, effectId) {
    return this.getAction(actionId).effects.findIndex(
      ({ id }) => id === effectId,
    )
  }

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

  deleteEffect(actionId, effectId) {
    const deletedEffectIndex = this.getEffectIndex(actionId, effectId)

    if (deletedEffectIndex < 0)
      throw new Error("Failed to update effect: effect not found")

    const action = this.getAction(actionId)
    action.effects.splice(deletedEffectIndex, 1)

    return this.updateAction(actionId, action)
  }

  // === Consumption management ================================================

  async onConsumption(actionId, attempt, target) {
    console.info(this, this.parent, attempt, target)
  }

  // === Equip state management ================================================

  equip() {
    return this.#toggleEquipState(true)
  }

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
