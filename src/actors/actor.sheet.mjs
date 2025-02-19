/* eslint-disable max-lines */
/**
 * @file The base class for actor sheets in this system.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import animatedSheetError from "../utils/animated-sheet-error.mjs"
import sortDocuments from "../utils/sort-documents.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

const { HandlebarsApplicationMixin } = foundry.applications.api

export default class BAGSActorSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
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
          }),
        }
      },
      {},
    )
  }

  // === App config ============================================================

  get title() {
    return this.actor.name
  }

  static get DEFAULT_OPTIONS() {
    return {
      classes: [
        "application--bags",
        "application--sheet",
        "application--actor-sheet",
      ],
      tag: "form",
      window: {
        frame: true,
        positioned: true,
        minimizable: true,
        resizable: true,
        contentTag: "section",
        contentClasses: [],
      },
      form: {
        handler: undefined,
        submitOnChange: true,
      },
      actions: {
        "use-character-action": this.#onCharacterAction,
        "reset-filters": this.resetFilters,
      },
      position: {
        width: 575,
        height: 530,
      },
    }
  }

  // --- Sub apps --------------------------------------------------------------

  static SUB_APPS = {}

  get subApps() {
    return this.#subApps
  }

  #subApps = {}

  // --- Tabs ------------------------------------------------------------------

  tabGroups = {
    sheet: "inventory",
    leftRail: "summary",
  }

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "inventory",
          group: "sheet",
          icon: "fa-solid fa-backpack",
          label: "Inventory",
        },
        {
          id: "spells",
          group: "sheet",
          icon: "fa-solid fa-sparkle",
          label: "Spellcasting",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-scroll-old",
          label: "Character Identity",
        },
      ],
      initial: "summary",
      labelPrefix: "BAGS.Actors.Character.Tabs",
    },
  }

  // --- App parts -------------------------------------------------------------

  static TEMPLATE_ROOT = `${SYSTEM_TEMPLATE_PATH}/character`

  static get PARTS() {
    return {
      abilities: {
        template: `${this.TEMPLATE_ROOT}/content.hbs`,
      },
      spells: {
        template: `${this.TEMPLATE_ROOT}/spells.hbs`,
      },
      inventory: {
        template: `${this.TEMPLATE_ROOT}/inventory.hbs`,
      },
    }
  }

  // === Rendering =============================================================

  /**
   * @todo Implement this!
   */
  getFieldModificationState(key, forcedDirection) {
    const modifications =
      this.document.appliedEffectsByAffectedKey().get(key) ?? []
    if (!modifications.length) return null

    // Get the direction where positive is "better"
    // const direction =
    // this.constructor.FIELD_IMPROVEMENT_DIRECTION[key] ?? 'ascending'
    const direction = forcedDirection || "ascending"

    // Calculate total numerical modification
    const totalMod = modifications.reduce((sum, mod) => {
      const value = Number(mod.modification.value) || 0

      // Handle different modification modes
      switch (mod.modification.mode) {
        case 2: // ADD
          return sum + value
        case 1: // MULTIPLY
          return sum * value
        // Add other cases as needed
        default:
          return sum
      }
    }, 0)

    if (totalMod === 0) return null

    if (direction === "ascending") return totalMod > 0 ? "improved" : "impaired"
    return totalMod < 0 ? "improved" : "impaired"
  }

  /**
   * Provide context to the templating engine.
   * @override
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)

    if (!this.document.items.documentsByType.spell.length)
      delete context?.tabs?.spells

    return {
      ...context,
      formattedSystem: await this._prepareFormattedFields(),
    }
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    super._preparePartContext(partId, context, options)

    context.tabs = this._prepareTabs(
      partId !== "left-rail" ? "sheet" : "leftRail",
    )

    switch (partId) {
      case "summary":
        break
      case "abilities":
        context.abilities = this.actor.items.documentsByType.ability
        break
      case "spells":
        context.abilities = this.actor.items.documentsByType.spell
        break
      case "inventory":
        context.weapons =
          this.actor.items.documentsByType.weapon.sort(sortDocuments)
        context.armor =
          this.actor.items.documentsByType.armor.sort(sortDocuments)
        context.items =
          this.actor.items.documentsByType.item.sort(sortDocuments)
        context.inventory = [
          ...context.weapons,
          ...context.armor,
          ...context.items,
        ]
          .filter(this.inventoryFilterMode.predicate)
          .sort(
            sortDocuments(
              this.inventorySortMode.key,
              this.inventorySortMode.isDescending,
            ),
          )
        context.sortMode = this.inventorySortMode
        context.filterMode = this.inventoryFilterMode
        break
      case "description":
        break
      default:
        break
    }

    context.tab = context.tabs[partId] || null
    return context
  }

  async _prepareFormattedFields() {
    return null
  }

  _replaceHTML(...args) {
    super._replaceHTML(...args)
    if (
      this.element.querySelector(".window-header__banner") &&
      this.document.system.banner
    )
      this.element.querySelector(".window-header__banner").src =
        this.document.system.banner
    if (this.element.querySelector(".window-header__content > img"))
      this.element.querySelector(".window-header__content > img").src =
        this.document.img
  }

  /**
   * Render the outer framing HTMLElement which wraps the inner HTML of
   * the Application.
   *
   * This override modifies the default frame by adding the following:
   * - an alternative header: the existing elements in the header are moved
   *   around into a format tha makes more sense for our design.
   * - tab navigation: if the sheet has tabs, to enforce consistency.
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

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options)

    const { ContextMenu } = foundry.applications.ui

    ContextMenu.create(this, this.element, ".tab--inventory uft-item-tile", {
      hookName: "InventoryContext",
      fixed: true,
      jQuery: false,
    })

    ContextMenu.create(this, this.element, ".tab--inventory button.filter", {
      hookName: "InventoryFilter",
      jQuery: false,
      fixed: true,
      eventName: "click",
    })

    ContextMenu.create(this, this.element, ".tab--inventory button.sort", {
      hookName: "InventorySort",
      jQuery: false,
      fixed: true,
      eventName: "click",
    })
  }

  static INVENTORY_SORT_MODES = {
    DEFAULT: { icon: "fa fa-arrow-up-arrow-down", id: 0, label: "Default" },
    NAME_ASCENDING: {
      icon: "fa fa-arrow-down-a-z",
      id: 1,
      key: "name",
      isDescending: false,
      label: "Name (ascending)",
    },
    NAME_DESCENDING: {
      icon: "fa fa-arrow-up-z-a",
      id: 2,
      key: "name",
      isDescending: true,
      label: "Name (descending)",
    },
    ENCUMBRANCE_ASCENDING: {
      icon: "fa fa-arrow-up-big-small",
      id: 3,
      key: "system.weight",
      isDescending: false,
      label: "Encumbrance (ascending)",
    },
    ENCUMBRANCE_DESCENDING: {
      icon: "fa fa-arrow-down-big-small",
      id: 4,
      key: "system.weight",
      isDescending: true,
      label: "Encumbrance (descending)",
    },
    VALUE_ASCENDING: {
      icon: "fa fa-arrow-up-1-9",
      id: 5,
      key: "system.cost",
      isDescending: false,
      label: "Coin value (ascending)",
    },
    VALUE_DESCENDING: {
      icon: "fa fa-arrow-down-9-1",
      id: 6,
      key: "system.cost",
      isDescending: true,
      label: "Coin value (descending)",
    },
  }

  static INVENTORY_FILTER_MODES = {
    DEFAULT: {
      icon: "fa-regular fa-filter",
      id: 0,
      label: "Default",
      predicate: () => true,
    },
    TYPE_WEAPON: {
      icon: "fa fa-sword",
      id: 1,
      label: "Weapons",
      predicate: (i) => i.type === "weapon",
    },
    TYPE_ARMOR: {
      icon: "fa fa-shield",
      id: 2,
      label: "Armor",
      predicate: (i) => i.type === "armor",
    },
    TYPE_MISCELLANEOUS: {
      icon: "fa fa-suitcase",
      id: 3,
      label: "Miscellaneous Items",
      predicate: (i) => i.type === "item",
    },
    CONTAINER: {
      icon: "fa fa-sack",
      id: 4,
      label: "Containers",
      predicate: (i) => i.system.container.isContainer,
    },
    TREASURE: {
      icon: "fa fa-coin",
      id: 5,
      label: "Treasure",
      predicate: (i) => i.system.countsAsTreasure,
    },
    WORTH_XP: {
      icon: "fa fa-trophy",
      id: 6,
      label: "Items with unclaimed XP",
      predicate: (i) =>
        i.system.countsAsTreasure && !i.system.hasBeenCountedAsTreasure,
    },
  }

  #inventorySortMode = BAGSActorSheet.INVENTORY_SORT_MODES.DEFAULT

  #inventoryFilterMode = BAGSActorSheet.INVENTORY_FILTER_MODES.DEFAULT

  get inventorySortMode() {
    return this.#inventorySortMode
  }

  get inventoryFilterMode() {
    return this.#inventoryFilterMode
  }

  _getInventorySortOptions() {
    return Object.values(this.constructor.INVENTORY_SORT_MODES).map((f) => ({
      name: f.label,
      icon: `<i class="${f.icon}" role="presentation"></i>`,
      callback: () => {
        this.#inventorySortMode = f
        this.render()
      },
    }))
  }

  _getInventoryFilterOptions() {
    return Object.values(this.constructor.INVENTORY_FILTER_MODES).map((f) => ({
      name: f.label,
      icon: `<i class="${f.icon}" role="presentation"></i>`,
      callback: () => {
        this.#inventoryFilterMode = f
        this.render()
      },
    }))
  }

  static resetFilters() {
    this.#inventorySortMode = BAGSActorSheet.INVENTORY_SORT_MODES.DEFAULT
    this.#inventoryFilterMode = BAGSActorSheet.INVENTORY_FILTER_MODES.DEFAULT
    this.render()
  }

  _getInventoryContextOptions() {
    return [
      {
        name: "Use",
        icon: "<i class='fa fa-bolt' />",
        condition: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          return item.isOwner && item.system.actions.length
        },
        callback: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          item?.deleteDialog()
        },
      },
      {
        name: "View",
        icon: "<i class='fa fa-book-open' />",
        callback: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          item?.deleteDialog()
        },
      },
      {
        name: "Edit",
        icon: "<i class='fa fa-pencil' />",
        condition: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          return item.isOwner
        },
        callback: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          item?.sheet.subApps.itemEditor.render(true)
        },
      },
      {
        name: "Un-identify",
        icon: "<i class='fa fa-eye-slash' />",
        condition: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          return item.system.identification.isIdentified && game.user.isActiveGM
        },
        callback: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          item?.identify()
        },
      },
      {
        name: "Identify",
        icon: "<i class='fa fa-eye' />",
        condition: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          return (
            !item.system.identification.isIdentified && game.user.isActiveGM
          )
        },
        callback: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          item?.identify()
        },
      },
      {
        name: "Equip",
        icon: "<i class='fa fa-hand-fist' />",
        condition: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          return item.isOwner && !item.system.isEquipped
        },
        callback: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          if (item) item.equip()
        },
      },
      {
        name: "Unequip",
        icon: "<i class='fa fa-hand' />",
        condition: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          return item.isOwner && item.system.isEquipped
        },
        callback: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          if (item) item.unequip()
        },
      },
      {
        name: "Delete",
        icon: "<i class='fa fa-trash' />",
        condition: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          return item.isOwner
        },
        callback: (element) => {
          const item = this.document.items.get(element.dataset.itemId)
          item?.deleteDialog()
        },
      },
    ]
  }

  _onRender(context, options) {
    super._onRender(context, options)

    if (options.parts.includes("inventory")) {
      new SearchFilter({
        inputSelector: "search input",
        contentSelector: ".item-grid--inventory",
        callback: (...args) => this._onFilterInventory(...args),
        initial: this.element.querySelector("search input").value,
      }).bind(this.element)
    }
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

    const actorArt = document.createElement("img")
    actorArt.src = this.document.img

    buttons.forEach((b) => buttonContainer.appendChild(b))

    const gripIcon = document.createElement("i")
    gripIcon.classList.value = "fa fa-grip-lines-vertical"

    header.appendChild(gripIcon)
    header.appendChild(title)
    header.appendChild(buttonContainer)
  }

  // --- Tabs ------------------------------------------------------------------

  #addTabsToFrame(frame) {
    if (!this.constructor.TABS.sheet.tabs.length) return
    const hasSpells = !!this.document.items.documentsByType.spell.length
    const tabContainer = document.createElement("nav")
    tabContainer.classList.value = "application__tab-navigation sheet-tabs tabs"
    tabContainer.ariaRole = game.i18n.localize("SHEETS.FormNavLabel")

    this.constructor.TABS.sheet.tabs.forEach((t) => {
      if (t.id === "spells" && !hasSpells) return

      const btn = document.createElement("button")
      btn.dataset.action = "tab"
      btn.dataset.group = t.group
      btn.dataset.tab = t.id
      btn.dataset.tooltip = game.i18n.localize(t.label)
      btn.ariaLabel = game.i18n.localize(t.label)
      if (t.id === this.tabGroups.sheet) btn.classList.add("active")
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

  static async #onCharacterAction(e) {
    const el = e.target.closest("[data-action-id]")
    if (!el) return
    const { actionId } = el.dataset
    const action = this.actor.system.actions.find((a) => a.id === actionId)
    await this.actor.resolveAction(action)
  }

  // === Events ================================================================

  /**
   * A handler for dropping actors onto the sheet.
   * @param {DragEvent} event - The browser event fired when dropping the item
   * @param {unknown} doc - The Foundry Actor to handle
   * @returns {Promise<unknown>} The dropped actor, if associating it works.
   */
  async _onDropActor(event, doc) {
    switch (doc.type) {
      case "character":
        this.#onDropCharacter(doc)
        break
      case "monster":
        this.#onDropMonster(doc)
        break
      case "mount":
        this.#onDropMount(doc)
        break
      default:
        this._onDropActor(doc)
        break
    }
  }

  async #onDropCharacter(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropMonster(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropMount(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropSpell(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropAbility(doc) {
    this.document.createEmbeddedDocuments("Item", [doc])
  }

  async #onDropCharacterClass(doc) {
    if (this.document.type !== "character")
      animatedSheetError(this.element, "Only characters may have classes.")
    if (this.document.itemTypes.class.length)
      animatedSheetError(this.element, "A character may only have one class.")
    else this.document.createEmbeddedDocuments("Item", [doc])
  }

  async #onDropWeapon(doc) {
    this.document.createEmbeddedDocuments("Item", [doc])
  }

  async #onDropArmor(doc) {
    this.document.createEmbeddedDocuments("Item", [doc])
  }

  // TODO: Add onto an existing stack, if one exists.
  async #onDropMiscellaneous(doc) {
    this.document.createEmbeddedDocuments("Item", [doc])
  }

  /**
   * A handler for dropping items onto the sheet.
   * @param {DragEvent} event - The browser event fired when dropping the item
   * @param {unknown} doc - The Foundry Item to handle
   * @todo handle duplicate items on types with quantities
   * @todo handle duplicate items on types that shouldn't have copies
   * @returns {Promise<unknown>} The dropped item, if creating it works.
   */
  async _onDropItem(event, doc) {
    if (!this.actor.isOwner) return false

    // TODO: Handle containers
    if (this.actor.uuid === doc.parent?.uuid)
      return this._onSortItem(event, doc)

    switch (doc.type) {
      case "class":
        return this.#onDropCharacterClass(doc)
      case "spell":
      case "ability":
      case "weapon":
      case "armor":
      case "item":
      default:
        return super._onDropItem(event, doc)
    }
  }

  // === Events ================================================================
  async close() {
    await Promise.all(Object.values(this.subApps).map((a) => a.close()))
    super.close()
  }

  // === Filtering and sorting =================================================

  _onFilterInventory(event, query, rgx, html) {
    // if (!html) return

    const ids = new Set()
    const options = {}

    // Match entries and folders.
    if (query) this._matchSearchItems(rgx, ids, options)

    html
      .querySelectorAll(".item-grid--inventory uft-item-tile")
      .forEach((el) => {
        if (el.hidden) return
        el.classList.toggle("filtered", query && !ids.has(el.dataset.itemId))
      })
  }

  _matchSearchItems(query, entryIds) {
    this.actor.items.contents.forEach((entry) => {
      if (query.test(SearchFilter.cleanQuery(entry.name))) {
        entryIds.add(entry.id)
      }
    })
  }
}
