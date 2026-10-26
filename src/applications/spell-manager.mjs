/**
 * @file An application for managing character spells, including preparation and editing.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSApplication from "./application.mjs"
import animatedSheetError from "../utils/animated-sheet-error.mjs"
import {
  addSpellsToActor,
  castableSpellLevels,
  grantSpellsAtLevel,
  grantsEntireList,
  learnSpell,
} from "../utils/spell-acquisition.mjs"

/**
 * Application for managing a character's spells, including preparation and
 * editing.
 * @class
 * @augments {BAGSApplication}
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
      "grant-spell-level": this.grantSpellLevel,
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

    const padArray = (array, length = 0) => {
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
      grantableLevels: this.#prepareGrantableLevels(),
    }
  }

  /**
   * The "add every spell of level N" offers to show.
   *
   * Only classes that hand over their whole list get these -- a magic-user
   * earns their spellbook one spell at a time -- and only for levels the class
   * can currently cast.
   * @returns {{classId: string, className: string, level: number}[]} The offers
   * @private
   */
  #prepareGrantableLevels() {
    const classes = this.document.items.documentsByType.class || []

    return classes
      .filter((classItem) => grantsEntireList(classItem))
      .flatMap((classItem) =>
        castableSpellLevels(classItem).map((level) => ({
          classId: classItem.id,
          className: classItem.name,
          level,
        })),
      )
  }

  /**
   * Set up drag-drop functionality after rendering
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options)

    const DragDrop = foundry.applications.ux.DragDrop.implementation

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

    // A second, wider drop zone so spells and folders can be brought in from a
    // compendium or the sidebar, not only shuffled between the two lists.
    new DragDrop({
      dropSelector: ".spell-management",
      permissions: {
        drop: this._canDragDrop.bind(this),
      },
      callbacks: {
        dragover: this._onDragOver.bind(this),
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
   * Handle drop event.
   *
   * Two quite different drops land here. Dragging a spell the caster already
   * has between the two lists prepares or unprepares it. Dragging a spell -- or
   * a whole folder of them -- in from a compendium or the sidebar adds them to
   * the caster instead.
   * @param {Event} event - The drop event
   */
  async _onDrop(event) {
    event.preventDefault()

    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"))

      if (data.type === "Folder") return this.#onDropFolder(data)
      if (data.type !== "Item") return undefined

      const item = await fromUuid(data.uuid)
      if (item?.type !== "spell") return undefined

      // A spell the caster doesn't own yet is being brought in from outside
      // rather than moved between lists.
      if (!this.document.items.has(item.id)) return this.#onDropNewSpell(item)

      const dropTarget = event.currentTarget
      if (data.dragSource === dropTarget.dataset.spellListType) return undefined
      if (dropTarget.dataset.spellListType === "prepared")
        await this.prepareSpell(item.id)
      else if (dropTarget.dataset.spellListType === "available")
        await this.unprepareSpell(item.id)

      this.render(true)
      return undefined
    } catch (error) {
      console.error("Error handling drop:", error)
      return undefined
    }
  }

  /**
   * Add a spell dropped in from outside, going through the world's learning
   * rules.
   * @param {Item} spell - The spell being added
   * @returns {Promise<void>} Resolves once the attempt is over
   * @private
   */
  async #onDropNewSpell(spell) {
    const [classItem] = this.document.items.documentsByType.class || []

    const result = await learnSpell(this.document, spell, classItem)

    if (!result.added && result.reason) {
      animatedSheetError(this.element, game.i18n.localize(result.reason))
    }

    this.render(true)
  }

  /**
   * Add every spell in a dropped folder.
   *
   * Bulk adds skip the learning rules on purpose: dropping a folder is a
   * referee handing over a spell list, not a character studying. Spells the
   * caster already has are left alone.
   * @param {object} data - The drag payload
   * @returns {Promise<void>} Resolves once the spells are added
   * @private
   */
  async #onDropFolder(data) {
    const folder = await fromUuid(data.uuid)
    if (folder?.type !== "Item") return

    const spells = folder.contents.filter((item) => item.type === "spell")
    if (!spells.length) return

    const created = await addSpellsToActor(this.document, spells)

    ui.notifications.info(
      game.i18n.format("BAGS.SpellManager.AddedSpells", {
        count: created.length,
        folder: folder.name,
      }),
    )

    this.render(true)
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
   * @param button
   */
  static async editSpell(event, button) {
    const { itemId } = button.closest("[data-item-id]").dataset
    const item = this.document.items.get(itemId)
    item?.sheet?.render(true)
  }

  /**
   * Give the caster every spell their class list offers at one level.
   * @param {Event} event - The triggering event
   * @param {HTMLElement} button - The button that was clicked
   */
  static async grantSpellLevel(event, button) {
    const target = button || event.target.closest("[data-level]")
    const { classId, level } = target.dataset

    const classItem = this.document.items.get(classId)
    if (!classItem) return

    const created = await grantSpellsAtLevel(
      this.document,
      classItem,
      Number(level),
    )

    if (!created.length) {
      ui.notifications.info(
        game.i18n.localize("BAGS.SpellManager.NoNewSpellsAtLevel"),
      )
    } else {
      ui.notifications.info(
        game.i18n.format("BAGS.SpellManager.GrantedSpells", {
          count: created.length,
          level,
        }),
      )
    }

    this.render(true)
  }

  /**
   * Delete a spell from the character
   * @param {Event} event - The triggering event
   * @param button
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
