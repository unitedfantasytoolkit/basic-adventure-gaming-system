import BAGSBaseItemEditor from "./item.editor.mjs"

export default class BAGSAbilityEditor extends BAGSBaseItemEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--spell-editor"],
    }
  }

  static DOCUMENT_TYPE = "spell"

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
        super.TABS.sheet.tabs["flavor-text"],
        super.TABS.sheet.tabs.description,
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
}
