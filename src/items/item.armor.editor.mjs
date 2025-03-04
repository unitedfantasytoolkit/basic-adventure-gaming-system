import BAGSItemArmorDataModel from "./item.armor.datamodel.mjs"
import BAGSBaseItemEditor from "./item.editor.mjs"

export default class BAGSArmorEditor extends BAGSBaseItemEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--armor-editor"],
    }
  }

  static DOCUMENT_TYPE = "armor"

  // --- Tabs ------------------------------------------------------------------

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.CharacterClass.Tabs.Summary",
          cssClass: "tab--summary",
        },
        ...super.TABS.sheet.tabs,
      ],
      initial: "details",
      labelPrefix: "BAGS.Actors.Character.Tabs",
    },
  }

  static TAB_PARTS = {
    details: {
      template: `${this.TEMPLATE_ROOT}/details.hbs`,
    },
  }

  // === Rendering =============================================================

  async _prepareFormattedFields() {
    return {
      armorClass: BAGSItemArmorDataModel.offsetToAC(
        this.document.system.armorClassOffset,
      ),
    }
  }

  // === Events ================================================================
  async _onSave(_event, _form, formData) {
    const { tempAC, ...updates } = formData.object
    await this.document.update({
      ...updates,
      "system.armorClassOffset": BAGSItemArmorDataModel.acToOffset(tempAC),
    })
    this.render(true)
    this.document.sheet.render(true)
  }
}
