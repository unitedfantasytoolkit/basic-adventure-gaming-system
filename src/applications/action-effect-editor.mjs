/**
 * @file A subapp for {@link ./action-editor.mjs} that allows a user to edit an
 * action's effect.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

import BAGSApplication from "../applications/application.mjs"

/**
 * @type {object} ActionEffectEditor
 * @class
 */
export default class ActionEffectEditor extends BAGSApplication {
  _activeAction

  constructor(options = {}) {
    super(options)
    this.parent = options.parent
    this._activeAction = this.document.system.actions?.[0]?.id
  }

  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--effect-editor"],
    position: {
      width: 520,
      height: 480,
    },
    actions: {
      // Condition management
      "add-condition-change": this.addConditionChange,
      "delete-condition-change": this.deleteConditionChange,
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

  static get #abilityScoreChoices() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )
    return (abilityScoreSettings?.abilityScores || new Map())
      .entries()
      .reduce((obj, [key, score]) => ({ ...obj, [key]: score.label }), {})
  }

  static get #savingThrowChoices() {
    const savingThrowSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
      )
    return Object.entries(savingThrowSettings?.savingThrows || {}).reduce(
      (obj, [key, value]) => ({ ...obj, [key]: value.label }),
      {},
    )
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case "effect":
        context.effect = this.#effect

        context.changeModes = Object.entries(CONST.ACTIVE_EFFECT_MODES).reduce(
          (modes, [key, value]) => {
            // eslint-disable-next-line no-param-reassign
            modes[value] = game.i18n.localize(`EFFECT.MODE_${key}`)
            return modes
          },
          {},
        )

        context.priorities =
          foundry.applications.sheets.ActiveEffectConfig.DEFAULT_PRIORITIES

        context.abilityScoreChoices = ActionEffectEditor.#abilityScoreChoices
        context.savingThrowChoices = ActionEffectEditor.#savingThrowChoices

        break
      default:
        return super._preparePartContext(partId, context)
    }
    return context
  }

  static async deleteConditionChange(_event, button) {
    this.#effect.condition.changes.splice(
      button.dataset.conditionChangeIndex,
      1,
    )
    console.info(this.#effect.condition.changes)
    await this.document.updateEffect(this.#action.id, this.#effect.id, {
      condition: this.#effect.condition,
    })
    this.render(true)
  }

  static async addConditionChange() {
    const newChange =
      // eslint-disable-next-line max-len
      this.document.system.schema.fields.actions.element.fields.effects.element.fields.condition.fields.changes.element.getInitialValue()

    if (!Array.isArray(this.#effect.condition.changes)) {
      this.#effect.condition.changes = []
    }
    this.#effect.condition.changes.push(newChange)
    await this.document.updateEffect(this.#action.id, this.#effect.id, {
      condition: this.#effect.condition,
    })
    this.render(true)
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
    this.render(true)
  }
}
