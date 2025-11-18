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
      const actionObj = this.document.getAction(fetchedAction.id)
      fetchedEffect = actionObj?.effects.find(({ id }) => id === effect)
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
    const action = this.document.getAction(this.#action.id)
    if (!action) return

    const effect = action.effects.find(({ id }) => id === this.#effect.id)
    if (!effect) return

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BAGS.Actions.DeleteConditionChange.Title") },
      content: `<p>${game.i18n.localize("BAGS.Actions.DeleteConditionChange.Content")}</p>`,
      rejectClose: false,
      modal: true,
    })
    
    if (!confirmed) return

    const updatedChanges = [...effect.condition.changes]
    updatedChanges.splice(button.dataset.conditionChangeIndex, 1)

    const updatedEffects = action.effects.map((e) =>
      e.id === this.#effect.id
        ? { ...e, condition: { ...e.condition, changes: updatedChanges } }
        : e,
    )

    await this.document.updateAction(this.#action.id, {
      effects: updatedEffects,
    })

    // Refresh our local reference
    this.#effect = updatedEffects.find(({ id }) => id === this.#effect.id)
    this.render(true)
  }

  static async addConditionChange() {
    const action = this.document.getAction(this.#action.id)
    if (!action) return

    const effect = action.effects.find(({ id }) => id === this.#effect.id)
    if (!effect) return

    const newChange =
      this.document.system.schema.fields.actions.element.fields.effects.element.fields.condition.fields.changes.element.getInitialValue()

    const updatedChanges = [...(effect.condition.changes || []), newChange]

    const updatedEffects = action.effects.map((e) =>
      e.id === this.#effect.id
        ? { ...e, condition: { ...e.condition, changes: updatedChanges } }
        : e,
    )

    await this.document.updateAction(this.#action.id, {
      effects: updatedEffects,
    })

    // Refresh our local reference
    this.#effect = updatedEffects.find(({ id }) => id === this.#effect.id)
    this.render(true)
  }

  // === Saving ================================================================

  /**
   * Attempt to update the active action.
   * @param {SubmitEvent} _event - Todo
   * @param {HTMLFormElement} _form - Todo
   * @param {FormData} formData - Data from this Application's form.
   * @this {ActionEffectEditor}
   */
  static async save(_event, _form, formData) {
    const action = this.document.getAction(this.#action.id)
    if (!action) return

    const updatedEffects = action.effects.map((e) =>
      e.id === this.#effect.id ? { ...e, ...formData.object } : e,
    )

    await this.document.updateAction(this.#action.id, {
      effects: updatedEffects,
    })

    // Refresh our local references
    this.#effect = updatedEffects.find(({ id }) => id === this.#effect.id)
    this.render(true)
  }
}
