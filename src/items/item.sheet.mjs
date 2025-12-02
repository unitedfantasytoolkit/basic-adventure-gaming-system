/**
 * @file The base class for Item sheets in this system.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import animatedSheetAttention from "../utils/animated-sheet-attention.mjs"
import animatedSheetError from "../utils/animated-sheet-error.mjs"
import { validateAddToContainer } from "../utils/container-utils.mjs"
import {
  INVENTORY_SORT_MODES,
  INVENTORY_FILTER_MODES,
} from "../config/inventory-modes.mjs"
import sortDocuments from "../utils/sort-documents.mjs"
import { stackAllItems } from "../utils/item-stacking.mjs"

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
      // Active effect management
      "edit-active-effects": this.editActiveEffects,
      // Container controls
      "reset-container-filters": this.resetContainerFilters,
      "empty-container": this.emptyContainer,
      "stack-container-items": this.stackContainerItems,
    },
    // Enable drag-drop for containers
    dragDrop: [
      {
        dragSelector: ".item-grid--container uft-item-tile",
        dropSelector: ".container-contents",
      },
    ],
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

  // --- Container filter/sort state -------------------------------------------

  #containerSortMode = INVENTORY_SORT_MODES.DEFAULT

  #containerFilterMode = INVENTORY_FILTER_MODES.DEFAULT

  get containerSortMode() {
    return this.#containerSortMode
  }

  get containerFilterMode() {
    return this.#containerFilterMode
  }

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
    }
  }

  // === Rendering =============================================================

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    switch (partId) {
      case "summary":
        // Prepare container data if this item is a container
        if (doc.system.container?.isContainer) {
          context.containerData = await this._prepareContainerData()
          context.containerSortMode = this.#containerSortMode
          context.containerFilterMode = this.#containerFilterMode
        }
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

  /**
   * Set up context menus for container filter/sort on first render.
   * @override
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options)

    // Only set up container controls if this item is a container
    if (!this.document.system.container?.isContainer) return

    const { ContextMenu } = foundry.applications.ux

    // Context menu for container filter button
    new ContextMenu(
      this.element,
      ".container-search button.filter",
      this._getContainerFilterOptions(),
      {
        hookName: "ContainerFilter",
        jQuery: false,
        fixed: true,
        eventName: "click",
      },
    )

    // Context menu for container sort button
    new ContextMenu(
      this.element,
      ".container-search button.sort",
      this._getContainerSortOptions(),
      {
        hookName: "ContainerSort",
        jQuery: false,
        fixed: true,
        eventName: "click",
      },
    )
  }

  /**
   * Set up drag-drop and search filter after rendering.
   * @override
   */
  async _onRender(context, options) {
    await super._onRender(context, options)

    // Set up drag-drop for container contents
    if (this.document.system.container?.isContainer) {
      const DragDrop = foundry.applications.ux.DragDrop.implementation
      new DragDrop({
        dragSelector: ".item-grid--container uft-item-tile",
        dropSelector: ".container-contents",
        permissions: {
          dragstart: this._canDragStart.bind(this),
          drop: this._canDragDrop.bind(this),
        },
        callbacks: {
          dragstart: this._onDragStart.bind(this),
          drop: this._onDrop.bind(this),
        },
      }).bind(this.element)

      // Set up search filter for container
      const searchInput = this.element.querySelector("[data-container-search]")
      if (searchInput) {
        new foundry.applications.ux.SearchFilter({
          inputSelector: "[data-container-search]",
          contentSelector: ".item-grid--container",
          callback: (...args) => this._onFilterContainer(...args),
          initial: searchInput.value,
        }).bind(this.element)
      }
    }
  }

  async _prepareFormattedFields() {
    return {
      flavorText: await foundry.applications.ux.TextEditor.enrichHTML(
        this.document.system.flavorText,
      ),
      description: await foundry.applications.ux.TextEditor.enrichHTML(
        this.document.system.description,
      ),
    }
  }

  /**
   * Prepare data for container display in the summary tab.
   * Applies filtering and sorting based on current mode.
   * @returns {Promise<object>} Container data including contents and weight
   * @private
   */
  async _prepareContainerData() {
    const doc = this.document
    let contents = doc.system.contents || []

    // Apply filter
    contents = contents.filter(this.#containerFilterMode.predicate)

    // Apply sort
    if (this.#containerSortMode.key) {
      contents = contents.sort(
        sortDocuments(
          this.#containerSortMode.key,
          this.#containerSortMode.isDescending,
        ),
      )
    }

    const currentWeight = doc.system.contentsWeight

    return {
      contents: contents.map((item) => ({
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
      })),
      currentWeight: Math.round(currentWeight),
      maxWeight: doc.system.container.weightMax || 0,
      itemCount: contents.length,
    }
  }

  // === Drag and Drop =========================================================

  /**
   * Define whether a user can begin a drag operation.
   * @param {string} selector - The candidate HTML selector for dragging
   * @returns {boolean} Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    return this.isEditable
  }

  /**
   * Define whether a user can complete a drop operation.
   * @param {string} selector - The candidate HTML selector for the drop target
   * @returns {boolean} Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    return this.isEditable
  }

  /**
   * Handle drag start for items in the container.
   * @param {DragEvent} event - The drag start event
   * @protected
   */
  async _onDragStart(event) {
    const target = event.currentTarget
    if ("link" in event.target.dataset) return

    // Get the item being dragged from the container
    if (target.dataset.itemId) {
      const item = this.document.actor.items.get(target.dataset.itemId)
      if (!item) return

      const dragData = item.toDragData()
      event.dataTransfer.setData("text/plain", JSON.stringify(dragData))
    }
  }

  /**
   * Handle drop events on the item sheet.
   * @override
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event)

    // Only handle item drops if this is a container
    if (data.type === "Item" && this.document.system.container?.isContainer) {
      return this._onDropItem(event, data)
    }

    return super._onDrop(event)
  }

  /**
   * Handle dropping an item onto a container.
   * @param {DragEvent} event - The drop event
   * @param {object} data - The parsed drag data
   * @returns {Promise<Item|void>} The updated container
   * @private
   */
  async _onDropItem(event, data) {
    const droppedItem = await fromUuid(data.uuid)
    if (!droppedItem) return

    try {
      // Validate the add operation (throws on failure)
      validateAddToContainer(droppedItem, this.document)

      // Validation passed - add the item
      const result = await droppedItem.addToContainer(this.document)

      // Only show notification if item was actually added (not already in container)
      if (result) {
        ui.notifications.info(
          game.i18n.format("BAGS.Items.Physical.Container.AddedItem", {
            item: droppedItem.name,
            container: this.document.name,
          }),
        )
      }
    } catch (error) {
      animatedSheetError(this.element, error.message)
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
    const tabs = this.constructor.TABS?.sheet?.tabs
    if (!tabs?.length || tabs.length < 2) return
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

    this.customizeTitleArea(titleAreaContainer)

    // --- Put everything together ---------------------------------------------
    if (this.document.system.banner) {
      header.appendChild(this.#buildHeaderBanner())
    }
    header.appendChild(buttonContainer)
    header.appendChild(titleAreaContainer)
  }

  /**
   * Perform further modifications on the header area.
   * @param {HTMLDivElement} titleBarContainer - The title bar container to
   * tinker with.
   * @abstract
   */
  customizeTitleArea(titleBarContainer) {
    // noop
  }

  /**
   * Build an HTML element to display the available actions in the sheet header.
   * @todo Keeping this around until we're happy with how we've chosen to
   * display items.
   * @returns {HTMLULElement | null} Whatever we plan to render for actions.
   */
  #buildHeaderActionMenu() {
    if (this.document.system.actionList) {
      const actionMenu = document.createElement("menu")
      actionMenu.classList.add("window-header__actions")
      this.document.system.actionList.forEach((a) => {
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
    const action = this.document.system.actionList.find((a) => a.id === actionId)
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

  static editItem() {
    BAGSBaseItemSheet.#useSubApp(this.subApps.itemEditor)
  }

  static editActions() {
    BAGSBaseItemSheet.#useSubApp(this.subApps.actionEditor)
  }

  static editActiveEffects() {
    BAGSBaseItemSheet.#useSubApp(this.subApps.activeEffectEditor)
  }

  // === Container filter/sort =================================================

  static resetContainerFilters() {
    this.#containerSortMode = INVENTORY_SORT_MODES.DEFAULT
    this.#containerFilterMode = INVENTORY_FILTER_MODES.DEFAULT
    this.render()
  }

  static async emptyContainer() {
    const contents = this.document.system.contents || []
    if (!contents.length) return

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: game.i18n.localize(
          "BAGS.Items.Physical.Container.EmptyContainer",
        ),
      },
      content: game.i18n.format(
        "BAGS.Items.Physical.Container.EmptyContainerConfirm",
        {
          count: contents.length,
          container: this.document.name,
        },
      ),
      rejectClose: false,
      modal: true,
    })

    if (!confirmed) return

    // Remove all items from container
    await this.document.update({ "system.container.contains": [] })

    ui.notifications.info(
      game.i18n.format("BAGS.Items.Physical.Container.EmptiedContainer", {
        count: contents.length,
        container: this.document.name,
      }),
    )
  }

  static async stackContainerItems() {
    const items = this.document.system.contents || []

    const count = await stackAllItems(items)

    this.render()

    if (count === 0) {
      ui.notifications.info(
        game.i18n.localize("BAGS.Items.Physical.Container.NoStackableItems"),
      )
    } else {
      ui.notifications.info(
        game.i18n.format("BAGS.Items.Physical.Container.StackedItems", {
          count,
        }),
      )
    }
  }

  _getContainerSortOptions() {
    return Object.values(INVENTORY_SORT_MODES).map((f) => ({
      name: f.label,
      icon: `<i class="${f.icon}" role="presentation"></i>`,
      callback: () => {
        this.#containerSortMode = f
        this.render()
      },
    }))
  }

  _getContainerFilterOptions() {
    return Object.values(INVENTORY_FILTER_MODES).map((f) => ({
      name: f.label,
      icon: `<i class="${f.icon}" role="presentation"></i>`,
      callback: () => {
        this.#containerFilterMode = f
        this.render()
      },
    }))
  }

  _onFilterContainer(event, query, rgx, html) {
    const ids = new Set()

    // Match items in container
    if (query) this._matchContainerSearchItems(rgx, ids)

    html
      .querySelectorAll(".item-grid--container uft-item-tile")
      .forEach((el) => {
        if (el.hidden) return
        el.classList.toggle("filtered", query && !ids.has(el.dataset.itemId))
      })
  }

  _matchContainerSearchItems(query, entryIds) {
    ;(this.document.system.contents || []).forEach((entry) => {
      if (
        query.test(foundry.applications.ux.SearchFilter.cleanQuery(entry.name))
      ) {
        entryIds.add(entry.id)
      }
    })
  }

  static #useSubApp(subApp) {
    if (!subApp) return
    if (subApp.rendered) {
      subApp.bringToFront()
      animatedSheetAttention(subApp.element)
    }
    subApp.render(true)
  }
}
