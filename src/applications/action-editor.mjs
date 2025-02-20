import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

import BAGSApplication from "../applications/application.mjs"
import ActionEffectEditor from "./action-effect-editor.mjs"

/**
 * @typedef {object} ActionEditor
 * @class
 */
export default class ActionEditor extends BAGSApplication {
  static SUB_APPS = {
    effectEditor: ActionEffectEditor,
  }

  _activeAction

  constructor(options = {}) {
    super(options)

    this._activeAction = this.document.system.actions?.[0]?.id
  }

  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--action-editor"],
    window: {
      contentClasses: ["application__master-detail"],
    },
    actions: {
      // Action management
      "select-action": this.selectAction,
      "add-action": this.addAction,
      "delete-action": this.deleteAction,
      // Effect management
      "add-action-effect": this.addActionEffect,
      "delete-action-effect": this.deleteActionEffect,
      "edit-action-effect": this.editActionEffect,
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

  // --- Tabs ------------------------------------------------------------------

  tabGroups = {
    sheet: "effects",
  }

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "settings",
          group: "sheet",
          icon: "fa-solid fa-gear",
          label: "Settings",
        },
        {
          id: "attempt",
          group: "sheet",
          icon: "fa-solid fa-bullseye-arrow",
          label: "Attempt",
        },
        {
          id: "attempt-messages",
          group: "sheet",
          icon: "fa-solid fa-note",
          label: "Attempt Messages",
        },
        {
          id: "effects",
          group: "sheet",
          icon: "fa-solid fa-sparkle",
          label: "Effects",
        },
        {
          id: "consumption",
          group: "sheet",
          icon: "fa-solid fa-star-half",
          label: "Consumption",
        },
        {
          id: "restrictions",
          group: "sheet",
          icon: "fa-solid fa-unlock",
          label: "Restrictions",
        },
      ],
      initial: "attempt",
      labelPrefix: "BAGS.Actions.Tabs",
    },
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
          active: a.id === this._activeAction,
        }))
        break
      case "detail":
        context.action = this._activeAction
          ? doc.getAction(this._activeAction)
          : doc.system.actions[0]
        context.tab = this.constructor.TABS.sheet.tabs.find(
          ({ id }) => id === this.tabGroups.sheet,
        )
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
      this._activeAction = actionId
      this.render()
    }
  }

  static async addAction(e) {
    await this.document.createAction()
    if (!this._activeAction)
      this._activeAction = this.document.system.actions[0].id
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

  /**
   * Add a new Effect to the currently editable action.
   * @todo This function updates `this.document.actions`. Since it's triggered
   * in response to a click, it ends up submitting the updated object right
   * after. Is this desirable? How might this break?
   */
  static async addActionEffect() {
    this.document.createEffect(this._activeAction)
  }

  static async deleteActionEffect(_event, button) {
    await this.document.deleteEffect(
      this._activeAction,
      button.dataset.effectId,
    )
  }

  static async editActionEffect(_event, button) {
    const action = this.document.getAction(this._activeAction)
    const effect = this.document.getEffect(
      this._activeAction,
      button.dataset.effectId,
    )
    this.subApps.effectEditor.prepareToEdit(action, effect)
    this.subApps.effectEditor.render(true)
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
    try {
      await this.document.updateAction(this._activeAction, formData.object)
      this.render()
    } catch (e) {
      this.render()
      throw new Error(e)
    }
  }
}
