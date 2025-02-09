/**
 * @file The UI for viewing and editiing a weapon Item.
 */
import ActionEditor from "../applications/action-editor.mjs"
import BAGSBaseItemSheet from "../common/item.sheet.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSWeaponSheet extends BAGSBaseItemSheet {
  static SUB_APPS = { actions: ActionEditor }

  static DOCUMENT_TYPE = "weapon"

  static DEFAULT_OPTIONS = {
    classes: ["application--weapon-sheet"],
    window: {
      frame: true,
      positioned: true,
      // icon: "fa-regular fa-sparkles",
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
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
  }

  static get TAB_PARTS() {
    return {
      ...BAGSBaseItemSheet.TAB_PARTS,
      actions: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/actions.view.hbs`,
      },
      description: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/description.hbs`,
      },
    }
  }

  #actionEditor

  constructor(options = {}) {
    super(options)

    this.#actionEditor = new ActionEditor({
      document: this.document,
    })
    // this.#itemEditor = new BAGSCharacterClassDetailsEditor({
    //   document: this.document,
    // })
    setTimeout(() => this.#actionEditor.render(true), 2000)
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    context.tab = context.tabs.find((t) => t.id === partId)
    switch (partId) {
      case "actions":
        context.actions = await Promise.all(
          doc.system.actions.map(async (a) => ({
            ...a,
            description: await TextEditor.enrichHTML(a.description),
          })),
        )
        break
      default:
        return super._preparePartContext(partId, context)
    }
    return context
  }

  static editItem() {}

  static editActions(e) {
    this.#actionEditor.render(true)
  }
}
