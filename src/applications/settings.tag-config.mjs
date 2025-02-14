import BAGSApplication from "./application.mjs"
import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class TagManager extends BAGSApplication {
  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    classes: ["application--tag-manager"],
    actions: {
      "create-tag": this.createTag,
      "edit-tag": this.editTag,
      "delete-tag": this.deleteTag,
    },
    form: {
      handler: null,
    },
    position: {
      width: 600,
      height: 600,
    },
  }

  // --- Tabs ------------------------------------------------------------------

  tabGroups = {
    sheet: "items",
  }

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "item",
          group: "sheet",
          icon: "fa-solid fa-square-question",
          label: "Items",
          cssClass: "tab--items",
        },
        {
          id: "weapon",
          group: "sheet",
          icon: "fa-solid fa-square-question",
          label: "Weapons",
          cssClass: "tab--weapons",
        },
        {
          id: "armor",
          group: "sheet",
          icon: "fa-solid fa-square-question",
          label: "Armor",
          cssClass: "tab--armor",
        },
        {
          id: "spell",
          group: "sheet",
          icon: "fa-solid fa-square-question",
          label: "Spells",
          cssClass: "tab--spells",
        },
        {
          id: "ability",
          group: "sheet",
          icon: "fa-solid fa-square-question",
          label: "Abilities",
          cssClass: "tab--abilities",
        },
        {
          id: "class",
          group: "sheet",
          icon: "fa-solid fa-square-question",
          label: "Character Classes",
          cssClass: "tab--classes",
        },
      ],
      initial: "items",
      labelPrefix: "BAGS.Actors.Character.Tabs",
    },
  }

  // --- App parts -------------------------------------------------------------

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/settings`
  }

  static TAB_PARTS = {
    item: {
      template: `${this.TEMPLATE_ROOT}/tag-manager.editor.hbs`,
      scrollable: [".scrollable"],
    },
    weapon: {
      template: `${this.TEMPLATE_ROOT}/tag-manager.editor.hbs`,
      scrollable: [".scrollable"],
    },
    armor: {
      template: `${this.TEMPLATE_ROOT}/tag-manager.editor.hbs`,
      scrollable: [".scrollable"],
    },
    spell: {
      template: `${this.TEMPLATE_ROOT}/tag-manager.editor.hbs`,
      scrollable: [".scrollable"],
    },
    ability: {
      template: `${this.TEMPLATE_ROOT}/tag-manager.editor.hbs`,
      scrollable: [".scrollable"],
    },
    class: {
      template: `${this.TEMPLATE_ROOT}/tag-manager.editor.hbs`,
      scrollable: [".scrollable"],
    },
  }

  static get PARTS() {
    return {
      ...this.TAB_PARTS,
    }
  }

  get title() {
    return game.i18n.localize("BAGS.Settings.TagManager.Title")
  }

  // === Context Preparation ================================================
  async _prepareContext(_options) {
    const context = await super._prepareContext()
    const tagGroups = game.settings.get(SYSTEM_NAME, "itemTags") || []

    return {
      ...context,
      tagGroups,
    }
  }

  async _preparePartContext(partId, context) {
    super._preparePartContext(partId, context)
    context.tags = context.tagGroups[partId]
    return context
  }

  // === Tag Management ====================================================
  async #createTag(data) {
    const tags = game.settings.get(SYSTEM_NAME, "itemTags") || []

    // Validate tag data
    if (!this.#validateTagData(data)) return false

    tags.push(data)
    await game.settings.set(SYSTEM_NAME, "itemTags", tags)
    this.render(true)
  }

  async #updateTag(id, updates) {
    const tags = game.settings.get(SYSTEM_NAME, "itemTags") || []
    const tagIndex = tags.findIndex((t) => t.id === id)

    if (tagIndex === -1) return

    tags[tagIndex] = { ...tags[tagIndex], ...updates }
    await game.settings.set(SYSTEM_NAME, "itemTags", tags)
    this.render(true)
  }

  async #deleteTag(id) {
    const tags = game.settings.get(SYSTEM_NAME, "itemTags") || []
    const updatedTags = tags.filter((t) => t.id !== id)

    await game.settings.set(SYSTEM_NAME, "itemTags", updatedTags)
    this.render(true)
  }

  #validateTagData(data) {
    const { id, name, img } = data
    if (!id || !name) return false

    // Ensure ID follows pattern category:subtype
    const idPattern = /^[a-z]+:[a-z-]+$/
    if (!idPattern.test(id)) return false

    // Ensure ID is unique
    const existingTags = game.settings.get(SYSTEM_NAME, "itemTags") || []
    if (existingTags.some((t) => t.id === id)) return false

    return true
  }

  // === Event Handlers ====================================================

  static async createTag(event) {
    event.preventDefault()

    const form = event.currentTarget.closest("form")
    const formData = new FormDataExtended(form)
    // await this.#createTag(formData.object)
  }

  static async editTag(event) {
    event.preventDefault()

    const tagId = event.currentTarget.closest("[data-tag-id]").dataset.tagId
    // Implement edit dialog/form logic here
  }

  static async deleteTag(event) {
    event.preventDefault()

    const tagId = event.currentTarget.closest("[data-tag-id]").dataset.tagId
    const confirm = await Dialog.confirm({
      title: game.i18n.localize("BAGS.Settings.TagManager.DeleteConfirm.Title"),
      content: game.i18n.localize(
        "BAGS.Settings.TagManager.DeleteConfirm.Content",
      ),
    })

    // if (confirm) await this.#deleteTag(tagId)
  }
}
