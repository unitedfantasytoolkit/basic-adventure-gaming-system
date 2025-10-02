/**
 * @file A UI to edit a class's non-leveled data
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSBaseItemEditor from "./item.editor.mjs"

export default class CharacterClassEditor extends BAGSBaseItemEditor {
  document

  constructor(options = {}) {
    super(options)
    this.document = options.document
  }

  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    classes: ["application--class-editor"],
    actions: {
      "clear-gear-table": this.clearGearTable,
    },
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
    return `${SYSTEM_TEMPLATE_PATH}/class`
  }

  static PARTS = {
    details: {
      template: `${this.TEMPLATE_ROOT}/class-details.edit.hbs`,
    },
    features: {
      template: `${this.TEMPLATE_ROOT}/features.edit.hbs`,
    },
    requisites: {
      template: `${this.TEMPLATE_ROOT}/prerequisites-and-prime-requisites.edit.hbs`,
    },
    /**
     * @todo use `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs` for
     * this field's template.
     */
    restrictions: {
      template: `${this.TEMPLATE_ROOT}/restrictions.edit.hbs`,
    },
    media: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-media.hbs`,
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
    return `Class Editor: ${this.document.name}`
  }

  // === Render setup ==========================================================
  /** @override */
  async _prepareFormattedFields() {
    const gearTableDocument = await fromUuid(this.document.system.gearTable)

    const gearTable = this.document.system.gearTable
      ? await foundry.applications.ux.TextEditor.enrichHTML(
          gearTableDocument._createDocumentLink(),
        )
      : ""

    return {
      gearTable,
    }
  }

  tabGroups = {
    sheet: "details",
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.CharacterClass.Tabs.Information",
        },
        {
          id: "features",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "BAGS.CharacterClass.Tabs.Features",
        },
        {
          id: "requisites",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "BAGS.CharacterClass.Tabs.Requisites",
        },
        {
          id: "restrictions",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "BAGS.CharacterClass.Tabs.Restrictions",
        },
        {
          id: "media",
          group: "sheet",
          icon: "fa-solid fa-image",
          label: "Media Settings",
          cssClass: "tab--media",
        },
        {
          id: "flavor-text",
          group: "sheet",
          icon: "fa-solid fa-feather-pointed",
          label: "Flavor Text",
          cssClass: "tab--with-text-editor",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-scroll-old",
          label: "Description",
          cssClass: "tab--with-text-editor",
        },
      ],
      initial: "details",
      labelPrefix: "BAGS.Items.CharacterClass.Tabs",
    },
  }

  static async clearGearTable() {
    await this.document.update({
      "system.gearTable": "",
    })
    this.render(true)
  }
}
