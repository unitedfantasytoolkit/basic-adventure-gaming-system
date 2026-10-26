/**
 * @file The UI for editing a spell Item.
 *
 * Spells aren't physical objects, so this drops the base editor's container and
 * identification tabs. What it offers instead depends on the world: the rules
 * module decides which parts of a spell entry this game prints, and the editor
 * only asks for those. A Basic world never sees a casting time field, even for
 * a spell that has one stored from wherever it was imported.
 */
import BAGSBaseItemEditor from "./item.editor.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import { SPELL_ENTRY_FIELDS } from "../config/spell-fields.mjs"
import { getTraditions } from "../config/spell-rules.mjs"
import { getSpellVocabulary } from "../utils/spell-vocabulary.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

export default class BAGSSpellEditor extends BAGSBaseItemEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--spell-editor"],
      position: {
        width: 560,
        height: "auto",
      },
    }
  }

  static DOCUMENT_TYPE = "spell"

  /** @override */
  get title() {
    return game.i18n.format("BAGS.Items.Spells.Editor.Title", {
      name: this.document.name,
    })
  }

  // --- Tabs ------------------------------------------------------------------

  tabGroups = {
    sheet: "details",
  }

  /**
   * Tabs for the spell editor.
   * @returns {SheetNavTab[]} The tabs to display, in display order
   */
  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.Items.Spells.Tabs.Details",
          cssClass: "tab--details",
        },
        {
          id: "media",
          group: "sheet",
          icon: "fa-solid fa-image",
          label: "BAGS.Items.CommonTabs.Media",
          cssClass: "tab--media",
        },
        {
          id: "flavor-text",
          group: "sheet",
          icon: "fa-solid fa-feather-pointed",
          label: "BAGS.Items.CommonTabs.FlavorText",
          cssClass: "tab--with-text-editor",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-scroll-old",
          label: "BAGS.Items.CommonTabs.Description",
          cssClass: "tab--with-text-editor",
        },
      ],
      initial: "details",
      labelPrefix: "BAGS.Items.Spells.Tabs",
    },
  }

  // --- App parts -------------------------------------------------------------

  static PARTS = {
    details: {
      template: `${SYSTEM_TEMPLATE_PATH}/spell/details.edit.hbs`,
      scrollable: [".scrollable"],
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

  // === Rendering =============================================================

  /** @override */
  async _preparePartContext(partId, context) {
    await super._preparePartContext(partId, context)

    if (partId !== "details") return context

    const { system } = this.document
    const enabled = system.enabledEntryFields
    const vocabulary = await getSpellVocabulary()

    // Turn the enabled set into plain booleans, because Handlebars can't ask a
    // Set whether it has something.
    context.shows = Object.fromEntries(
      Object.values(SPELL_ENTRY_FIELDS).map((field) => [
        field,
        enabled.has(field),
      ]),
    )

    context.traditionOptions = getTraditions().map((tradition) => ({
      value: tradition.id,
      label: game.i18n.localize(tradition.label),
    }))

    context.schoolsValue = system.schools.join(", ")
    context.spheresValue = system.spheres.join(", ")
    context.schoolSuggestions = vocabulary.schools
    context.sphereSuggestions = vocabulary.spheres

    return context
  }

  // === Events ================================================================

  /**
   * Save the form.
   *
   * Schools and spheres are edited as comma-separated text because that's how
   * spell entries are written, so they're split back into arrays here.
   * @param {Event} _event - The originating form event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The submitted form data
   */
  async _onSave(_event, _form, formData) {
    const { schoolsText, spheresText, ...updates } = formData.object

    await this.document.update({
      ...updates,
      ...(schoolsText !== undefined
        ? { "system.schools": BAGSSpellEditor.#splitList(schoolsText) }
        : {}),
      ...(spheresText !== undefined
        ? { "system.spheres": BAGSSpellEditor.#splitList(spheresText) }
        : {}),
    })

    this.render(true)
    if (this.document.sheet.visible) this.document.sheet.render(true)
  }

  /**
   * Turn a comma-separated string into a clean array of entries.
   * @param {string} value - The raw text from the form
   * @returns {string[]} The split entries, trimmed, with blanks dropped
   * @private
   */
  static #splitList(value) {
    return (value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
}
