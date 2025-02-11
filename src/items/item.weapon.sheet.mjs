/**
 * @file The UI for viewing and editiing a weapon Item.
 */
import ActionEditor from "../applications/action-editor.mjs"
import BAGSBaseItemSheet from "../common/item.sheet.mjs"
import BAGSWeaponEditor from "./item.weapon.editor.mjs"
import signNumber from "../utils/sign-number.mjs"

export default class BAGSWeaponSheet extends BAGSBaseItemSheet {
  static DOCUMENT_TYPE = "weapon"

  constructor(options = {}) {
    super(options)

    // setTimeout(() => this.subApps.actionEditor.render(true), 2000)
    // setTimeout(() => this.subApps.itemEditor.render(true), 2000)
  }

  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--weapon-sheet"],
    window: {
      frame: true,
      positioned: true,
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
    actions: {
      "edit-item": this.editItem,
      "edit-actions": this.editActions,
      "edit-effect": this._onEditEffect,
      "toggle-effect": this._onToggleEffect,
      "delete-effect": this._onDeleteEffect,
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
  }

  get title() {
    const {
      name,
      system: { weaponBonus },
    } = this.document
    const bonusString = weaponBonus ? `, ${signNumber(weaponBonus)}` : ""
    return `${name}${bonusString}`
  }

  // === Rendering =============================================================

  async _prepareFormattedFields() {
    return {
      flavorText: await TextEditor.enrichHTML(this.document.system.flavorText),
      description: await TextEditor.enrichHTML(
        this.document.system.description,
      ),
    }
  }

  // --- Sub apps --------------------------------------------------------------
  static SUB_APPS = { actionEditor: ActionEditor, itemEditor: BAGSWeaponEditor }

  // === Events ================================================================

  static editItem() {
    this.subApps.itemEditor.render(true)
  }

  static editActions() {
    this.subApps.actionEditor.render(true)
  }
}
