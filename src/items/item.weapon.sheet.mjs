/**
 * @file The UI for viewing and editiing a weapon Item.
 */
import BAGSActionEditor from "../common/action-editor.mjs"
import BAGSBaseItemSheet from "../common/item.sheet.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSWeaponSheet extends BAGSBaseItemSheet {
  static SUB_APPS = []

  static DOCUMENT_TYPE = "weapon"

  static CSS_CLASSES_WINDOW = ["application--weapon-sheet"]

  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      classes: [...super.DEFAULT_OPTIONS.classes, ...this.CSS_CLASSES_WINDOW],
      actions: {
        addAction: this.onAddAction,
        editAction: this.onEditAction,
        deleteAction: this.onDeleteAction,
      },
    })
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

  static async onAddAction() {
    await this.document.createAction()
  }

  static onEditAction(event) {
    const { actionId } = event.target.closest("[data-action-id]").dataset
    const editor = new BAGSActionEditor(this.document, actionId)
    editor.render(true)
  }

  static async onDeleteAction(event) {
    await this.document.deleteAction(
      event.target.closest("[data-action-id]").dataset.actionId,
    )
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

  /**
   * Tabs for the Ability sheet.
   * @returns {SheetNavTab[]} The tabs to display, in the order they should be
   * displayed.
   */
  static get TABS() {
    return [
      ...BAGSBaseItemSheet.TABS,
      {
        id: "actions",
        group: "sheet",
        icon: "fa-solid fa-sparkles",
        label: "BAGS.Actions.TabLabel",
        cssClass: "tab--actions",
      },
      {
        id: "description",
        group: "sheet",
        icon: "fa-solid fa-scroll-old",
        label: "BAGS.Actions.Editor.Tabs.Description",
      },
    ]
  }
}
