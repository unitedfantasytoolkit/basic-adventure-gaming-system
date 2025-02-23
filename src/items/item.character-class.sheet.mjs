/**
 * @file The UI for viewing and editiing an ability Item.
 */
import BAGSCharacterClassXPTableEditor from "./item.character-class.xp-table-editor.mjs"
import BAGSCharacterClassDetailsEditor from "./item.character-class.details-editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"
import ActionEditor from "../applications/action-editor.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

export default class BAGSCharacterClassSheet extends BAGSBaseItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["application--character-class-sheet"],
    window: {
      controls: [
        {
          action: "edit-item",
          icon: "fa-solid fa-pencil",
          label: "BAGS.CharacterClass.Information.ActionLabel",
          ownership: "OWNER",
        },
        {
          action: "edit-advancement",
          icon: "fa-solid fa-table",
          label: "BAGS.CharacterClass.XPTable.ActionLabel",
          ownership: "OWNER",
        },
        {
          action: "edit-actions",
          icon: "fa-solid fa-sparkles",
          label: "Edit Actions",
          ownership: "OWNER",
        },
      ],
    },
    actions: {
      "edit-advancement": this.editAdvancement,
    },
  }

  static DOCUMENT_TYPE = "class"

  // --- Sub apps --------------------------------------------------------------
  static SUB_APPS = {
    actionEditor: ActionEditor,
    itemEditor: BAGSCharacterClassDetailsEditor,
    advancementEditor: BAGSCharacterClassXPTableEditor,
  }

  static get PARTS() {
    return {
      summary: {
        template: `${this.TEMPLATE_ROOT}/main.hbs`,
      },
      advancement: {
        template: `${this.TEMPLATE_ROOT}/xp-table.view.hbs`,
      },
      ...super.TAB_PARTS,
    }
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    super._preparePartContext(partId, context, options)
    const doc = this.document

    const savingThrowSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
      )

    switch (partId) {
      case "summary":
        context.gearTable = doc.system.gearTable
          ? await TextEditor.enrichHTML(
              fromUuidSync(doc.system.gearTable)._createDocumentLink(),
            )
          : ""
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

  tabGroups = {
    sheet: "summary",
  }

  static TABS = {
    sheet: {
      ...super.TABS.sheet,
      tabs: [
        ...super.TABS.sheet.tabs,
        {
          id: "advancement",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "BAGS.CharacterClass.Tabs.Advancement",
          cssClass: "tab--advancement",
        },
      ],
    },
  }

  static editAdvancement() {
    this.subApps.advancementEditor.render(true)
  }
}
