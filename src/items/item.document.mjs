/**
 * @file An overriding document class for Item documents.
 */
import ActionResolver from "../rules-engines/action-resolver.mjs"

export default class BAGSItem extends Item {
  static PHYSICAL_TYPES = ["weapon", "armor", "item"]

  async resolveAction(action) {
    const resolver = new ActionResolver(
      action,
      this,
      this.parent,
      game.user.targets,
    )

    return resolver.resolve()
  }

  async createAction() {
    const actions = [
      ...this.system.actions,
      {
        ...this.system.schema.fields.actions.element.getInitialValue(),
        id: foundry.utils.randomID(),
      },
    ]
    return this.update({
      "system.actions": actions,
    })
  }

  async deleteAction(id) {
    const actions = this.system.actions.filter((i) => i.id && i.id !== id)

    return this.update({
      "system.actions": actions,
    })
  }

  async onConsumption(attempt, target) {
    console.info(this, this.parent, attempt, target)
  }

  equip() {
    return this.#toggleEquipState(true)
  }

  unequip() {
    return this.#toggleEquipState(false)
  }

  #toggleEquipState(setState) {
    if (!this.isPhysical) return

    const newState =
      typeof setState === "boolean" ? setState : !this.system.isEquipped

    return this.update({ "system.isEquipped": newState })
  }

  get isPhysical() {
    return BAGSItem.PHYSICAL_TYPES.includes(this.type)
  }
}
