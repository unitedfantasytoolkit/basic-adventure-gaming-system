/**
 * @file The base class for Item sheets in this system.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import animatedSheetAttention from "../utils/animated-sheet-attention.mjs"

const { HandlebarsApplicationMixin } = foundry.applications.api

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

/**
 * @todo Should items be able to render smaller initially if they don't have
 * much content to display?
 */
export default class BAGSBaseItemSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
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
            parent: this,
          }),
        }
      },
      {},
    )
  }

  // === App config ============================================================

  get title() {
    return this.document.name
  }

  static DEFAULT_OPTIONS = {
    id: "{id}",
    classes: [
      "application--bags",
      "application--sheet",
      "application--item-sheet",
    ],
    window: {
      frame: true,
      positioned: true,
      minimizable: true,
      resizable: true,
      contentTag: "section",
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
    actions: {
      // Item management
      "edit-item": this.editItem,
      // Action management
      "edit-actions": this.editActions,
      "perform-action": this._onPerformAction,
      // Active Effect management
      "add-effect": this.addEffect,
      "edit-effect": this.editEffect,
      "toggle-effect": this.toggleEffect,
      "delete-effect": this.deleteEffect,
    },
    position: {
      width: 490,
      height: 520,
    },
  }

  // --- Sub apps --------------------------------------------------------------
  static SUB_APPS = {}

  get subApps() {
    return this.#subApps
  }

  #subApps = {}

  // --- Tabs ------------------------------------------------------------------

  /**
   * Default tabs that *all* actor sheets should have.
   * @type {SheetNavTab[]}
   */
  static TABS = {
    sheet: {
      tabs: [
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
      ],
      initial: "summary",
      labelPrefix: "BAGS.Actors.Character.Tabs",
    },
  }

  tabGroups = {
    sheet: "summary",
  }

  // --- App parts -------------------------------------------------------------

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/${this.DOCUMENT_TYPE}`
  }

  static TAB_PARTS = {}

  static get PARTS() {
    return {
      summary: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/summary.hbs`,
        scrollable: [".scrollable"],
      },
      ...this.TAB_PARTS,
      "active-effects": {
        template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-effects.hbs`,
      },
    }
  }

  // === Rendering =============================================================

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    switch (partId) {
      case "summary":
        break
      case "effects":
        break
      case "tab-navigation":
        break
      default:
        break
    }
    context.tab = context.tabs[partId] || null
    return context
  }

  /**
   * Provide context to the templating engine.
   * @todo Change `item` to `document`
   * @override
   */
  async _prepareContext() {
    const context = await super._prepareContext()

    const doc = this.document

    return {
      ...context,
      item: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      systemFields: doc.system.schema.fields,
      formattedSystem: await this._prepareFormattedFields(),
    }
  }

  async _prepareFormattedFields() {
    return {
      flavorText: await TextEditor.enrichHTML(this.document.system.flavorText),
      description: await TextEditor.enrichHTML(
        this.document.system.description,
      ),
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
    this.#addTabsToFrame(frame)
    return frame
  }

  // --- Tabs ------------------------------------------------------------------

  #addTabsToFrame(frame) {
    if (!this.constructor.TABS.sheet.tabs.length) return
    const tabContainer = document.createElement("nav")
    tabContainer.classList.value = "application__tab-navigation sheet-tabs tabs"
    tabContainer.ariaRole = game.i18n.localize("SHEETS.FormNavLabel")

    this.constructor.TABS.sheet.tabs.forEach((t) => {
      const btn = document.createElement("button")
      btn.dataset.action = "tab"
      btn.dataset.group = t.group
      btn.dataset.tab = t.id
      btn.dataset.tooltip = game.i18n.localize(t.label)
      btn.ariaLabel = game.i18n.localize(t.label)
      if (t.disabled) btn.disabled = true

      const icon = document.createElement("i")
      icon.classList.value = t.icon

      btn.appendChild(icon)
      tabContainer.appendChild(btn)
    })

    frame.appendChild(tabContainer)
  }

  /**
   * Change the active tab within a tab group in this Application instance.
   * @param {string} tab - The name of the tab which should become active
   * @param {string} group - The name of the tab group which defines the set
   * of tabs
   * @param {object} [options] - Additional options which affect tab navigation
   * @param {Event} [options.event] - An interaction event which caused the
   * tab change, if any
   * @param {HTMLElement} [options.navElement] - An explicit navigation element
   * being modified
   * @param {boolean} [options.force=false] - Force changing the tab even if
   * the new tab is already active
   * @param {boolean} [options.updatePosition=true] - Update application
   * position after changing the tab?
   * @override
   */
  changeTab(
    tab,
    group,
    // eslint-disable-next-line no-unused-vars
    { event, navElement, force = false, updatePosition = true } = {},
  ) {
    if (!tab || !group)
      throw new Error("You must pass both the tab and tab group identifier")
    if (this.tabGroups[group] === tab && !force) return // No change necessary
    const tabElement = this.element.querySelector(
      `.tabs [data-group="${group}"][data-tab="${tab}"]`,
    )
    if (!tabElement)
      throw new Error(
        `No matching tab element found for group "${group}" and tab "${tab}"`,
      )

    this.element
      .querySelectorAll(`.tabs [data-group="${group}"]`)
      .forEach((t) => {
        t.classList.toggle("active", t.dataset.tab === tab)
        if (t instanceof HTMLButtonElement)
          // eslint-disable-next-line no-param-reassign
          t.ariaPressed = `${t.dataset.tab === tab}`
      })

    this.element
      .querySelectorAll(`.tab[data-group="${group}"]`)
      .forEach((section) => {
        section.classList.toggle("active", section.dataset.tab === tab)
      })

    this.tabGroups[group] = tab

    // Update automatic width or height
    if (!updatePosition) return
    const positionUpdate = {}
    if (this.options.position.width === "auto") positionUpdate.width = "auto"
    if (this.options.position.height === "auto") positionUpdate.height = "auto"
    if (!foundry.utils.isEmpty(positionUpdate)) this.setPosition(positionUpdate)
  }

  _replaceHTML(...args) {
    super._replaceHTML(...args)
    this.element.querySelector(".window-title").textContent = this.title
    if (
      this.document.system.banner &&
      this.element.querySelector(".window-header__banner")
    )
      this.element.querySelector(".window-header__banner").src =
        this.document.system.banner
    this.element.querySelector(".window-header__content > img").src =
      this.document.img
  }

  // --- Header/Title manipulation ---------------------------------------------

  /**
   * Given the window's frame, mutate its header to make it easier to style.
   * @param {HTMLElement} frame - The window frame
   */
  #reorganizeHeaderElements(frame) {
    // --- Get the useful elements from the existing frame ---------------------
    const header = frame.querySelector(".window-header")
    const title = frame.querySelector(".window-title")
    const buttons = header.querySelectorAll("button")

    // --- The button container, where we'll put the app controls. -------------
    const buttonContainer = document.createElement("div")
    buttonContainer.classList.add("window-buttons")
    buttons.forEach((b) => buttonContainer.appendChild(b))

    // --- The wrapper for title and tags. ------------------------------------
    const titleAndTagsContainer = document.createElement("div")
    titleAndTagsContainer.classList.add("window-header__text")
    titleAndTagsContainer.appendChild(title)
    if (this.document.system.tags?.length) {
      titleAndTagsContainer.appendChild(this.#buildHeaderTagList())
    }

    // --- The item's icon. ----------------------------------------------------
    const documentArt = document.createElement("img")
    documentArt.src = this.document.img

    // --- The wrapper for the non-interactive header elements. ----------------
    const titleAreaContainer = document.createElement("div")
    titleAreaContainer.classList.add("window-header__content")
    titleAreaContainer.appendChild(documentArt)
    titleAreaContainer.appendChild(titleAndTagsContainer)

    // --- Put everything together ---------------------------------------------
    if (this.document.system.banner) {
      header.appendChild(this.#buildHeaderBanner())
    }
    header.appendChild(buttonContainer)
    header.appendChild(titleAreaContainer)
  }

  /**
   * Build an HTML element to display the available actions in the sheet header.
   * @todo Keeping this around until we're happy with how we've chosen to
   * display items.
   * @returns {HTMLULElement | null} Whatever we plan to render for actions.
   */
  #buildHeaderActionMenu() {
    if (this.document.system.actions) {
      const actionMenu = document.createElement("menu")
      actionMenu.classList.add("window-header__actions")
      this.document.system.actions.forEach((a) => {
        const actionArt = document.createElement("img")
        actionArt.src = a.img
        const listItem = document.createElement("li")
        listItem.dataset.actionId = a.id
        listItem.dataset.tooltip = a.name

        listItem.appendChild(actionArt)
        actionMenu.appendChild(listItem)
      })
      return actionMenu
    }
    return null
  }

  #buildHeaderBanner() {
    const banner = document.createElement("img")
    banner.src = this.document.system.banner
    banner.classList.add("window-header__banner")
    return banner
  }

  #buildHeaderTagList() {
    const list = document.createElement("ul")
    this.document.system.tags.forEach((t) => {
      const listItem = document.createElement("li")
      list.appendChild(listItem)
    })
    return list
  }

  // === Action management =====================================================

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

  // === Events ================================================================

  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
  }

  async close() {
    await Promise.all(Object.values(this.subApps).map((a) => a.close()))
    super.close()
  }

  static async addEffect() {
    await this.document.createEmbeddedDocuments("ActiveEffect", [
      this.document.effects.createDocument({
        name: game.i18n.localize("BAGS.ActiveEffects.DefaultName"),
        img: "icons/svg/aura.svg",
      }),
    ])
  }

  static async editEffect(e) {
    const { effectId } = e.target.closest("[data-effect-id]").dataset
    this.document.effects.get(effectId).sheet.render(true)
  }

  static async toggleEffect(e) {
    const { effectId } = e.target.closest("[data-effect-id]").dataset
    const effect = this.document.effects.get(effectId)
    effect.update({ disabled: !effect.disabled })
  }

  static async deleteEffect(e) {
    const { effectId } = e.target.closest("[data-effect-id]").dataset
    this.document.effects.get(effectId).deleteDialog()
  }

  static editItem() {
    const subApp = this.subApps.itemEditor
    if (!subApp) return
    if (subApp.rendered) {
      subApp.bringToFront()
      animatedSheetAttention(subApp.element)
    }
    subApp.render(true)
  }

  static editActions() {
    const subApp = this.subApps.actionEditor
    if (!subApp) return
    if (subApp.rendered) {
      subApp.bringToFront()
      animatedSheetAttention(subApp.element)
    }
    subApp.render(true)
  }
}
