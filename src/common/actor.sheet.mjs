/**
 * @file The base class for applications in this system.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

const { HandlebarsApplicationMixin } = foundry.applications.api

export default class BAGSActorSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  static SUB_APPS = {}

  get subApps() {
    return this.#subApps
  }

  static get HEADER_CONTROLS() {
    return []
  }

  #subApps = {}

  constructor(options = {}) {
    super(options)

    /**
     * @todo skip over non-Applications
     */
    this.#subApps = Object.keys(this.constructor.SUB_APPS).reduce(
      (obj, key) => {
        const App = this.constructor.SUB_APPS[key]
        return {
          ...obj,
          [key]: new App({
            document: this.document,
          }),
        }
      },
      {},
    )
  }

  /** @type {string} */
  static DOCUMENT_TYPE = "actor"

  /**
   * Default tabs that *all* actor sheets should have.
   * @type {SheetNavTab[]}
   */
  static TABS = [
    {
      id: "summary",
      group: "sheet",
      icon: "fa-solid fa-square-list",
      label: "BAGS.CharacterClass.Tabs.Summary",
      cssClass: "tab--summary",
    },
    {
      id: "active-effects",
      group: "sheet",
      icon: "fa-solid fa-sitemap",
      label: "BAGS.CharacterClass.Tabs.Effects",
      cssClass: "tab--effects",
    },
  ]

  /** @type {string[]} */
  static CSS_CLASSES_WINDOW = []

  /** @type {string[]} */
  static CSS_CLASSES_CONTENT = []

  static DEFAULT_OPTIONS = {
    classes: [
      "application--bags",
      "application--sheet",
      "application--actor-sheet",
    ],
    window: {
      minimizable: true,
      resizable: true,
      contentTag: "section",
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
  }

  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
  }

  static TAB_PARTS = {
    summary: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/summary.hbs`,
    },
    effects: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/effects.hbs`,
    },
  }

  static get PARTS() {
    return {
      header: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/header.hbs`,
      },
      ...this.TAB_PARTS,
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case "effects":
        break
      default:
        break
    }
    return context
  }

  /**
   * Provide context to the templating engine.
   * @todo Change `item` to `document`
   * @override
   */
  async _prepareContext() {
    const doc = this.document

    return {
      item: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      systemFields: doc.system.schema.fields,
    }
  }
}
