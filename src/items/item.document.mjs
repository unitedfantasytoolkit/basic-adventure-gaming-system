/**
 * @file An overriding document class for Item documents.
 */
import ActionResolver from "../rules-engines/action-resolver.mjs"

export default class BAGSItem extends Item {
  async resolveAction(action) {
    const resolver = new ActionResolver(action, {
      item: this,
      actor: this.parent,
      targets: game.user.targets,
    })

    console.info(await resolver.resolve())
  }

  async createAction() {
    const actions = [
      ...this.system.actions,
      {
        ...this.system.schema.fields.actions.element.initial(),
        id: crypto.randomUUID(),
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
}
