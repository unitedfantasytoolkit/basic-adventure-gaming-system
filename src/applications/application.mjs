/**
 * @file The base class for applications in this system.
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

export default class BAGSApplication extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor(options = {}) {
    super(options)

    this.document = options?.document

    this.#subApps = this.constructor.SUB_APPS.reduce(
      (obj, App) => ({
        ...obj,
        [App.constructor.name]: new App(this.document),
      }),
      {},
    )
  }

  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--bags", "application--sheet"],
    tag: "form",
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

  // --- Sub apps --------------------------------------------------------------

  static SUB_APPS = []

  get subApps() {
    return this.#subApps
  }

  #subApps = {}

  // --- Tabs ------------------------------------------------------------------

  static TABS = []

  // --- App parts -------------------------------------------------------------
  static PARTS = {}

  // === Rendering =============================================================

  /** @override */
  async _prepareContext(_options) {
    const context = await super._prepareContext()
    const doc = this.document
    return {
      ...context,
      document: doc,
      source: doc?.toObject(),
      fields: doc?.schema.fields,
      systemFields: doc?.system.schema.fields,
      formattedSystem: await this._prepareFormattedFields(),
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    super._preparePartContext(partId, context)
    context.tab = context.tabs[partId] || null
    return context
  }

  async _prepareFormattedFields() {
    return null
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

    // --- The wrapper for the non-interactive header elements. ----------------
    const titleAreaContainer = document.createElement("div")
    titleAreaContainer.classList.add("window-header__content")
    titleAreaContainer.appendChild(titleAndTagsContainer)

    // --- Put everything together ---------------------------------------------
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

  _replaceHTML(...args) {
    super._replaceHTML(...args)
    this.element.querySelector(".window-title").textContent = this.title
    if (this.element.querySelector(".window-header__content > img"))
      this.element.querySelector(".window-header__content > img").src =
        this.document.img
  }

  // --- Tabs ------------------------------------------------------------------

  #addTabsToFrame(frame) {
    const tabs = this.constructor.TABS?.sheet?.tabs
    if (!tabs?.length) return
    const tabContainer = document.createElement("nav")
    tabContainer.classList.value = "application__tab-navigation sheet-tabs tabs"
    tabContainer.ariaRole = game.i18n.localize("SHEETS.FormNavLabel")

    tabs.forEach((t) => {
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
  // --- Header/Title manipulation ---------------------------------------------

  // === Action management =====================================================

  // === Events ================================================================

  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
  }

  async close() {
    await Promise.all(Object.values(this.subApps).map((a) => a.close()))
    super.close()
  }
}
