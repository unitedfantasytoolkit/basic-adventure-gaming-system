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

  static get DEFAULT_OPTIONS() {
    const controls = this.HEADER_CONTROLS
    // if (this.DEFAULT_OPTIONS.window)
    // controls.concat(this.DEFAULT_OPTIONS.window.controls)

    const options = foundry.utils.mergeObject(
      foundry.applications.sheets.ItemSheetV2.DEFAULT_OPTIONS,
      {
        id: "{id}",
        classes: [
          "application--bags",
          "application--sheet",
          "application--item-sheet",
          "application--hide-title",
          // `application--${this.DOCUMENT_TYPE}-sheet`,
          ...this.CSS_CLASSES_WINDOW,
        ],
        controls,
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
      },
    )

    return options
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
      header: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/header.hbs`,
      },
      ...this.TAB_PARTS,
      "tab-navigation": {
        template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
      },
    }
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

  _onRender(options) {
    super._onRender(options)
    this.element
      ?.querySelector(".window-content__header")
      ?.addEventListener("pointerdown", this.delegateDrag.bind(this))
  }

  delegateDrag(event) {
    event.preventDefault()
    this.window.header.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancellable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
      }),
    )
  }

  _onClickAction(event, target) {
    const { action } = target.dataset

    if (!action) return

    switch (action) {
      default:
        super._onClickAction(event, target)
        break
    }
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
    // const resolver = new ActionResolver(
    //   action,
    //   this.document,
    //   this.document.parent,
    //   game.user.targets,
    // )
    // const resolved = await resolver.resolve()
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
