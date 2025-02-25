import BAGSApplication from "../applications/application.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSBaseActorEditor extends BAGSApplication {
  // === App config ============================================================

  get title() {
    return game.i18n.format("BAGS.Actors.Editor.Title", {
      name: this.document.name,
    })
  }

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--editor"],
      window: {
        resizable: false,
      },
      position: {
        width: 540,
        height: "auto",
      },
      form: {
        handler: this.save,
        submitOnChange: true,
      },
    }
  }

  // --- Tabs ------------------------------------------------------------------

  tabGroups = {
    sheet: "details",
  }

  static TABS = {
    sheet: {
      tabs: [
        // @todo Delete this tab if the actor has no spells
        {
          id: "spells",
          group: "sheet",
          icon: "fa-solid fa-sparkle",
          label: "BAGS.Actors.Editor.Actions",
          cssClass: "tab--actions",
        },
        {
          id: "active-effects",
          group: "sheet",
          icon: "fa-solid fa-sitemap",
          label: "BAGS.Actors.Editor.Actions",
          cssClass: "tab--actions",
        },
        {
          id: "media",
          group: "sheet",
          icon: "fa-solid fa-image",
          label: "Media Settings",
          cssClass: "tab--media",
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
      labelPrefix: "BAGS.Actors.Character.Tabs",
    },
  }

  // --- App parts -------------------------------------------------------------

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/${this.DOCUMENT_TYPE}`
  }

  static TAB_PARTS = {}

  static get PARTS() {
    return {
      ...this.TAB_PARTS,
      spells: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/editor-tab-spell-list.hbs`,
      },
      "active-effects": {
        template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-effects.hbs`,
      },
      "class-and-abilities": {
        template: `${SYSTEM_TEMPLATE_PATH}/common/editor-tab-class-and-abilities.hbs`,
      },
      media: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/editor-tab-media.hbs`,
      },
      description: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
      },
    }
  }

  // === Rendering =============================================================

  /** @override */
  async _preparePartContext(partId, context) {
    super._preparePartContext(partId, context)

    const doc = this.document
    switch (partId) {
      case "description":
        context.headingText = "BAGS.Items.CommonTabs.Description"
        context.field =
          context.systemFields.biographicalDetails.fields.description
        context.fieldValue = doc.system.biographicalDetails.description
        break
      default:
        break
    }
    return context
  }

  // === Events ================================================================
  static async save(_event, _form, formData) {
    if (this._onSave) this._onSave(_event, _form, formData)
    else {
      await this.document.update(formData.object)
      this.render(true)
      if (this.document.sheet.visible) this.document.sheet.render(true)
    }
  }
}
