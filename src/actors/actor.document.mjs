/**
 * @file The entity class for all Actors in the syste
 */

import {
  DEFAULT_ART_ACTOR_CHARACTER,
  DEFAULT_ART_ACTOR_MONSTER,
  DEFAULT_ART_ACTOR_MOUNT,
} from "../config/constants.mjs"

import CharacterCreationWizard from "./actor.character.creation-wizard.mjs"
import ActionResolver from "../rules-engines/action-resolver.mjs"

export default class BAGSActor extends Actor {
  static getDefaultArtwork(actorData) {
    let art = ""

    switch (actorData.type) {
      case "character":
        art = DEFAULT_ART_ACTOR_CHARACTER
        break
      case "mount":
        art = DEFAULT_ART_ACTOR_MOUNT
        break
      case "monster":
      default:
        art = DEFAULT_ART_ACTOR_MONSTER
        break
    }

    return {
      img: art,
      texture: {
        src: art,
      },
    }
  }

  /**
   * Get all ActiveEffects that may apply to this Actor.
   * If CONFIG.ActiveEffect.legacyTransferral is true, this is equivalent to actor.effects.contents.
   * If CONFIG.ActiveEffect.legacyTransferral is false, this will also return all the transferred ActiveEffects on any
   * of the Actor's owned Items.
   * @yields {ActiveEffect}
   * @returns {Generator<ActiveEffect, void, void>}
   */
  *allApplicableEffects() {
    for (const effect of this.effects) {
      yield effect
    }
    if (CONFIG.ActiveEffect.legacyTransferral) return
    for (const item of this.items) {
      for (const effect of item.effects) {
        if (item.isPhysical && !item.system.isEquipped) continue
        if (effect.transfer) yield effect
      }
    }
  }

  // get appliedEffects() {
  //   const effects = super.appliedEffects.filter((e) => {
  //     if (e.parent instanceof CONFIG.Actor.documentClass) return true
  //     if (e.parent.isPhysical) {
  //       console.info(e.parent.system)
  //       return e.parent.system.isEquipped
  //     }
  //     return false
  //   })

  //   return effects
  // }

  get appliedEffectsByAffectedKey() {
    const attributeModifications = new Map()

    this.appliedEffects.forEach((effect) => {
      if (!effect.changes?.length) return

      effect.changes.forEach((change) => {
        const { key, ...modification } = change

        if (!attributeModifications.has(key))
          attributeModifications.set(key, [])

        attributeModifications.get(key).push({
          name: effect.name,
          id: effect.id,
          img: effect.img,
          parent: effect.parent,
          modification,
          statuses: effect.statuses,
        })
      })
    })

    return attributeModifications
  }

  get appliedEffectsBySource() {
    const sources = new Map()

    this.appliedEffects.forEach((effect) => {
      const { uuid } = effect.parent
      if (!sources.has(uuid)) sources.set(uuid, [])
      sources.get(uuid).push(effect)
    })

    return Array.from(sources.entries()).map(([uuid, effects]) => ({
      parent: fromUuidSync(uuid),
      effects,
    }))
  }

  get temporaryAppliedEffects() {
    return this.appliedEffects.filter((e) => e.isTemporary)
  }

  get lastingAppliedEffects() {
    return this.appliedEffects.filter((e) => !e.isTemporary)
  }

  get actions() {
    const documentToActions = ({ id, uuid, name, img, ...i }) => ({
      id,
      uuid,
      name,
      img,
      actions: i.system?.actions || [],
    })

    const itemActions = Object.entries(this.items.documentsByType).reduce(
      (obj, [key, items]) => ({
        ...obj,
        [key]: items
          .filter((i) => i.system?.actions?.length)
          .map(documentToActions),
      }),
      {},
    )

    return {
      builtins: [documentToActions(this)],
      ...itemActions,
    }
  }

  get equipped() {
    const equipped = {
      weapon: [],
      armor: [],
      item: [],
    }
    this.items
      .filter((i) => i.system.isEquipped)
      .forEach((i) => equipped[i.type].push(i))
    return equipped
  }

  get flattenedOverrides() {
    return foundry.utils.flattenObject(this.overrides)
  }

  async rollSave(save, modifier) {
    const roll = new Roll(
      `1d20+${modifier}cs<=${this.system.savingThrows[save]}`,
    )

    await roll.resolve()
  }

  async doCreationWizard() {
    const wizard = new CharacterCreationWizard({
      actor: this,
    })

    wizard.render(true)
  }

  getRollData() {
    return this.system
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
  getAction(actionId, itemId) {
    const actionSource = !itemId ? this.system : this.items.get(itemId)?.system
    return actionSource?.actions.find(({ id }) => id === actionId)
  }

  /**
   * Gets the index of an action in the actions array
   * @param {string} actionId - The unique identifier of the action
   * @returns {number} The index of the action, or -1 if not found
   */
  getActionIndex(actionId, itemId) {
    const actionSource = !itemId ? this.system : this.items.get(itemId)?.system
    return actionSource?.actions.findIndex(({ id }) => id === actionId)
  }

  /**
   * Resolves an action using the ActionResolver
   * @see {@link ../rules-engines/action-resolver.mjs}
   * @param {string|object} action - Either an action ID or the action object
   * itself
   * @param {string} itemId - The parent item of the action, if any.
   * @returns {Promise<object>} The result of the action resolution
   */
  async resolveAction(action, itemId = "") {
    const fetchedAction =
      typeof action === "string" ? this.getAction(action, itemId) : action
    const item = itemId ? this.items.get(itemId) : null
    const resolver = new ActionResolver(
      fetchedAction,
      item,
      this,
      game.user.targets,
    )
    return resolver.resolve()
  }

  /**
   * Updates an existing action with new data
   * @param {string} actionId - The unique identifier of the action to update
   * @param {object} updates - The properties to update on the action
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

  /**
   * Creates a new effect for a specific action
   * @param {string} actionId - The unique identifier of the action to add the
   * effect to
   * @returns {Promise<void>} A Promise that resolves when the effect is created
   */
  async createEffect(actionId) {
    const { actions: actionSchema } = this.system.schema.fields
    const effect = foundry.utils.mergeObject(
      actionSchema.element.fields.effects.element.getInitialValue(),
      {
        id: foundry.utils.randomID(),
      },
    )
    const { actions } = this.system
    const actionIndex = actions.findIndex((a) => a.id === actionId)

    return this.system.actions.forEach((a, index) => {
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
}
