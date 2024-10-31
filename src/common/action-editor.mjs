/**
 * @file A UI to edit an action.
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

export default class BAGSActionEditor extends HandlebarsApplicationMixin(
  ApplicationV2
) {
  document

  actionId

  constructor(document, actionId, options = {}) {
    super(options)
    this.document = document
    this.actionId = actionId
  }

  get action() {
    return this.document.system.actions.find((a) => a.id === this.actionId)
  }

  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    id: "action-editor-{id}",
    classes: [
      "application--action-editor",
      "application--bags",
      "application--hide-title",
    ],
    tag: "form",
    window: {
      frame: true,
      positioned: true,
      controls: [],
      minimizable: false,
      resizable: false,
      contentTag: "section",
      contentClasses: [],
    },
    actions: {},
    form: {
      handler: this.save,
      submitOnChange: true,
    },
    position: {
      width: 520,
      height: "auto",
    },
  }

  // === Rendering =============================================================

  // --- Tabs and Templates ----------------------------------------------------
  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/action-editor`
  }

  static PARTS = {
    header: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/header.hbs`,
    },
    "tab-navigation": {
      template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
    },
    details: {
      template: `${this.TEMPLATE_ROOT}/details.hbs`,
    },
    description: {
      template: `${this.TEMPLATE_ROOT}/description.hbs`,
    },
    effects: {
      template: `${this.TEMPLATE_ROOT}/effects.hbs`,
      scrollable: [".scrollable"],
    },
  }

  tabGroups = {
    // sheet: "xp-table",
    sheet: "details",
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {
      details: {
        id: "details",
        group: "sheet",
        icon: "fa-solid fa-list-tree",
        label: "BAGS.Actions.Editor.Tabs.Details",
      },
      effects: {
        id: "effects",
        group: "sheet",
        icon: "fa-solid fa-sparkle",
        label: "BAGS.Actions.Editor.Tabs.Effects",
      },
      description: {
        id: "description",
        group: "sheet",
        icon: "fa-solid fa-trophy",
        label: "BAGS.Actions.Editor.Tabs.Description",
      },
    }
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id
      v.cssClass = v.active ? "active" : ""
    }
    return tabs
  }

  // --- UI Element Overrides --------------------------------------------------
  /** @override */
  get title() {
    const { constructor: cls, id, name, type } = this.document
    const prefix = cls.hasTypeData
      ? CONFIG[cls.documentName].typeLabels[type]
      : cls.metadata.label
    // return `${game.i18n.localize("BAGS.CharacterClass.XPTable.EditorTitle")}: ${name ?? id}`
    return `Action Editor: ${this.action.name}`
  }

  // === Render setup ==========================================================
  async _prepareContext(_options) {
    const doc = this.document

    console.info(this.#getTabs())

    return {
      item: doc,
      source: doc.toObject(),
      fields: doc.system.schema.fields.actions.element.fields,
      action: this.action,
      tabs: this.#getTabs(),
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    switch (partId) {
      case "header":
        context.title = this.title
        context.hideIcon = true
        break
      case "description":
        context.tab = context.tabs[partId]
        break
      case "details":
        context.tab = context.tabs[partId]
        break
      case "effects":
        context.tab = context.tabs[partId]
        break
      default:
        break
    }
    return context
  }

  // === Update process ========================================================
  static async save(_event, _form, formData) {
    const updates = foundry.utils.expandObject(formData.object)
    const actions = this.document.system.actions.map((a) =>
      a.id !== this.actionId ? a : { ...a, ...updates }
    )
    console.log(actions)
    await this.document.update({
      "system.actions": actions,
    })
    this.document.sheet.render()
    this.render()
  }

  // === UI Events==============================================================

  // === Event Delegation =======================================================

  _onClickAction(event, target) {
    super._onClickAction(event, target)
  }
}
