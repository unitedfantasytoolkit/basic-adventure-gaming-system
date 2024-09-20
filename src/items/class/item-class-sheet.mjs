import { SYSTEM_TEMPLATE_PATH } from "../../config/constants.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export default class BAGSCharacterClassSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(
      foundry.applications.sheets.ItemSheetV2.DEFAULT_OPTIONS,
      {
        id: "character-class-{id}",
        classes: ["application--bags", "application--character-class-sheet"],
        tag: "form",
        window: {
          frame: true,
          positioned: true,
          icon: "fa-flag",
          controls: [],
          minimizable: true,
          resizable: true,
          contentTag: "section",
          contentClasses: [],
        },
        form: {
          handler: undefined,
          submitOnChange: true,
        },
      },
    );
  }

  static TEMPLATE_ROOT = `${SYSTEM_TEMPLATE_PATH}/character-class`;

  static PARTS = {
    header: {
      template: `${this.TEMPLATE_ROOT}/header.hbs`,
    },
    "tab-navigation": {
      template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
    },
    description: {
      template: `${this.TEMPLATE_ROOT}/description.hbs`,
    },
    information: {
      template: `${this.TEMPLATE_ROOT}/class-details.hbs`,
    },
    xp: {
      template: `${this.TEMPLATE_ROOT}/xp-table.hbs`,
    },
    resources: {
      template: `${this.TEMPLATE_ROOT}/leveled-resources.hbs`,
    },
    features: {
      template: `${this.TEMPLATE_ROOT}/features.hbs`,
    },
    "svg-filters": {
      template: `${SYSTEM_TEMPLATE_PATH}/svg-filters.hbs`,
    },
  };

  tabGroups = {
    sheet: "description",
  };

  /** @override */
  async _prepareContext(_options) {
    const doc = this.document;
    return {
      actor: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      tabs: this.#getTabs(),
    };
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document;
    console.info(partId);
    switch (partId) {
      case "description":
        context.tab = context.tabs.description;
        break;
      case "features":
        context.tab = context.tabs.features;
        break;
      case "resources":
        context.tab = context.tabs.resources;
        break;
      case "xp":
        context.tab = context.tabs.xp;
        break;
      case "information":
        context.tab = context.tabs.information;
        break;
    }
    return context;
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {
      description: {
        id: "description",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Description",
      },
      information: {
        id: "information",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Information",
      },
      xp: {
        id: "xp",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.XP",
      },
      resources: {
        id: "resources",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Resources",
      },
      spellslots: {
        id: "spellslots",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.SpellSlots",
      },
      features: {
        id: "features",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Features",
      },
    };
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id;
      v.cssClass = v.active ? "active" : "";
    }
    return tabs;
  }
}
