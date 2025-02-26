/**
 * @file The UI for viewing and editiing an ability Item.
 */
import BAGSBaseItemSheet from "./item.sheet.mjs"
import BAGSActiveEffectEditor from "../applications/active-effects.editor.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

export default class BAGSAbilitySheet extends BAGSBaseItemSheet {
  static SUB_APPS = []

  static DOCUMENT_TYPE = "ability"

  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {})
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
        id: "active-description",
        group: "sheet",
        icon: "fa-solid fa-scroll-old",
        label: "BAGS.Actions.Editor.Tabs.Description",
      },
    ]
  }
}
