/**
 * @file A UI to edit a class's non-leveled data
 */

import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSBaseItemEditor from "./item.editor.mjs"
import { getSpellAccess, getTraditions } from "../config/spell-rules.mjs"

export default class CharacterClassEditor extends BAGSBaseItemEditor {
  document

  constructor(options = {}) {
    super(options)
    this.document = options.document
  }

  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    classes: ["application--class-editor"],
    actions: {
      "clear-gear-table": this.clearGearTable,
      "remove-listed-spell": this.removeListedSpell,
    },
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
    form: {
      handler: this.save,
      submitOnChange: true,
    },
    position: {
      width: 500,
      height: "auto",
    },
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/class`
  }

  static PARTS = {
    details: {
      template: `${this.TEMPLATE_ROOT}/class-details.edit.hbs`,
    },
    features: {
      template: `${this.TEMPLATE_ROOT}/features.edit.hbs`,
    },
    spellcasting: {
      template: `${this.TEMPLATE_ROOT}/spellcasting.edit.hbs`,
      scrollable: [".scrollable"],
    },
    requisites: {
      template: `${this.TEMPLATE_ROOT}/prerequisites-and-prime-requisites.edit.hbs`,
    },
    /**
     * @todo use `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs` for
     * this field's template.
     */
    restrictions: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
    },
    media: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/editor-tab-media.hbs`,
    },
    description: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
    },
    "flavor-text": {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
    },
  }

  /** @override */
  get title() {
    return `Class Editor: ${this.document.name}`
  }

  // === Render setup ==========================================================

  /**
   * Expose the world's starting gold formula so the class's own formula field
   * can show it as a placeholder. That makes it obvious what a blank field
   * falls back to.
   * @param {object} options - Render options
   * @returns {Promise<object>} The render context
   * @override
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)

    return {
      ...context,
      defaultStartingGold: game.settings.get(
        SYSTEM_NAME,
        "characterCreationStartingGold",
      ),
    }
  }

  /**
   * Build the spellcasting tab's context.
   * @param {object} context - The part context to add to
   * @returns {Promise<object>} The context, with spellcasting data added
   * @private
   */
  async #prepareSpellcastingContext(context) {
    const { system } = this.document

    context.traditionOptions = getTraditions().map((tradition) => ({
      value: tradition.id,
      label: game.i18n.localize(tradition.label),
    }))

    context.resolvedAccess = getSpellAccess(this.document)

    // Spells usually live in a compendium, so each listing has to be resolved.
    // A listing whose spell has gone away is shown as such rather than dropped,
    // so the referee can see what they've lost and clear it out.
    context.listedSpells = await Promise.all(
      system.spellList.map(async (entry, index) => {
        const spell = await fromUuid(entry.uuid)
        return {
          index,
          uuid: entry.uuid,
          level: entry.level,
          name: spell?.name || entry.uuid,
          img: spell?.img,
          missing: !spell,
        }
      }),
    )

    return context
  }

  /**
   * Let spells be dropped straight onto the list.
   * @param {DragEvent} event - The drop event
   * @returns {Promise<void>} Resolves once the list has been updated
   * @override
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event)
    if (data?.type !== "Item") return

    const dropped = await fromUuid(data.uuid)
    if (dropped?.type !== "spell") return

    const spellList = [...this.document.system.spellList]

    if (spellList.some((entry) => entry.uuid === dropped.uuid)) return

    spellList.push({
      uuid: dropped.uuid,
      level: dropped.system.level || 1,
    })

    await this.document.update({ "system.spellList": spellList })
    await this.render()
  }

  /**
   * Take a spell off this class's list.
   * @param {Event} event - The triggering click event
   */
  static async removeListedSpell(event) {
    const row = event.target.closest("[data-listing-index]")
    if (!row) return

    const spellList = [...this.document.system.spellList]
    spellList.splice(Number(row.dataset.listingIndex), 1)

    await this.document.update({ "system.spellList": spellList })
    await this.render()
  }

  /** @override */
  async _prepareFormattedFields() {
    const gearTableDocument = await fromUuid(this.document.system.gearTable)

    const gearTable = this.document.system.gearTable
      ? await foundry.applications.ux.TextEditor.enrichHTML(
          gearTableDocument._createDocumentLink(),
        )
      : ""

    return {
      gearTable,
    }
  }

  tabGroups = {
    sheet: "details",
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.CharacterClass.Tabs.Information",
        },
        {
          id: "features",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "BAGS.CharacterClass.Tabs.Features",
        },
        {
          id: "spellcasting",
          group: "sheet",
          icon: "fa-solid fa-book-sparkles",
          label: "BAGS.CharacterClass.Tabs.Spellcasting",
        },
        {
          id: "requisites",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "BAGS.CharacterClass.Tabs.Requisites",
        },
        {
          id: "restrictions",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "BAGS.CharacterClass.Tabs.Restrictions",
        },
        {
          id: "media",
          group: "sheet",
          icon: "fa-solid fa-image",
          label: "Media Settings",
          cssClass: "tab--media",
        },
        {
          id: "flavor-text",
          group: "sheet",
          icon: "fa-solid fa-feather-pointed",
          label: "Flavor Text",
          cssClass: "tab--with-text-editor",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-scroll-old",
          label: "Description",
          cssClass: "tab--with-text-editor",
        },
      ],
      initial: "details",
      labelPrefix: "BAGS.Items.CharacterClass.Tabs",
    },
  }

  /** @override */
  async _preparePartContext(partId, context) {
    await super._preparePartContext(partId, context)

    const doc = this.document
    switch (partId) {
      case "restrictions":
        context.headingText = "BAGS.Items.CommonTabs.Restrictions"
        context.field = context.systemFields.restrictions
        context.fieldValue = doc.system.restrictions
        break
      case "spellcasting":
        await this.#prepareSpellcastingContext(context)
        break
      default:
        break
    }
    return context
  }

  static async clearGearTable() {
    await this.document.update({
      "system.gearTable": "",
    })
    this.render(true)
  }
}
