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
  static INVENTORY_SORT_MODES = {
    NAME_ASCENDING: 0,
    NAME_DESCENDING: 1,
    ENCUMBRANCE_DESCENDING: 2,
    ENCUMBRANCE_ASCENDING: 3,
    VALUE_DESCENDING: 4,
    VALUE_ASCENDING: 5,
  }

  #inventorySortMode = BAGSActorSheet.INVENTORY_SORT_MODES.NAME_ASCENDING

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
    sheet: "summary",
  }

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
          id: "abilities",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "Abilities",
          cssClass: "tab--advancement",
        },
        {
          id: "inventory",
          group: "sheet",
          icon: "fa-solid fa-backpack",
          label: "Inventory",
          cssClass: "tab--effects",
        },
        {
          id: "spells",
          group: "sheet",
          icon: "fa-solid fa-sparkle",
          label: "Spell List",
          cssClass: "tab--effects",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-scroll-old",
          label: "Character Identity",
          cssClass: "tab--effects",
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
   * Provide context to the templating engine.
   * @override
   */
  async _prepareContext() {
    const context = await super._prepareContext()
    if (!this.actor.items.documentsByType.spell.length)
      delete context.tabs.spells

    const doc = this.document
    return {
      ...context,
      actor: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      formattedSystem: await this._prepareFormattedFields(),
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document

    const encumbranceSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ENCUMBRANCE,
      )

    switch (partId) {
      // case "left-rail":
      //   context.classes = doc.itemTypes.class.map((cls) => ({
      //     ...cls,
      //     xpBar: {
      //       current: cls.system.xp,
      //       max: cls.system.xpTable[cls.system.level - 1].value,
      //     },
      //   }))
      //   context.hp = doc.system.hp
      //   context.savingThrowLocaleStrings =
      //     CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      //       CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
      //     )?.savingThrows
      //   context.usesDescendingAC =
      //     CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      //       CONFIG.BAGS.SystemRegistry.categories.COMBAT,
      //     )?.descending

      //   context.encumbranceMeter = encumbranceSettings.encumbranceMeter(
      //     doc.system,
      //   )
      //   break
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
        ].sort(sortDocuments())
        context.sortMode = this.#inventorySortMode
        break
      case "description":
        break
      default:
        break
    }

    context.tab = context.tabs[partId] || null

    // context.tab = this.#getTabs()[partId]
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

  _onRender(context, options) {
    super._onRender(context, options)

    if (options.parts.includes("inventory")) {
      new SearchFilter({
        inputSelector: "search input",
        contentSelector: ".character-sheet-inventory .item-grid",
        callback: this._onFilterInventory.bind(this),
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

    header.appendChild(title)
    header.appendChild(actorArt)
    header.appendChild(buttonContainer)
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
