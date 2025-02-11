import BAGSApplication from "../common/app.mjs"
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

/**
 * @todo Should we have a BAGSBaseItemEditor class?
 */
export default class BAGSWeaponEditor extends BAGSApplication {
  static TAB_PARTS = {}

  // === App config ============================================================

  get title() {
    return game.i18n.format("BAGS.Items.Weapon.Editor.Title", {
      name: this.document.name,
    })
  }

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--editor", "application--weapon-editor"],
      window: {
        resizable: false,
      },
      position: {
        width: 540,
        height: 600,
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
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.CharacterClass.Tabs.Summary",
          cssClass: "tab--summary",
        },
        {
          id: "identification",
          group: "sheet",
          icon: "fa-solid fa-square-question",
          label: "Identification",
          cssClass: "tab--identification",
        },
        {
          id: "container",
          group: "sheet",
          icon: "fa-solid fa-treasure-chest",
          label: "Container Settings",
          cssClass: "tab--container",
        },

        {
          id: "flavor-text",
          group: "sheet",
          icon: "fa-solid fa-feather-pointed",
          label: "Flavor Text",
          cssClass: "tab--flavor-text",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-scroll-old",
          label: "Description",
          cssClass: "tab--description",
        },
      ],
      initial: "details",
      labelPrefix: "BAGS.Actors.Character.Tabs",
    },
  }

  // --- App parts -------------------------------------------------------------

  static TEMPLATE_ROOT = `${SYSTEM_TEMPLATE_PATH}/weapon`

  static get PARTS() {
    return {
      details: {
        template: `${this.TEMPLATE_ROOT}/details.hbs`,
      },
      identification: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-identification-settings.hbs`,
      },
      container: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-container-settings.hbs`,
      },
      description: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/sheet-tab-text-editor.hbs`,
      },
      "flavor-text": {
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
        context.headingText = "BAGS.Items.Weapon.Tabs.Description"
        context.field = context.systemFields.description
        context.fieldValue = doc.system.description
        break
      case "flavor-text":
        context.headingText = "BAGS.Items.Weapon.Tabs.FlavorText"
        context.field = context.systemFields.flavorText
        context.fieldValue = doc.system.flavorText
        break
      default:
        break
    }
    return context
  }

  // === Events ================================================================
  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
    this.render(true)
    this.document.sheet.render(true)
  }
}
