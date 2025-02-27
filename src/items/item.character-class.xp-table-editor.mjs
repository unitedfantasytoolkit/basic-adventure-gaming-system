/**
 * @file A UI to edit a class's levels, saves, hit dice, and attack bonuses.
 */

import BAGSApplication from "../applications/application.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
const { DialogV2 } = foundry.applications.api

export default class BAGSCharacterClassXPTableEditor extends BAGSApplication {
  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    classes: ["application--xp-table-editor"],
    actions: {
      "add-level": this.addClassLevel,
      "remove-level": this.removeClassLevel,
      "add-resource-pool": this.addResourcePool,
      "remove-resource-pool": this.removeResourcePool,
      "add-resource": this.addResource,
      "remove-resource": this.removeResource,
      "add-spell-level": this.addSpellLevel,
      "remove-spell-level": this.removeSpellLevel,
    },
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
    return `${SYSTEM_TEMPLATE_PATH}/class`
  }

  static PARTS = {
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
    sheet: "xp-table",
  }

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "xp-table",
          group: "sheet",
          icon: "fa-solid fa-trophy",
          label: "BAGS.CharacterClass.Tabs.XP",
        },
        {
          id: "resources",
          group: "sheet",
          icon: "fa-solid fa-list-tree",
          label: "BAGS.CharacterClass.Tabs.Resources",
        },
        {
          id: "spell-slots",
          group: "sheet",
          icon: "fa-solid fa-sparkle",
          label: "BAGS.CharacterClass.Tabs.SpellSlots",
        },
      ],
      initial: "preparation",
    },
  }

  // --- UI Element Overrides --------------------------------------------------
  /** @override */
  get title() {
    const { id, name } = this.document

    return `${game.i18n.localize("BAGS.CharacterClass.XPTable.EditorTitle")}: ${name ?? id}`
  }

  // === Render setup ==========================================================

  // === Update process ========================================================
  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
    this.document.sheet.render()
  }

  // === UI Events==============================================================

  // --- Class Levels ----------------------------------------------------------
  static async addClassLevel() {
    const highestLevel = this.document.system.xpTable.length - 1

    const newRow = structuredClone(
      highestLevel > -1
        ? this.document.system.xpTable[highestLevel]
        : this.document.system.schema.fields.xpTable.initial[0],
    )

    await this.document.update({
      "system.xpTable": [...this.document.system.xpTable, newRow],
    })

    await this.render()
  }

  static async removeClassLevel() {
    const rows = [...this.document.system.xpTable]
    if (!rows?.length) return
    await this.document.update({
      "system.xpTable": rows.splice(0, rows.length - 1),
    })
    await this.render()
  }

  // --- Class Resources Categories --------------------------------------------
  static async addResource() {
    const template = { label: "", pool: [] }
    const resources = [...this.document.system.leveledResources, template]
    await this.document.update({
      "system.leveledResources": resources,
    })
    await this.render()
  }

  static async removeResource(event) {
    const confirm = await DialogV2.confirm({
      content:
        "<p>Are you sure you want to remove this category? This change is irreversable.</p>",
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
  static async addResourcePool(event) {
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

  static async removeResourcePool(event) {
    const confirm = await DialogV2.confirm({
      content:
        "<p>Are you sure you want to remove this resource? This change is irreversable.</p>",
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
  static async addSpellLevel() {
    const template = { label: "", pool: [] }
    const spellSlots = [...this.document.system.spellSlots, []]
    await this.document.update({
      "system.spellSlots": spellSlots,
    })
    await this.render()
  }

  static async removeSpellLevel(event) {
    const confirm = await DialogV2.confirm({
      content:
        "<p>Are you sure you want to remove this spell level? This change is irreversable.</p>",
    })

    if (!confirm) return

    const rows = [...this.document.system.spellSlots]
    if (!rows?.length) return
    await this.document.update({
      "system.spellSlots": rows.splice(0, rows.length - 1),
    })
    await this.render()
  }
}
