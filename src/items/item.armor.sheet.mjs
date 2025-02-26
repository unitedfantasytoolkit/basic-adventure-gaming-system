/**
 * @file The UI for viewing and editing an armor Item.
 */
import ActionEditor from "../applications/action-editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"
import BAGSArmorEditor from "./item.armor.editor.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import signNumber from "../utils/sign-number.mjs"
import BAGSActiveEffectEditor from "../applications/active-effects.editor.mjs"

export default class BAGSArmorSheet extends BAGSBaseItemSheet {
  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--armor-sheet"],
    window: {
      controls: [
        {
          action: "edit-item",
          icon: "fa-solid fa-pencil",
          label: "Edit Armor",
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

  static DOCUMENT_TYPE = "weapon"

  get title() {
    const {
      name,
      system: { weaponBonus },
    } = this.document

    const modifierAtStartRegex = /^[-+]{1}\d+/
    const modifierAtEndRegex = /[-+]{1}\d+$/

    if (name.match(modifierAtStartRegex) || name.match(modifierAtEndRegex))
      return name

    const bonusString = weaponBonus ? `, ${signNumber(weaponBonus)}` : ""
    return `${name}${bonusString}`
  }

  // --- Sub apps --------------------------------------------------------------
  static SUB_APPS = {
    actionEditor: ActionEditor,
    itemEditor: BAGSArmorEditor,
    activeEffectEditor: BAGSActiveEffectEditor,
  }

  static PARTS = {
    stats: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/item.stats.hbs`,
    },
    ...super.PARTS,
  }
}
