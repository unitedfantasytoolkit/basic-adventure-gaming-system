/**
 * @file The editing application for Actors of type `monster`
 */
import BAGSBaseActorEditor from "./actor.editor.mjs"

export default class BAGSWeaponEditor extends BAGSBaseActorEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--monster-editor"],
    }
  }

  static DOCUMENT_TYPE = "monster"

  // --- Tabs ------------------------------------------------------------------

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.Actors.Weapon.Tabs.Details",
          cssClass: "tab--summary",
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
