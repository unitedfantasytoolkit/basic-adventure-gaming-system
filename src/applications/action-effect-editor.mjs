import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

import BAGSApplication from "../applications/application.mjs"

/**
 * @typedef {object} ActionEffectEditor
 * @class
 */
export default class ActionEffectEditor extends BAGSApplication {
  _activeAction

  constructor(options = {}) {
    super(options)

    this._activeAction = this.document.system.actions?.[0]?.id
  }

  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--effect-editor"],
    position: {
      width: 520,
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
    effect: {
      template: `${this.TEMPLATE_ROOT}/effect-editor.hbs`,
      scrollable: [".scrollable"],
    },
  }

  get title() {
    return `Effect Editor: ${this.document.name}`
  }

  #action

  #effect

  prepareToEdit(action, effect) {
    let fetchedAction = action
    let fetchedEffect = effect

    if (typeof fetchedAction === "string") {
      fetchedAction = this.document.getAction(action)
    }

    if (typeof fetchedEffect === "string") {
      fetchedEffect = this.document.getEffect(fetchedAction.id, effect)
    }

    this.#action = fetchedAction
    this.#effect = fetchedEffect
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
      source: doc.toObject(),
      fields:
        doc.system.schema.fields.actions.element.fields.effects.element.fields,
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case "effect":
        context.effect = this.#effect
        break
      default:
        return super._preparePartContext(partId, context)
    }
    return context
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("button.add-change").click(ev => this.addConditionChange(ev));
  }

  addConditionChange(ev) {
    const newChange = {
      key: "",
      value: "",
      mode: "ADD",
      priority: 0,
    };
    if (!this.#effect.condition) {
      this.#effect.condition = {
        name: "New Condition",
        img: "",
        description: "",
        changes: [],
        duration: { rounds: 0, seconds: 0, turns: 0 },
      };
    }
    if (!Array.isArray(this.#effect.condition.changes)) {
      this.#effect.condition.changes = [];
    }
    this.#effect.condition.changes.push(newChange);
    this.document.updateEffect(this.#action.id, this.#effect.id, { condition: this.#effect.condition })
      .then(() => this.render());
  }

  // === Saving ================================================================

  /**
   * Attempt to update the active action.
   * @param {SubmitEvent} _event - Todo
   * @param {HTMLFormElement} _form - Todo
   * @param {FormData} formData - Data from this Application's form.
   * @this {ActionEdtior}
   */
  static async save(_event, _form, formData) {
    await this.document.updateEffect(
      this.#action.id,
      this.#effect.id,
      formData.object,
    )
    this.prepareToEdit(this.#action.id, this.#effect.id)
    this.render()
    // try {
    //   const updatedActionIndex = this.document.system.actions.findIndex(
    //     (a) => a.id === this._activeAction,
    //   )

    //   if (updatedActionIndex < 0)
    //     throw new Error("Failed to update action: action not found")

    //   const updatedActions = this.document.system.actions.map((a) => {
    //     if (a.id !== this._activeAction) return a
    //     return {
    //       ...a,
    //       ...formData.object,
    //     }
    //   })

    //   await this.document.update({
    //     "system.actions": updatedActions,
    //   })
    //   this.render()
    // } catch (e) {
    //   this.render()
    //   throw new Error(e)
    // }
  }
}
