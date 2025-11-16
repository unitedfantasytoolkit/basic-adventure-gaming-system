/**
 * @file The UI for viewing an identity Item.
 */
import BAGSBaseItemSheet from "./item.sheet.mjs"
import BAGSIdentityEditor from "./item.identity.editor.mjs"
import ActionEditor from "../applications/action-editor.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

export default class BAGSIdentitySheet extends BAGSBaseItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["application--identity-sheet"],
    window: {
      controls: [
        {
          action: "edit-item",
          icon: "fa-solid fa-pencil",
          label: "BAGS.Identity.Information.ActionLabel",
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

  static DOCUMENT_TYPE = "identity"

  static SUB_APPS = {
    actionEditor: ActionEditor,
    itemEditor: BAGSIdentityEditor,
  }

  static get PARTS() {
    return {
      summary: {
        template: `${this.TEMPLATE_ROOT}/main.hbs`,
      },
      actions: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/actions.view.hbs`,
      },
      ...super.TAB_PARTS,
    }
  }

  tabGroups = {
    sheet: "summary",
  }

  /** @override */
  async _preparePartContext(partId, context) {
    super._preparePartContext(partId, context)
    const doc = this.document

    switch (partId) {
      case "summary":
        context.prerequisites = await this._preparePrerequisites()
        break
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
   * Prepare prerequisites data for rendering.
   * @returns {Array} Array of prerequisite data
   */
  async _preparePrerequisites() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )
    const abilityScores = abilityScoreSettings?.abilityScores || new Map()

    return Array.from(abilityScores.entries())
      .map(([key, config]) => ({
        key,
        label: config.label,
        value: this.document.system.prerequisites[key] || 0,
      }))
      .filter((p) => p.value > 0)
  }

  /**
   * Tabs for the Identity sheet.
   * @returns {SheetNavTab[]} The tabs to display
   */
  static get TABS() {
    return {
      sheet: {
        tabs: [
          {
            id: "summary",
            group: "sheet",
            icon: "fa-solid fa-square-list",
            label: "BAGS.Identity.Tabs.Summary",
            cssClass: "tab--summary",
          },
          {
            id: "actions",
            group: "sheet",
            icon: "fa-solid fa-sparkles",
            label: "BAGS.Identity.Tabs.Actions",
            cssClass: "tab--actions",
          },
        ],
        initial: "summary",
        labelPrefix: "BAGS.Identity.Tabs",
      },
    }
  }
}
