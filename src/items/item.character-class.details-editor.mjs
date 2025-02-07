/**
 * @file A UI to edit a class's non-leveled data
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSApplication from "../common/app.mjs"

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

export default class BAGSCharacterClassDetailsEditor extends BAGSApplication {
  document

  constructor(options = {}) {
    super(options)
    this.document = options.document
  }

  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    id: "class-details-editor-{id}",
    classes: [
      "application--class-details-editor",
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
      width: 500,
      height: "auto",
    },
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/class`
  }

  static PARTS = {
    description: {
      template: `${this.TEMPLATE_ROOT}/description.edit.hbs`,
    },
    restrictions: {
      template: `${this.TEMPLATE_ROOT}/restrictions.edit.hbs`,
    },
    information: {
      template: `${this.TEMPLATE_ROOT}/class-details.edit.hbs`,
    },
    features: {
      template: `${this.TEMPLATE_ROOT}/features.edit.hbs`,
    },
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
        context.tab = context.tabs.description
        break
      case "restrictions":
        context.tab = context.tabs.restrictions
        break
      case "features":
        context.tab = context.tabs.features
        break
      case "information":
        context.tab = context.tabs.information
        break
      default:
        break
    }
    return context
  }

  /** @override */
  get title() {
    // const { constructor: cls, id, name, type } = this.document
    // const prefix = cls.hasTypeData
    //   ? CONFIG[cls.documentName].typeLabels[type]
    //   : cls.metadata.label
    // return `${prefix} ${game.i18n.localize("BAGS.CharacterClass.Information.EditorTitle")}: ${name ?? id}`
    console.info("???")
    return `Class Details: ${this.document.name}`
  }

  // === Render setup ==========================================================
  /** @override */
  async _prepareContext(_options) {
    const doc = this.document

    const gearTable = doc.system.gearTable
      ? await TextEditor.enrichHTML(
          fromUuidSync(doc.system.gearTable)._createDocumentLink(),
        )
      : ""

    return {
      item: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      systemFields: doc.system.schema.fields,
      formattedSystem: {
        gearTable,
      },
      tabs: this.#getTabs(),
    }
  }

  _onRender(context, options) {
    super._onRender(context, options)
    // for (const li of this.element.querySelectorAll("[data-combatant-id]")) {
    //   li.addEventListener("mouseover", this.#onCombatantHoverIn.bind(this));
    //   li.addEventListener("mouseout", this.#onCombatantHoverOut.bind(this));
    // }
    // this.element.addEventListener("change", this._updateObject);
  }

  // === Update process ========================================================
  async _updateObject(event) {
    console.info(event)
    // const combatant = game.combat.combatants.get(event.target.name)
    // await combatant.setFlag(game.system.id, "group", event.target.value)
  }

  static async save(_event, _form, formData) {
    // console.info(this, event, _form, formData)
    await this.document.update(formData.object)
    this.document.sheet.render()
  }

  // === UI Events==============================================================

  _onClickAction(event, target) {
    const { action } = target.dataset

    if (!action) return

    switch (action) {
      case "add-level":
      // return this.#addClassLevel()
      case "remove-level":
      // return this.#removeClassLevel()
    }

    super._onClickAction(event, target)
  }

  tabGroups = {
    sheet: "description",
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {
      description: {
        id: "description",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Description",
      },
      restrictions: {
        id: "restrictions",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Restrictions",
      },
      information: {
        id: "information",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Information",
      },
      features: {
        id: "features",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Features",
      },
    }
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id
      v.cssClass = v.active ? "active" : ""
    }
    return tabs
  }
}
