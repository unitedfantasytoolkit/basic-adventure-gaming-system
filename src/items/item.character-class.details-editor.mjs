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
    description: {
      template: `${this.TEMPLATE_ROOT}/description.edit.hbs`,
    },
    restrictions: {
      template: `${this.TEMPLATE_ROOT}/restrictions.edit.hbs`,
    },
    details: {
      template: `${this.TEMPLATE_ROOT}/class-details.edit.hbs`,
    },
    features: {
      template: `${this.TEMPLATE_ROOT}/features.edit.hbs`,
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
      ? await TextEditor.enrichHTML(gearTableDocument._createDocumentLink())
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
}
