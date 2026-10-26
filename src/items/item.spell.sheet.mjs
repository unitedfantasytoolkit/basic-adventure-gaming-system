/**
 * @file The UI for viewing a spell Item.
 * @see {@link ./item.sheet.mjs} for the base class
 * @see {@link ./item.spell.datamodel.mjs} for the data model
 * @see {@link ./item.spell.editor.mjs} for the editing UI
 * @see {@link ./item.spell.sheet.css} for item-type-specific styles
 */
import ActionEditor from "../applications/action-editor.mjs"
import BAGSActiveEffectEditor from "../applications/active-effects.editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"
import BAGSSpellEditor from "./item.spell.editor.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import { SPELL_ENTRY_FIELDS as F } from "../config/spell-fields.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

/**
 * The Application used to read a spell: its stat block, its description, and
 * whatever actions it performs when cast.
 * @class
 * @augments {BAGSBaseItemSheet}
 */
export default class BAGSSpellItemSheet extends BAGSBaseItemSheet {
  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--spell-sheet"],
    window: {
      controls: [
        {
          action: "edit-item",
          icon: "fa-solid fa-pencil",
          label: "BAGS.Items.Spells.Editor.Control",
          ownership: "OWNER",
        },
        {
          action: "edit-actions",
          icon: "fa-solid fa-sparkles",
          label: "BAGS.Items.Spells.Actions.Control",
          ownership: "OWNER",
        },
        {
          action: "edit-active-effects",
          icon: "fa-solid fa-wand-magic-sparkles",
          label: "BAGS.Items.Spells.ActiveEffects.Control",
          ownership: "OWNER",
        },
      ],
    },
    position: {
      width: 520,
      height: 560,
    },
  }

  static DOCUMENT_TYPE = "spell"

  // The window title is inherited: every item sheet in the system titles itself
  // after the document it shows, and the spell's level is already the first row
  // a reader meets in the stat block.

  // --- Sub apps --------------------------------------------------------------

  static SUB_APPS = {
    actionEditor: ActionEditor,
    itemEditor: BAGSSpellEditor,
    activeEffectEditor: BAGSActiveEffectEditor,
  }

  // --- App parts -------------------------------------------------------------

  static get PARTS() {
    return {
      summary: {
        template: `${this.TEMPLATE_ROOT}/main.hbs`,
        scrollable: [".scrollable"],
      },
      actions: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/actions.view.hbs`,
      },
    }
  }

  tabGroups = {
    sheet: "summary",
  }

  /**
   * Tabs for the spell sheet.
   * @returns {SheetNavTab[]} The tabs to display, in display order
   */
  static get TABS() {
    return {
      sheet: {
        tabs: [
          {
            id: "summary",
            group: "sheet",
            icon: "fa-solid fa-scroll",
            label: "BAGS.Items.Spells.Tabs.Summary",
            cssClass: "tab--summary",
          },
          {
            id: "actions",
            group: "sheet",
            icon: "fa-solid fa-sparkles",
            label: "BAGS.Items.Spells.Tabs.Actions",
            cssClass: "tab--actions",
          },
        ],
        initial: "summary",
        labelPrefix: "BAGS.Items.Spells.Tabs",
      },
    }
  }

  // === Rendering =============================================================

  /** @override */
  async _preparePartContext(partId, context) {
    await super._preparePartContext(partId, context)

    const doc = this.document

    switch (partId) {
      case "summary":
        context.entryStats = this.#prepareEntryStats()
        context.classification = this.#prepareClassification()
        context.classListings = this.#prepareClassListings()
        context.reversedSpell = doc.system.reversedSpell
        context.tradition = doc.system.tradition
        // The material component only means anything in a world that tracks
        // components at all.
        context.showMaterials =
          doc.system.enabledEntryFields.has(F.COMPONENTS) &&
          !!doc.system.entry.materials
        break
      case "actions":
        context.actions = await Promise.all(
          doc.system.actionList.map(async (action) => ({
            ...action,
            description: await foundry.applications.ux.TextEditor.enrichHTML(
              action.description,
            ),
          })),
        )
        break
      default:
        break
    }

    return context
  }

  /**
   * Build the printed entry, the block a referee skims before anything
   * happens: what level, how far, how long, how quickly, over what, whether
   * there's a save, and what it costs to cast.
   *
   * A row appears only when this world's rules module prints that part of an
   * entry *and* this spell fills it in -- except the level, which every spell
   * has and every game cares about. So a Basic world shows three rows and an
   * Advanced world shows seven.
   * @returns {{label: string, value: string, key: string}[]} The rows
   * @private
   */
  #prepareEntryStats() {
    const { system } = this.document
    const { entry } = system
    const enabled = system.enabledEntryFields

    const rows = [
      [F.RANGE, "BAGS.Items.Spells.Fields.Range.Label", entry.range],
      [F.DURATION, "BAGS.Items.Spells.Fields.Duration.Label", entry.duration],
      [
        F.CASTING_TIME,
        "BAGS.Items.Spells.Fields.CastingTime.Label",
        entry.castingTime,
      ],
      [
        F.AREA_OF_EFFECT,
        "BAGS.Items.Spells.Fields.AreaOfEffect.Label",
        entry.areaOfEffect,
      ],
      [
        F.SAVING_THROW,
        "BAGS.Items.Spells.Fields.SavingThrow.Label",
        entry.savingThrow,
      ],
      [
        F.COMPONENTS,
        "BAGS.Items.Spells.Fields.Components.Label",
        system.componentSummary,
      ],
    ]
      .filter(([field, , value]) => enabled.has(field) && !!value)
      .map(([key, label, value]) => ({
        key,
        label: game.i18n.localize(label),
        value,
      }))

    return [
      {
        key: "level",
        label: game.i18n.localize("BAGS.Items.Spells.Fields.Level.Label"),
        value: system.level,
      },
      ...rows,
    ]
  }

  /**
   * Build the classification list for the aside.
   *
   * Schools and spheres describe the spell rather than how it's cast, so they
   * sit beside the text with the rest of the bookkeeping instead of in the stat
   * band. Source rides along: it isn't part of any ruleset's printed entry, but
   * it's worth showing wherever somebody filled it in.
   * @returns {{label: string, value: string}[]} The rows to display
   * @private
   */
  #prepareClassification() {
    const { system } = this.document
    const enabled = system.enabledEntryFields

    const rows = [
      [
        F.SCHOOLS,
        "BAGS.Items.Spells.Fields.Schools.Label",
        system.schools.join(", "),
      ],
      [
        F.SPHERES,
        "BAGS.Items.Spells.Fields.Spheres.Label",
        system.spheres.join(", "),
      ],
    ]
      .filter(([field, , value]) => enabled.has(field) && !!value)
      .map(([, label, value]) => ({ label: game.i18n.localize(label), value }))

    if (system.source) {
      rows.push({
        label: game.i18n.localize("BAGS.Items.Spells.Fields.Source.Label"),
        value: system.source,
      })
    }

    return rows
  }

  /**
   * Build the "which classes learn this, and at what level" list.
   *
   * Classes name their spells, so this reads the class side. A world whose
   * ruleset doesn't use class lists gets an empty list and the section is left
   * off entirely.
   * @returns {{name: string, img: string, level: number, uuid: string}[]} One
   * entry per class whose list carries this spell
   * @private
   */
  #prepareClassListings() {
    const spell = this.document

    return spell.system.castingClasses.map((classItem) => ({
      uuid: classItem.uuid,
      name: classItem.name,
      img: classItem.img,
      level: spell.system.levelForClass(classItem),
    }))
  }
}
