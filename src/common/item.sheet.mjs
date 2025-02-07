/**
 * @file The base class for Item sheets in this system.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSActionEditor from "../common/action-editor.mjs"

const { HandlebarsApplicationMixin } = foundry.applications.api

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

export default class BAGSBaseItemSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
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

  // static DOCUMENT_TYPE = "item"

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

  static CSS_CLASSES_WINDOW = []

  static CSS_CLASSES_CONTENT = []

  static DEFAULT_OPTIONS = {
    id: "{id}",
    classes: [
      "application--bags",
      "application--sheet",
      "application--item-sheet",
    ],
    window: {
      minimizable: true,
      resizable: true,
      contentTag: "section",
      contentClasses: this.CSS_CLASSES_CONTENT,
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
    actions: {
      addAction: this._onAddAction,
      editAction: this._onEditAction,
      deleteAction: this._onDeleteAction,
      performAction: this._onPerformAction,
    },
  }

  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/${this.DOCUMENT_TYPE}`
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
      ...this.TAB_PARTS,
      "tab-navigation": {
        template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
      },
    }
  }

  get title() {
    return this.document.name
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    context.tab = context.tabs.find((t) => t.id === partId)
    switch (partId) {
      case "header":
        context.canShowIcon = true
        context.title = doc.name
        break
      case "summary":
        break
      case "effects":
        break
      case "tab-navigation":
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
      tabs: this.#getTabs(),
    }
  }

  /**
   * Render the outer framing HTMLElement which wraps the inner HTML of
   * the Application.
   *
   * This override modifies the default frame by adding the following:
   * - an alternative header: the existing elements in the header are moved
   *   around into a format tha makes more sense for our design.
   * - tab navigation: if the sheet has tabs, to enforce consistency.
   * - an effects pane: a common UI for managing active effects on
   *   actors and items
   * @param {unknown} options - Options which configure application rendering
   * behavior. See {RenderOptions} in Foundry's types.
   * @returns {Promise<HTMLElement>} The updated app frame
   * @protected
   * @override
   */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options)
    this.#reorganizeHeaderElements(frame)
    return frame
  }

  /**
   * Given the window's frame, mutate its header to make it easier to style.
   * @param {HTMLElement} frame - The window frame
   */
  async #reorganizeHeaderElements(frame) {
    const header = frame.querySelector(".window-header")
    const title = frame.querySelector(".window-title")

    const buttons = header.querySelectorAll("button")

    const buttonContainer = document.createElement("div")
    buttonContainer.classList.add("window-buttons")

    const titleAreaContainer = document.createElement("div")
    titleAreaContainer.classList.add("window-header__content")

    const actorArt = document.createElement("img")
    actorArt.src = this.document.img

    buttons.forEach((b) => buttonContainer.appendChild(b))

    titleAreaContainer.appendChild(actorArt)
    titleAreaContainer.appendChild(title)

    header.appendChild(buttonContainer)

    // if (this.document.system.actions) {
    //   const actionMenu = document.createElement("menu")
    //   actionMenu.classList.add("window-header__actions")
    //   this.document.system.actions.forEach((a) => {
    //     const actionArt = document.createElement("img")
    //     actionArt.src = a.img
    //     const listItem = document.createElement("li")
    //     listItem.dataset.actionId = a.id
    //     listItem.dataset.tooltip = a.name

    //     listItem.appendChild(actionArt)
    //     actionMenu.appendChild(listItem)
    //   })
    //   titleAreaContainer.appendChild(actionMenu)
    // }

    if (this.document.system.banner) {
      const banner = document.createElement("img")
      banner.src = this.document.system.banner
      header.appendChild(banner)
    }

    header.appendChild(titleAreaContainer)
  }

  static async _onAddAction() {
    await this.document.createAction()
  }

  static _onEditAction(event) {
    const { actionId } = event.target.closest("[data-action-id]").dataset
    const editor = new BAGSActionEditor(this.document, actionId)
    editor.render(true)
  }

  static async _onDeleteAction(event) {
    await this.document.deleteAction(
      event.target.closest("[data-action-id]").dataset.actionId,
    )
  }

  /**
   * Given an event, prepare to, then resolve, the related action.
   * @param {string} actionId - The ID of the action to resolve on this document
   * @param event
   */
  static async _onPerformAction(event) {
    const { actionId } = event.target.closest("[data-action-id]").dataset

    const action = this.document.system.actions.find((a) => a.id === actionId)
    await this.document.resolveAction(action)
  }

  tabGroups = {
    sheet: "summary",
  }

  /**
   * Prepare an array of form header tabs.
   * @todo It'd be cool to be able to use Foundry's ApplicationTab type here.
   * @returns {unknown[]} the list of tabs for this application
   */
  #getTabs() {
    const tabs = this.constructor.TABS
    // for (const v of Object.values(tabs)) {
    //   v.active = this.tabGroups[v.group] === v.id
    //   v.cssClass = v.active ? "active" : ""
    // }

    return tabs.map((t) => {
      const active = this.tabGroups[t.group] === t.id

      return {
        ...t,
        active,
        cssClass: active ? "active" : "",
      }
    })
  }
}
