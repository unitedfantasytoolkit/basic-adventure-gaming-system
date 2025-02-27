/**
 * @file An application for managing character spells, including preparation and editing.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSApplication from "./application.mjs"
import animatedSheetError from "../utils/animated-sheet-error.mjs"

/**
 * Application for managing a character's spells, including preparation and editing.
 * @class
 * @extends {BAGSApplication}
 */
export default class SpellManager extends BAGSApplication {
  static DEFAULT_OPTIONS = {
    classes: ["application--spell-manager"],
    position: {
      width: 680,
      height: 520,
    },
    actions: {
      "create-spell": this.createSpell,
      "edit-spell": this.editSpell,
      "delete-spell": this.deleteSpell,
    },
    form: {
      handler: null,
    },
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/spells`
  }

  static PARTS = {
    preparation: {
      template: `${this.TEMPLATE_ROOT}/preparation.hbs`,
      scrollable: [".scrollable"],
    },
    management: {
      template: `${this.TEMPLATE_ROOT}/management.hbs`,
      scrollable: [".scrollable"],
    },
  }

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "preparation",
          group: "sheet",
          icon: "fa-solid fa-book-open",
          label: "BAGS.SpellManager.Tabs.Preparation",
        },
        {
          id: "management",
          group: "sheet",
          icon: "fa-solid fa-list",
          label: "BAGS.SpellManager.Tabs.Management",
        },
      ],
      initial: "preparation",
    },
  }

  get title() {
    return `${game.i18n.localize("BAGS.SpellManager.ManageSpells")}: ${this.document.name}`
  }

  // === Rendering =============================================================

  /**
   * Prepare context data for rendering templates
   * @override
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)

    const padArray = (array, length) => {
      const arr = Array.isArray(array) ? array : []
      if (arr.length >= length) return arr.slice()
      return [...arr, ...Array(length - arr.length).fill(null)]
    }

    const maxSlots = this.document.system.spellSlots || []

    const availableSpells = [
      ...(this.document.system.availableSpellsByLevel.values() || []),
    ]

    // const preparedSpells = [
    //   ...(this.document.system.preparedSpellsByLevel.values() || []),
    // ].map((level, index) => padArray(level || [], maxSlots[index]))

    const preparedSpells = Array(maxSlots)
      .fill(null)
      .map((_, i) =>
        padArray(
          this.document.system.preparedSpellsByLevel.get(i + 1) || [],
          maxSlots[i],
        ),
      )

    return {
      ...context,
      availableSpells,
      preparedSpells,
      maxSlots,
      sortMode: this.inventorySortMode,
      filterMode: this.inventoryFilterMode,
    }
  }

  /**
   * Set up drag-drop functionality after rendering
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options)

    new DragDrop({
      dragSelector: ".spell-list__item",
      dropSelector: ".spell-list",
      permissions: {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      },
      callbacks: {
        dragover: this._onDragOver.bind(this),
        dragstart: this._onDragStart.bind(this),
        drop: this._onDrop.bind(this),
      },
    }).bind(this.element)

    // new SearchFilter({
    //   inputSelector: "search input",
    //   contentSelector: ".item-grid--inventory",
    //   callback: (...args) => this._onFilterInventory(...args),
    //   initial: this.element.querySelector("search input").value,
    // }).bind(this.element)
  }

  // === Drag and Drop Handlers ================================================

  /**
   * Check if an item can be dragged
   * @param {Event} event - The originating drag event
   * @returns {boolean} Whether the item can be dragged
   */
  _canDragStart(event) {
    return this.document.isOwner
  }

  /**
   * Check if an item can be dropped
   * @param {Event} event - The originating drop event
   * @returns {boolean} Whether the item can be dropped
   */
  _canDragDrop(event) {
    return this.document.isOwner
  }

  /**
   * Handle dragover event
   * @param {Event} event - The dragover event
   */
  _onDragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  /**
   * Handle dragstart event
   * @param {Event} event - The dragstart event
   */
  _onDragStart(event) {
    const { itemId } = event.currentTarget.dataset
    const item = this.document.items.get(itemId)

    if (!item) return

    // Set drag data
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        ...item.toDragData(),
        dragSource: event.target.closest("[data-spell-list-type]").dataset
          .spellListType,
      }),
    )
  }

  /**
   * Handle drop event
   * @param {Event} event - The drop event
   */
  async _onDrop(event) {
    event.preventDefault()

    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"))
      if (data.type !== "Item") return
      const item = await fromUuid(data.uuid)
      if (item.type !== "spell") return
      // Handle drop based on the target area
      const dropTarget = event.currentTarget
      if (data.dragSource === dropTarget.dataset.spellListType) return
      if (dropTarget.dataset.spellListType === "prepared")
        await this.prepareSpell(item.id)
      else if (dropTarget.dataset.spellListType === "available")
        await this.unprepareSpell(item.id)

      this.render(true)
    } catch (error) {
      console.error("Error handling drop:", error)
    }
  }

  // === Spell Management Actions ==============================================

  /**
   * Create a new spell for the character
   * @param {Event} event - The triggering event
   */
  static async createSpell(event) {
    event.preventDefault()

    const itemData = {
      name: game.i18n.localize("BAGS.SpellManager.NewSpell"),
      type: "spell",
      img: "icons/svg/book.svg",
    }

    const created = await this.document.createEmbeddedDocuments("Item", [
      itemData,
    ])

    if (created && created.length > 0) {
      const spell = created[0]
      spell.sheet.render(true)
    }

    this.render(true)
  }

  /**
   * Edit an existing spell
   * @param {Event} event - The triggering event
   */
  static async editSpell(event, button) {
    const { itemId } = button.closest("[data-item-id]").dataset
    const item = this.document.items.get(itemId)
    item?.sheet?.render(true)
  }

  /**
   * Delete a spell from the character
   * @param {Event} event - The triggering event
   */
  static async deleteSpell(event, button) {
    const { itemId } = button.closest("[data-item-id]").dataset
    const item = this.document.items.get(itemId)
    await item?.deleteDialog()
    this.render(true)
  }

  /**
   * Prepare a spell for casting
   * @param {string} spellId - The ID of the spell to prepare
   * @todo Block adding the spell when the user's at their spell slot cap.
   */
  async prepareSpell(spellId) {
    try {
      await this.document.prepareSpell(spellId)
      this.render(true)
    } catch (e) {
      animatedSheetError(this.element, e.message)
    }
  }

  /**
   * Unprepare a previously prepared spell
   * @param {string} spellId - The ID of the spell to unprepare
   */
  async unprepareSpell(spellId) {
    await this.document.unprepareSpell(spellId)
    this.render(true)
  }

  // === Sorting and Filtering =================================================

  static SORT_MODES = {
    DEFAULT: {
      icon: "fa fa-arrow-up-arrow-down",
      id: 0,
      label: "BAGS.Actors.Common.Inventory.Sort.Default",
    },
    NAME_ASCENDING: {
      icon: "fa fa-arrow-down-a-z",
      id: 1,
      key: "name",
      isDescending: false,
      label: "BAGS.Actors.Common.Inventory.Sort.NameAscending",
    },
    NAME_DESCENDING: {
      icon: "fa fa-arrow-up-z-a",
      id: 2,
      key: "name",
      isDescending: true,
      label: "BAGS.Actors.Common.Inventory.Sort.NameDescending",
    },
    ENCUMBRANCE_ASCENDING: {
      icon: "fa fa-arrow-up-big-small",
      id: 3,
      key: "system.weight",
      isDescending: false,
      label: "BAGS.Actors.Common.Inventory.Sort.EncumbranceAscending",
    },
    ENCUMBRANCE_DESCENDING: {
      icon: "fa fa-arrow-down-big-small",
      id: 4,
      key: "system.weight",
      isDescending: true,
      label: "BAGS.Actors.Common.Inventory.Sort.EncumbranceDescending",
    },
    VALUE_ASCENDING: {
      icon: "fa fa-arrow-up-1-9",
      id: 5,
      key: "system.cost",
      isDescending: false,
      label: "BAGS.Actors.Common.Inventory.Sort.ValueAscending",
    },
    VALUE_DESCENDING: {
      icon: "fa fa-arrow-down-9-1",
      id: 6,
      key: "system.cost",
      isDescending: true,
      label: "BAGS.Actors.Common.Inventory.Sort.ValueDescending",
    },
  }

  static FILTER_MODES = {
    DEFAULT: {
      icon: "fa-regular fa-filter",
      id: 0,
      label: "BAGS.Actors.Common.Inventory.Filter.Default",
      predicate: () => true,
    },
    TYPE_WEAPON: {
      icon: "fa fa-sword",
      id: 1,
      label: "BAGS.Actors.Common.Inventory.Filter.Weapons",
      predicate: (i) => i.type === "weapon",
    },
    TYPE_ARMOR: {
      icon: "fa fa-shield",
      id: 2,
      label: "BAGS.Actors.Common.Inventory.Filter.Armor",
      predicate: (i) => i.type === "armor",
    },
    TYPE_MISCELLANEOUS: {
      icon: "fa fa-suitcase",
      id: 3,
      label: "BAGS.Actors.Common.Inventory.Filter.Miscellaneous",
      predicate: (i) => i.type === "item",
    },
    CONTAINER: {
      icon: "fa fa-sack",
      id: 4,
      label: "BAGS.Actors.Common.Inventory.Filter.Containers",
      predicate: (i) => i.system.container.isContainer,
    },
    TREASURE: {
      icon: "fa fa-coin",
      id: 5,
      label: "BAGS.Actors.Common.Inventory.Filter.Treasure",
      predicate: (i) => i.system.countsAsTreasure,
    },
    WORTH_XP: {
      icon: "fa fa-trophy",
      id: 6,
      label: "BAGS.Actors.Common.Inventory.Filter.WorthXP",
      predicate: (i) =>
        i.system.countsAsTreasure && !i.system.hasBeenCountedAsTreasure,
    },
  }

  #sortMode = SpellManager.SORT_MODES.DEFAULT

  #filterMode = SpellManager.FILTER_MODES.DEFAULT

  get sortMode() {
    return this.#sortMode
  }

  get filterMode() {
    return this.#filterMode
  }

  _getSortOptions() {
    return Object.values(this.constructor.SORT_MODES).map((f) => ({
      name: f.label,
      icon: `<i class="${f.icon}" role="presentation"></i>`,
      callback: () => {
        this.#sortMode = f
        this.render()
      },
    }))
  }

  _getFilterOptions() {
    return Object.values(this.constructor.FILTER_MODES).map((f) => ({
      name: f.label,
      icon: `<i class="${f.icon}" role="presentation"></i>`,
      callback: () => {
        this.#filterMode = f
        this.render()
      },
    }))
  }

  static resetFilters() {
    this.#sortMode = SpellManager.SORT_MODES.DEFAULT
    this.#filterMode = SpellManager.FILTER_MODES.DEFAULT
    this.render()
  }
}
