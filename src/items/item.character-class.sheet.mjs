/**
 * @file The UI for viewing and editiing an ability Item.
 */
import BAGSCharacterClassXPTableEditor from "./item.character-class.xp-table-editor.mjs"
import BAGSCharacterClassDetailsEditor from "./item.character-class.details-editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

export default class BAGSCharacterClassSheet extends BAGSBaseItemSheet {
  static SUB_APPS = []

  static DOCUMENT_TYPE = "class"

  #xpTableEditor

  #detailsEditor

  constructor(options = {}) {
    super(options)

    this.#xpTableEditor = new BAGSCharacterClassXPTableEditor({
      document: this.document,
    })
    this.#detailsEditor = new BAGSCharacterClassDetailsEditor({
      document: this.document,
    })
  }

  static DEFAULT_OPTIONS = {
    window: {
      controls: [
        {
          action: "edit-xp-table",
          icon: "fa-solid fa-table",
          label: "BAGS.CharacterClass.XPTable.ActionLabel",
          ownership: "OWNER",
        },
        {
          action: "edit-details",
          icon: "fa-solid fa-pencil",
          label: "BAGS.CharacterClass.Information.ActionLabel",
          ownership: "OWNER",
        },
      ],
    },
    actions: {
      "edit-xp-table": this.renderXPTable,
      "edit-details": this.renderClassDetails,
    },
  }

  static get TAB_PARTS() {
    return {
      ...BAGSBaseItemSheet.TAB_PARTS,
      summary: {
        template: `${this.TEMPLATE_ROOT}/main.hbs`,
      },
      advancement: {
        template: `${this.TEMPLATE_ROOT}/xp-table.view.hbs`,
      },
    }
  }

  tabGroups = {
    sheet: "summary",
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    context.tab = context.tabs.find((t) => t.id === partId)
    const gearTable = doc.system.gearTable
      ? await TextEditor.enrichHTML(
          fromUuidSync(doc.system.gearTable)._createDocumentLink(),
        )
      : ""

    const savingThrowSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
      )

    switch (partId) {
      case "summary":
        context.gearTable = gearTable
        break
      case "advancement":
        context.savingThrowTypeCount = Object.keys(
          savingThrowSettings.savingThrows,
        ).length
        context.savingThrows = savingThrowSettings.savingThrows
        break
      default:
        return super._preparePartContext(partId, context)
    }
    return context
  }

  /**
   * Tabs for the Ability sheet.
   * @returns {SheetNavTab[]} The tabs to display, in the order they should be
   * displayed.
   */
  static get TABS() {
    return [
      ...BAGSBaseItemSheet.TABS,
      {
        id: "advancement",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Advancement",
        cssClass: "tab--advancement",
      },
    ]
  }

  static renderXPTable() {
    this.#xpTableEditor.render(true)
  }

  static renderClassDetails() {
    this.#detailsEditor.render(true)
  }

  close() {
    this.#detailsEditor.close()
    this.#xpTableEditor.close()
    return super.close()
  }
}
