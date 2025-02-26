/**
 * @file An application for managing character spells, including preparation and editing.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSApplication from "./application.mjs"

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
      "prepare-spell": this.prepareSpell,
      "unprepare-spell": this.unprepareSpell,
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

    // Get all spells available to the character
    const availableSpells = this.document.items.filter(
      (item) => item.type === "spell",
    )

    // Get prepared spells
    const preparedSpells = this.document.system.preparedSpells || []

    // Group spells by level
    const spellsByLevel = availableSpells.reduce((acc, spell) => {
      const level = spell.system.level
      if (!acc[level]) acc[level] = []
      acc[level].push(spell)
      return acc
    }, {})

    return {
      ...context,
      availableSpells,
      preparedSpells,
      spellsByLevel,
      isPrepared: (id) => preparedSpells.includes(id),
    }
  }

  /**
   * Set up drag-drop functionality after rendering
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options)

    new DragDrop({
      dragSelector: ".directory-item",
      dropSelector: ".directory-list",
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
    const itemId = event.currentTarget.dataset.itemId
    const item = this.document.items.get(itemId)

    if (!item) return

    // Set drag data
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "Item",
        uuid: item.uuid,
        id: item.id,
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

      if (dropTarget.classList.contains("prepared-spells")) {
        await this.prepareSpell(item.id)
      } else if (dropTarget.classList.contains("available-spells")) {
        await this.unprepareSpell(item.id)
      }

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
  static async editSpell(event) {
    event.preventDefault()

    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId
    const item = this.document.items.get(itemId)

    if (item) {
      item.sheet.render(true)
    }
  }

  /**
   * Delete a spell from the character
   * @param {Event} event - The triggering event
   */
  static async deleteSpell(event) {
    event.preventDefault()

    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId

    const confirmDelete = await Dialog.confirm({
      title: game.i18n.localize("BAGS.SpellManager.DeleteSpellTitle"),
      content: game.i18n.localize("BAGS.SpellManager.DeleteSpellContent"),
      yes: () => this.document.deleteEmbeddedDocuments("Item", [itemId]),
      no: () => {},
      defaultYes: false,
    })

    if (confirmDelete) {
      this.render(true)
    }
  }

  /**
   * Prepare a spell for casting
   * @param {string} spellId - The ID of the spell to prepare
   */
  static async prepareSpell(spellId) {
    const preparedSpells = [...this.document.system.preparedSpells]

    if (!preparedSpells.includes(spellId)) {
      preparedSpells.push(spellId)
      await this.document.update({ "system.preparedSpells": preparedSpells })
    }

    this.render(true)
  }

  /**
   * Unprepare a previously prepared spell
   * @param {string} spellId - The ID of the spell to unprepare
   */
  static async unprepareSpell(spellId) {
    const preparedSpells = this.document.system.preparedSpells.filter(
      (id) => id !== spellId,
    )
    await this.document.update({ "system.preparedSpells": preparedSpells })
    this.render(true)
  }
}
