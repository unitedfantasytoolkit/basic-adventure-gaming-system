/**
 * @file The editing application for Actors of type `monster`
 */
import BAGSBaseActorEditor from "./actor.editor.mjs"

export default class BAGSCharacterEditor extends BAGSBaseActorEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--character-editor"],
    }
  }

  static DOCUMENT_TYPE = "character"

  // --- Tabs ------------------------------------------------------------------

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.Actors.Character.Tabs.Details",
          cssClass: "tab--summary",
        },
        {
          id: "class-and-abilities",
          group: "sheet",
          icon: "fa-solid fa-trophy",
          label: "BAGS.Actors.Character.Tabs.ClassAndAbilities",
          cssClass: "tab--class-and-abilities",
        },
        ...super.TABS.sheet.tabs,
      ],
      initial: "details",
      labelPrefix: "BAGS.Actors.Monster.Tabs",
    },
  }

  static TAB_PARTS = {
    details: {
      template: `${this.TEMPLATE_ROOT}/details.hbs`,
    },
  }
}
