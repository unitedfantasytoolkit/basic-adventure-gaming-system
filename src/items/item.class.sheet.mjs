import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSCharacterClassXPTableEditor from "./item.character-class.xp-table-editor.mjs"
import BAGSCharacterClassDetailsEditor from "./item.character-class.details-editor.mjs"
import BAGSActiveEffectEditor from "../applications/active-effects.editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"

export default class BAGSCharacterClassSheet extends BAGSBaseItemSheet {
  static SUB_APPS = {
    xp: BAGSCharacterClassXPTableEditor,
    details: BAGSCharacterClassDetailsEditor,
    activeEffectEditor: BAGSActiveEffectEditor,
  }

  constructor(options = {}) {
    super(options)

    // this.#xpTableEditor = new BAGSCharacterClassXPTableEditor({
    //   document: this.document,
    // })
    // this.#detailsEditor = new BAGSCharacterClassDetailsEditor({
    //   document: this.document,
    // })
  }

  static DEFAULT_OPTIONS = {
    classes: ["application--character-class-sheet"],
    window: {
      icon: "fa-regular fa-circle-star",
      controls: [
        {
          action: "edit-xp-table",
          icon: "fa-solid fa-table",
          label: "BAGS.CharacterClass.XPTable.ActionLabel",
          ownership: "OWNER",
        },
        {
          action: "edit-details",
          icon: "fa-solid fa-pencil",
          label: "BAGS.CharacterClass.Information.ActionLabel",
          ownership: "OWNER",
        },
        {
          action: "edit-active-effects",
          icon: "fa-solid fa-sparkles",
          label: "Manage Active Effects",
          ownership: "OWNER",
        },
      ],
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
    position: {
      width: 640,
      height: 480,
    },
  }
  static async save(_event, _form, formData) {
    // console.info(this, event, form, formData);
    await this.document.update(formData.object)
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/character-class`
  }

  static get PARTS() {
    return {
      header: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/header.hbs`,
      },
      summary: {
        template: `${this.TEMPLATE_ROOT}/main.hbs`,
      },
      advancement: {
        template: `${this.TEMPLATE_ROOT}/xp-table.view.hbs`,
      },
      "tab-navigation": {
        template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
      },
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    console.log(partId, context)
    switch (partId) {
      case "header":
        // context.shouldShowFlavorText =
        //   !!doc.system.flavorText && this.tabGroups.sheet === "summary"
        // console.log(context)
        context.title = doc.name
        break
      case "summary":
        context.tab = context.tabs.find(({ id }) => id === "summary")
        break
      case "advancement":
        context.tab = context.tabs.find(({ id }) => id === "advancement")
        context.tab = context.tabs.advancement
        break
      case "effects":
        context.tab = context.tabs.find(({ id }) => id === "effects")
        context.tab = context.tabs.effects
        break
      default:
        break
    }
    return context
  }

  /** @override */
  async _prepareContext(_options) {
    const { TextEditor } = foundry.applications.ux
    const doc = this.document

    const gearTable = doc.system.gearTable
      ? await TextEditor.enrichHTML(
          fromUuidSync(doc.system.gearTable)._createDocumentLink(),
        )
      : ""

    const context = await super._prepareContext(_options)

    return {
      ...context,
      formattedSystem: {
        gearTable,
      },
    }
  }

  _onClickAction(event, target) {
    const { action } = target.dataset

    if (!action) return

    switch (action) {
      case "edit-xp-table":
        this.subApps.xp.render(true)
        break
      case "edit-details":
        this.subApps.details.render(true)
        break
      default:
        super._onClickAction(event, target)
        break
    }
  }

  close() {
    this.subApps.xp.close()
    this.subApps.details.close()
    return super.close()
  }

  tabGroups = {
    sheet: "summary",
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  static TABS = [
    {
      id: "summary",
      group: "sheet",
      icon: "fa-solid fa-tag",
      label: "BAGS.CharacterClass.Tabs.Summary",
      cssClass: "tab--summary",
    },
    {
      id: "advancement",
      group: "sheet",
      icon: "fa-solid fa-tag",
      label: "BAGS.CharacterClass.Tabs.Advancement",
      cssClass: "tab--advancement",
    },
    {
      id: "effects",
      group: "sheet",
      icon: "fa-solid fa-tag",
      label: "BAGS.CharacterClass.Tabs.Effects",
      cssClass: "tab--effects",
    },
  ]
}
