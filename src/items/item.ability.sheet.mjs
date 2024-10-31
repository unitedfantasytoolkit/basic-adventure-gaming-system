/**
 * @file The UI for viewing and editiing an ability Item.
 */
import BAGSActionEditor from "../common/action-editor.mjs"
import BAGSBaseItemSheet from "../common/item.sheet.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSAbilitySheet extends BAGSBaseItemSheet {
  static SUB_APPS = []

  static DOCUMENT_TYPE = "ability"

  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      actions: {
        addAction: this.#onAddAction,
        editAction: this.#onEditAction,
        deleteAction: this.#onDeleteAction,
      },
    })
  }

  static get TAB_PARTS() {
    return {
      ...BAGSBaseItemSheet.TAB_PARTS,
      actions: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/actions.view.hbs`,
      },
    }
  }

  tabGroups = {
    sheet: "actions",
  }

  static async #onAddAction() {
    await this.document.createAction()
  }

  static #onEditAction(event) {
    const { actionId } = event.target.closest("[data-action-id]").dataset
    const editor = new BAGSActionEditor(this.document, actionId)
    editor.render(true)
  }

  static async #onDeleteAction(event) {
    await this.document.deleteAction(
      event.target.closest("[data-action-id]").dataset.actionId
    )
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    context.tab = context.tabs.find((t) => t.id === partId)
    switch (partId) {
      case "actions":
        context.actions = doc.system.actions
        break
      default:
        return super._preparePartContext(partId, context)
    }
    return context
  }

  static get TABS() {
    return [
      ...BAGSBaseItemSheet.TABS,
      {
        id: "actions",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.Actions.TabLabel",
        cssClass: "tab--actions",
      },
    ]
  }
}
