import BAGSApplication from "../applications/application.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSBaseActorEditor extends BAGSApplication {
  // === App config ============================================================

  get title() {
    return game.i18n.format("BAGS.Actors.Common.Editor.Title", {
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

  /**
   * Which tab each group opens on.
   *
   * Setting this here rather than through each subclass's `TABS.initial` is
   * load-bearing in a way that's easy to miss: `_prepareTabs` only applies
   * `initial` when `tabGroups` has no entry for the group yet, so an instance
   * field declared on this class wins over every subclass's `initial`. Any
   * subclass whose tab list doesn't include the tab named here has to override
   * this, or it opens on a tab it has no navigation for and shows nothing.
   * @see {@link ./actor.monster.editor.mjs}
   */
  tabGroups = {
    sheet: "class-and-abilities",
  }

  static TABS = {
    sheet: {
      tabs: [
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

  // Classes belong to characters, so the class tab is declared by the character
  // editor rather than here. While it lived on this class every actor editor
  // rendered it, including the monster editor, which has no tab to reach it by.
  static get PARTS() {
    return {
      ...this.TAB_PARTS,
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
