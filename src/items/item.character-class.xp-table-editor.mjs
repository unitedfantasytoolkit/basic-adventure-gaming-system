/**
 * @file A UI to edit a class's levels, saves, hit dice, and attack bonuses.
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

export default class BAGSCharacterClassXPTableEditor extends HandlebarsApplicationMixin(
  ApplicationV2
) {
  document

  constructor(options = {}) {
    super(options)
    this.document = options.document
  }

  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    id: "xp-table-editor-{id}",
    classes: [
      "application--xp-table-editor",
      "application--bags",
      "application--hide-title",
      "scrollable",
    ],
    tag: "form",
    window: {
      frame: true,
      positioned: true,
      controls: [],
      minimizable: false,
      resizable: false,
      contentTag: "section",
      contentClasses: [],
    },
    actions: {},
    form: {
      handler: this.save,
      submitOnChange: true,
    },
    position: {
      width: 960,
      height: "auto",
    },
  }

  // === Rendering =============================================================

  // --- Tabs and Templates ----------------------------------------------------
  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/character-class`
  }

  static PARTS = {
    header: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/header.hbs`,
    },
    "tab-navigation": {
      template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
    },
    "xp-table": {
      template: `${this.TEMPLATE_ROOT}/xp-table.edit.hbs`,
      scrollable: [".scrollable"],
    },
    resources: {
      template: `${this.TEMPLATE_ROOT}/leveled-resources.edit.hbs`,
      scrollable: [".scrollable"],
    },
    "spell-slots": {
      template: `${this.TEMPLATE_ROOT}/spell-slots.edit.hbs`,
      scrollable: [".scrollable"],
    },
  }

  tabGroups = {
    // sheet: "xp-table",
    sheet: "resources",
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {
      "xp-table": {
        id: "xp-table",
        group: "sheet",
        icon: "fa-solid fa-trophy",
        label: "BAGS.CharacterClass.Tabs.XP",
      },
      resources: {
        id: "resources",
        group: "sheet",
        icon: "fa-solid fa-list-tree",
        label: "BAGS.CharacterClass.Tabs.Resources",
      },
      "spell-slots": {
        id: "spell-slots",
        group: "sheet",
        icon: "fa-solid fa-sparkle",
        label: "BAGS.CharacterClass.Tabs.SpellSlots",
      },
    }
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id
      v.cssClass = v.active ? "active" : ""
    }
    return tabs
  }

  // --- UI Element Overrides --------------------------------------------------
  /** @override */
  get title() {
    const { constructor: cls, id, name, type } = this.document
    const prefix = cls.hasTypeData
      ? CONFIG[cls.documentName].typeLabels[type]
      : cls.metadata.label
    return `${game.i18n.localize("BAGS.CharacterClass.XPTable.EditorTitle")}: ${name ?? id}`
  }

  // === Render setup ==========================================================
  async _prepareContext(_options) {
    const doc = this.document

    return {
      item: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      systemFields: doc.system.schema.fields,
      tabs: this.#getTabs(),
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    switch (partId) {
      case "header":
        context.title = this.title
        break
      case "xp-table":
        context.tab = context.tabs[partId]
        break
      case "resources":
        context.tab = context.tabs[partId]
        break
      case "spell-slots":
        context.tab = context.tabs[partId]
        break
    }
    return context
  }

  // === Update process ========================================================
  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
    this.document.sheet.render()
  }

  // === UI Events==============================================================

  // --- Class Levels ----------------------------------------------------------
  async #addClassLevel() {
    const highestLevel = this.document.system.xpTable.length - 1

    const newRow = structuredClone(
      highestLevel > -1
        ? this.document.system.xpTable[highestLevel]
        : this.document.system.schema.fields.xpTable.initial[0]
    )

    await this.document.update({
      "system.xpTable": [...this.document.system.xpTable, newRow],
    })

    await this.render()
  }

  async #removeClassLevel() {
    const rows = [...this.document.system.xpTable]
    if (!rows?.length) return
    await this.document.update({
      "system.xpTable": rows.splice(0, rows.length - 1),
    })
    await this.render()
  }

  // --- Class Resources Categories --------------------------------------------
  async #addResource() {
    const template = { label: "", pool: [] }
    const resources = [...this.document.system.leveledResources, template]
    await this.document.update({
      "system.leveledResources": resources,
    })
    await this.render()
  }

  async #removeResource(event) {
    const confirm = await foundry.applications.api.DialogV2.confirm({
      content: `<p>Are you sure you want to remove this category? This change is irreversable.</p>`,
    })

    if (!confirm) return

    const { categoryId } = event.target.closest("[data-category-id]").dataset
    const resourceList = [...this.document.system.leveledResources]
    resourceList.splice(categoryId, 1)
    await this.document.update({
      "system.leveledResources": resourceList,
    })
    await this.render()
  }

  // --- Class Resources Pools -------------------------------------------------
  async #addResourcePool(event) {
    const { categoryId } = event.target.closest("[data-category-id]").dataset
    const resourceList = [...this.document.system.leveledResources]
    const resource = structuredClone(resourceList[categoryId])
    const template = { label: "", perLevel: [] }
    resource.pool.push(template)
    resourceList[categoryId] = resource
    await this.document.update({
      "system.leveledResources": resourceList,
    })
    await this.render()
  }

  async #removeResourcePool(event) {
    const confirm = await foundry.applications.api.DialogV2.confirm({
      content: `<p>Are you sure you want to remove this resource? This change is irreversable.</p>`,
    })

    if (!confirm) return

    const { categoryId } = event.target.closest("[data-category-id]").dataset
    const { poolId } = event.target.closest("[data-pool-id]").dataset
    const resourceList = [...this.document.system.leveledResources]
    resourceList[categoryId].pool.splice(poolId, 1)
    await this.document.update({
      "system.leveledResources": resourceList,
    })
    await this.render()
  }

  // --- Spell Levels ----------------------------------------------------------
  async #addSpellLevel() {
    const template = { label: "", pool: [] }
    const spellSlots = [...this.document.system.spellSlots, []]
    await this.document.update({
      "system.spellSlots": spellSlots,
    })
    await this.render()
  }

  async #removeSpellLevel(event) {
    const confirm = await foundry.applications.api.DialogV2.confirm({
      content: `<p>Are you sure you want to remove this spell level? This change is irreversable.</p>`,
    })

    if (!confirm) return

    const rows = [...this.document.system.spellSlots]
    if (!rows?.length) return
    await this.document.update({
      "system.spellSlots": rows.splice(0, rows.length - 1),
    })
    await this.render()
  }

  // === Event Delegation =======================================================

  _onClickAction(event, target) {
    const action = target.dataset.action

    if (!action) return

    switch (action) {
      case "add-level":
        this.#addClassLevel()
        break
      case "remove-level":
        this.#removeClassLevel()
        break
      case "add-resource-pool":
        this.#addResourcePool(event)
        break
      case "remove-resource-pool":
        this.#removeResourcePool(event)
        break
      case "add-resource":
        this.#addResource()
        break
      case "remove-resource":
        this.#removeResource(event)
        break
      case "add-spell-level":
        this.#addSpellLevel()
        break
      case "remove-spell-level":
        this.#removeSpellLevel(event)
        break
    }

    super._onClickAction(event, target)
  }
}
