/**
 * @file The UI for viewing a weapon Item.
 */
import ActionEditor from "../applications/action-editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"
import BAGSWeaponEditor from "./item.weapon.editor.mjs"
import signNumber from "../utils/sign-number.mjs"

/**
 * The Application used to view a weapon Item.
 * @see {@link ./item.sheet.mjs} for the base class
 * @see {@link ./item.weapon.datamodel.mjs} for the data model
 * @see {@link ./item.weapon.sheet.css} for item-type-specific styles.
 * @class
 * @todo Implement equipping
 * @todo Implement a built-in "attack" action
 * @todo Add a field for item cost
 * @todo Add a field for item weight
 */
export default class BAGSWeaponSheet extends BAGSBaseItemSheet {
  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--weapon-sheet"],
    window: {
      controls: [
        {
          action: "edit-item",
          icon: "fa-solid fa-pencil",
          label: "Edit Weapon",
          ownership: "OWNER",
        },
        {
          action: "edit-actions",
          icon: "fa-solid fa-sparkles",
          label: "Edit Actions",
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
    itemEditor: BAGSWeaponEditor,
  }
}
