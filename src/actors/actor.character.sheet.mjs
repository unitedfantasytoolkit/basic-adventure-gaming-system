/**
 * @file The character sheet -- the primary UI for a player character.
 */
import BAGSActorSheet from "../common/actor.sheet.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSCharacterSheet extends BAGSActorSheet {
  // === App config ============================================================
  static get DEFAULT_OPTIONS() {
    return {
      id: "character-{id}",
      classes: ["application--character-sheet"],
      form: {
        handler: undefined,
        submitOnChange: true,
      },
    }
  }

  // --- Sub apps --------------------------------------------------------------
  // TODO: Character editor

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
      "left-rail": {
        template: `${this.TEMPLATE_ROOT}/left-rail.hbs`,
      },
      summary: {
        template: `${this.TEMPLATE_ROOT}/summary.hbs`,
      },
      ...super.PARTS,
      description: {
        template: `${this.TEMPLATE_ROOT}/identity.hbs`,
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
      // tabs: this.#getTabs(),
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    super._preparePartContext(partId, context)

    const doc = this.document

    const encumbranceSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ENCUMBRANCE,
      )

    switch (partId) {
      case "left-rail":
        context.classes = doc.itemTypes.class.map((cls) => ({
          ...cls,
          xpBar: {
            current: cls.system.xp,
            max: cls.system.xpTable[cls.system.level - 1].value,
          },
        }))
        context.hp = doc.system.hp
        context.savingThrowLocaleStrings =
          CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
            CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
          )?.savingThrows
        context.usesDescendingAC =
          CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
            CONFIG.BAGS.SystemRegistry.categories.COMBAT,
          )?.descending

        context.encumbranceMeter = encumbranceSettings.encumbranceMeter(
          doc.system,
        )
        break
      default:
        break
    }

    context.tab = context.tabs[partId] || null

    return context
  }

  // --- Tabs ------------------------------------------------------------------

  // --- Header/Title manipulation ---------------------------------------------

  // === Action management =====================================================

  // === Events ================================================================
}
