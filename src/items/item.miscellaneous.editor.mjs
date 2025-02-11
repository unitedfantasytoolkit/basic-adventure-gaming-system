import BAGSBaseItemEditor from "./item.editor.mjs"

export default class BAGSMiscellaneousItemEditor extends BAGSBaseItemEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--item-editor"],
    }
  }

  static DOCUMENT_TYPE = "item"

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
}
