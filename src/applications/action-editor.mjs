import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

import BAGSApplication from "../applications/application.mjs"

/**
 * @typedef {object} ActionEditor
 * @class
 */
export default class ActionEditor extends BAGSApplication {
  #activeAction

  constructor(options = {}) {
    super(options)

    this.#activeAction = this.document.system.actions?.[0]?.id
  }

  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--action-editor"],
    window: {
      contentClasses: ["application__master-detail"],
    },
    actions: {
      "select-action": this.selectAction,
      "add-action": this.addAction,
      "delete-action": this.deleteAction,
      "add-effect": this.addEffect,
      "delete-effect": this.deleteEffect,
    },
    position: {
      width: 720,
      height: 480,
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/action-editor`
  }

  static PARTS = {
    master: {
      template: `${this.TEMPLATE_ROOT}/master.hbs`,
    },
    detail: {
      template: `${this.TEMPLATE_ROOT}/detail.hbs`,
      scrollable: [".scrollable"],
    },
  }

  get title() {
    return `Action Editor: ${this.document.name}`
  }

  // === Rendering =============================================================

  /**
   * Provide context to the templating engine.
   * @override
   */
  async _prepareContext() {
    const context = await super._prepareContext()

    const doc = this.document

    return {
      ...context,
      actor: doc,
      source: doc.toObject(),
      fields: doc.system.schema.fields.actions.element.fields,
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    switch (partId) {
      case "master":
        context.actions = doc.system.actions.map((a) => ({
          ...a,
          active: a.id === this.#activeAction,
        }))
        break
      case "detail":
        context.action = this.#activeAction
          ? doc.system.actions.find((a) => a.id === this.#activeAction)
          : doc.system.actions[0]
        break
      default:
        return super._preparePartContext(partId, context)
    }
    return context
  }

  // === Action management =====================================================

  static selectAction(e) {
    const actionElement = e.target.closest("[data-action-id]")
    const { actionId } = actionElement.dataset
    if (actionId) {
      this.#activeAction = actionId
      this.render()
    }
  }

  static async addAction(e) {
    await this.document.createAction()
    this.render()
  }

  /**
   * @todo Confirmation dialog to delete the action
   * @todo If the active ID is the one being deleted, reset it:
   *   - Unset if there's nothing else to set it to
   *   - Otherwise set it to the ID after this one sequentially
   */
  static async deleteAction(event) {
    await this.document.deleteAction(
      event.target.closest("[data-action-id]").dataset.actionId,
    )
    this.render()
  }

  // === Effect management =====================================================

  static async addEffect() {}

  static async deleteEffect() {}

  // === Saving ================================================================

  /**
   * Attempt to update the active action.
   * @param {SubmitEvent} _event - Todo
   * @param {HTMLFormElement} _form - Todo
   * @param {FormData} formData - Data from this Application's form.
   * @this {ActionEdtior}
   */
  static async save(_event, _form, formData) {
    try {
      const updatedActionIndex = this.document.system.actions.findIndex(
        (a) => a.id === this.#activeAction,
      )

      if (updatedActionIndex < 0)
        throw new Error("Failed to update action: action not found")

      await this.document.update({
        [`system.actions.${updatedActionIndex}`]: formData.object,
      })
      this.render()
    } catch (e) {
      this.render()
      throw new Error(e)
    }
  }
}
