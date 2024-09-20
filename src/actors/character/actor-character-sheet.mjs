import { SYSTEM_TEMPLATE_PATH } from "../../config/constants.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class BAGSCharacterSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(
      foundry.applications.sheets.ActorSheetV2.DEFAULT_OPTIONS,
      {
        id: "character-{id}",
        classes: ["application--bags", "application--character-sheet"],
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

  static get PARTS() {
    return {
      header: {
        template: `${SYSTEM_TEMPLATE_PATH}/character/header.hbs`,
      },
      "left-rail": {
        template: `${SYSTEM_TEMPLATE_PATH}/character/left-rail.hbs`,
      },
      "tab-navigation": {
        template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
      },
      summary: {
        template: `${SYSTEM_TEMPLATE_PATH}/character/content.hbs`,
      },
      abilities: {
        template: `${SYSTEM_TEMPLATE_PATH}/character/content.hbs`,
      },
      spells: {
        template: `${SYSTEM_TEMPLATE_PATH}/character/content.hbs`,
      },
      inventory: {
        template: `${SYSTEM_TEMPLATE_PATH}/character/content.hbs`,
      },
      effects: {
        template: `${SYSTEM_TEMPLATE_PATH}/character/content.hbs`,
      },
      description: {
        template: `${SYSTEM_TEMPLATE_PATH}/character/content.hbs`,
      },
      "svg-filters": {
        template: `${SYSTEM_TEMPLATE_PATH}/svg-filters.hbs`,
      },
    };
  }

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
    switch (
      partId
    ) {
    }
    return context;
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {
    };
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id;
      v.cssClass = v.active ? "active" : "";
    }
    return tabs;
  }
}
