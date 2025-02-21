import BAGSBaseItemEditor from "./item.editor.mjs"

export default class BAGSWeaponEditor extends BAGSBaseItemEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--weapon-editor"],
    }
  }

  static DOCUMENT_TYPE = "weapon"

  // --- Tabs ------------------------------------------------------------------

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.Items.Weapon.Tabs.Details",
          cssClass: "tab--summary",
        },
        {
          id: "attack",
          group: "sheet",
          icon: "fa-solid fa-swords",
          label: "BAGS.Items.Weapon.Tabs.Attack",
          cssClass: "tab--attack",
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
    attack: {
      template: `${this.TEMPLATE_ROOT}/attack.hbs`,
    },
  }
}
