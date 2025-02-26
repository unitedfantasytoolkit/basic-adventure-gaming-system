import BAGSItemEditor from "./item.miscellaneous.editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"
import ActionEditor from "../applications/action-editor.mjs"
import BAGSActiveEffectEditor from "../applications/active-effects.editor.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSMiscellaneousItemSheet extends BAGSBaseItemSheet {
  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--item-sheet"],
    window: {
      controls: [
        {
          action: "edit-item",
          icon: "fa-solid fa-pencil",
          label: "Edit Item",
          ownership: "OWNER",
        },
        {
          action: "edit-actions",
          icon: "fa-solid fa-sparkles",
          label: "Edit Actions",
          ownership: "OWNER",
        },
        {
          action: "edit-active-effects",
          icon: "fa-solid fa-sparkles",
          label: "Manage Active Effects",
          ownership: "OWNER",
        },
      ],
    },
  }

  static DOCUMENT_TYPE = "item"

  get title() {
    return this.document.name
  }

  // --- Sub apps --------------------------------------------------------------
  static SUB_APPS = {
    actionEditor: ActionEditor,
    activeEffectEditor: BAGSActiveEffectEditor,
    itemEditor: BAGSItemEditor,
  }

  static PARTS = {
    stats: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/item.stats.hbs`,
    },
    ...super.PARTS,
  }
}
