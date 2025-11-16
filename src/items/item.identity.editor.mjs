/**
 * @file A UI to edit an identity item's data
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSBaseItemEditor from "./item.editor.mjs"

export default class BAGSIdentityEditor extends BAGSBaseItemEditor {
  static DEFAULT_OPTIONS = {
    classes: ["application--identity-editor"],
    tag: "form",
    window: {
      frame: true,
      positioned: true,
      controls: [],
      minimizable: false,
      resizable: false,
      contentTag: "section",
      contentClasses: [],
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
    position: {
      width: 500,
      height: "auto",
    },
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/identity`
  }

  static PARTS = {
    details: {
      template: `${this.TEMPLATE_ROOT}/details.edit.hbs`,
    },
    restrictions: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
    },
    media: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/editor-tab-media.hbs`,
    },
    description: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
    },
    "flavor-text": {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
    },
  }

  /** @override */
  get title() {
    return `Identity Editor: ${this.document.name}`
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document

    switch (partId) {
      case "details":
        context.prerequisites = await this._preparePrerequisites()
        break
      case "restrictions":
        context.headingText = "BAGS.Identity.Editor.Tabs.Restrictions"
        context.field = context.systemFields.restrictions
        context.fieldValue = doc.system.restrictions
        break
      case "description":
        context.headingText = "BAGS.Items.CommonTabs.Description"
        context.field = context.systemFields.description
        context.fieldValue = doc.system.description
        break
      case "flavor-text":
        context.headingText = "BAGS.Items.CommonTabs.FlavorText"
        context.field = context.systemFields.flavorText
        context.fieldValue = doc.system.flavorText
        break
      default:
        break
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

    return Array.from(abilityScores.entries()).map(([key, config]) => ({
      key,
      label: config.label,
      value: this.document.system.prerequisites[key] || 0,
    }))
  }

  tabGroups = {
    sheet: "details",
  }

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-list-check",
          label: "BAGS.Identity.Editor.Tabs.Details",
          cssClass: "tab--details",
        },
        {
          id: "restrictions",
          group: "sheet",
          icon: "fa-solid fa-scroll",
          label: "BAGS.Identity.Editor.Tabs.Restrictions",
          cssClass: "tab--with-text-editor",
        },
        {
          id: "media",
          group: "sheet",
          icon: "fa-solid fa-image",
          label: "BAGS.Identity.Editor.Tabs.Media",
          cssClass: "tab--media",
        },
        {
          id: "flavor-text",
          group: "sheet",
          icon: "fa-solid fa-feather-pointed",
          label: "BAGS.Identity.Editor.Tabs.FlavorText",
          cssClass: "tab--with-text-editor",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-scroll-old",
          label: "BAGS.Identity.Editor.Tabs.Description",
          cssClass: "tab--with-text-editor",
        },
      ],
      initial: "details",
      labelPrefix: "BAGS.Identity.Editor.Tabs",
    },
  }

  // === Events ================================================================
  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
    this.render(true)
    if (this.document.sheet.visible) this.document.sheet.render(true)
  }
}
