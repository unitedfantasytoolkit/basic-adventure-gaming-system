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
          label: "BAGS.Actors.Character.Editor.Tabs.BasicInfo",
          cssClass: "tab--details",
        },
        {
          id: "stats",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.Actors.Character.Editor.Tabs.Stats",
          cssClass: "tab--stats",
        },
        {
          id: "class-and-abilities",
          group: "sheet",
          icon: "fa-solid fa-trophy",
          label: "BAGS.Actors.Character.Editor.Tabs.ClassAndAbilities",
          cssClass: "tab--class-and-abilities",
        },
        {
          id: "identity",
          group: "sheet",
          icon: "fa-solid fa-trophy",
          label: "BAGS.Actors.Character.Editor.Tabs.Identity",
          cssClass: "tab--identity",
        },
        ...super.TABS.sheet.tabs,
      ],
      initial: "stats",
      labelPrefix: "BAGS.Actors.Character.Editor.Tabs",
    },
  }

  static TAB_PARTS = {
    stats: {
      template: `${this.TEMPLATE_ROOT}/stats.edit.hbs`,
    },
    details: {
      template: `${this.TEMPLATE_ROOT}/basic-info.edit.hbs`,
    },
    identity: {
      template: `${this.TEMPLATE_ROOT}/identity.edit.hbs`,
    },
  }
}
