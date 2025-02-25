/**
 * @file The editing application for Actors of type `monster`
 */
import BAGSBaseActorEditor from "./actor.editor.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSMonsterEditor extends BAGSBaseActorEditor {
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
        {
          id: "lair",
          group: "sheet",
          icon: "fa-solid fa-dungeon",
          label: "BAGS.Actors.Monster.Tabs.Lair",
          cssClass: "tab--with-text-editor",
        },
        {
          id: "tactics",
          group: "sheet",
          icon: "fa-solid fa-flag-swallowtail",
          label: "BAGS.Actors.Monster.Tabs.Tactics",
          cssClass: "tab--with-text-editor",
        },
      ],
      initial: "details",
      labelPrefix: "BAGS.Actors.Monster.Tabs",
    },
  }

  static TAB_PARTS = {
    details: {
      template: `${this.TEMPLATE_ROOT}/details.hbs`,
    },
    lair: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
    },
    tactics: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
    },
  }

  // === Rendering =============================================================

  /** @override */
  async _preparePartContext(partId, context) {
    super._preparePartContext(partId, context)

    const doc = this.document
    switch (partId) {
      case "lair":
        context.headingText = "BAGS.Actors.Monster.Tabs.Lair"
        context.field = context.systemFields.biographicalDetails.fields.lair
        context.fieldValue = doc.system.biographicalDetails.lair
        break
      case "tactics":
        context.headingText = "BAGS.Actors.Monster.Tabs.Tactics"
        context.field = context.systemFields.biographicalDetails.fields.tactics
        context.fieldValue = doc.system.biographicalDetails.tactics
        break
      default:
        break
    }
    return context
  }

  // === Events ================================================================
  // static async save(_event, _form, formData) {
  //   if (this._onSave) this._onSave(_event, _form, formData)
  //   else {
  //     await this.document.update(formData.object)
  //     this.render(true)
  //     if (this.document.sheet.visible) this.document.sheet.render(true)
  //   }
  // }
}
