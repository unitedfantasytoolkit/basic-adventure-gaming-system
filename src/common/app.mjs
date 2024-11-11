/**
 * @file The base class for applications in this system.
 */

// /**
//  * Render the outer framing HTMLElement which wraps the inner HTML of the Application.
//  * @param {RenderOptions} options                 Options which configure application rendering behavior
//  * @returns {Promise<HTMLElement>}
//  * @protected
//  */
// async _renderFrame(options) {
//   const frame = document.createElement(this.options.tag);
//   frame.id = this.#id;
//   if ( this.options.classes.length ) frame.className = this.options.classes.join(" ");
//   if ( !this.hasFrame ) return frame;

//   // Window applications
//   const labels = {
//     controls: game.i18n.localize("APPLICATION.TOOLS.ControlsMenu"),
//     toggleControls: game.i18n.localize("APPLICATION.TOOLS.ToggleControls"),
//     close: game.i18n.localize("APPLICATION.TOOLS.Close")
//   }
//   const contentClasses = ["window-content", ...this.options.window.contentClasses].join(" ");
//   frame.innerHTML = `<header class="window-header">
//     <i class="window-icon hidden"></i>
//     <h1 class="window-title"></h1>
//     <button type="button" class="header-control fa-solid fa-ellipsis-vertical"
//             data-tooltip="${labels.toggleControls}" aria-label="${labels.toggleControls}"
//             data-action="toggleControls"></button>
//     <button type="button" class="header-control fa-solid fa-times"
//             data-tooltip="${labels.close}" aria-label="${labels.close}" data-action="close"></button>
//   </header>
//   <menu class="controls-dropdown"></menu>
//   <${this.options.window.contentTag} class="${contentClasses}"></section>
//   ${this.options.window.resizable ? `<div class="window-resize-handle"></div>` : ""}`;

//   // Reference elements
//   this.#window.header = frame.querySelector(".window-header");
//   this.#window.title = frame.querySelector(".window-title");
//   this.#window.icon = frame.querySelector(".window-icon");
//   this.#window.resize = frame.querySelector(".window-resize-handle");
//   this.#window.close = frame.querySelector("button[data-action=close]");
//   this.#window.controls = frame.querySelector("button[data-action=toggleControls]");
//   this.#window.controlsDropdown = frame.querySelector(".controls-dropdown");
//   return frame;
// }

import { SYSTEM_TEMPLATE_PATH } from "../../config/constants.mjs"
import BAGSCharacterClassXPTableEditor from "./item-app-class-xp-table-editor.mjs"
import BAGSCharacterClassDetailsEditor from "./item-app-class-details-editor.mjs"

const { HandlebarsApplicationMixin } = foundry.applications.api

export default class BAGSApplication extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  static SUB_APPS = []

  get subApps() {
    return this.#subApps
  }

  static get HEADER_CONTROLS() {
    return []
  }

  #subApps = {}

  constructor(options = {}) {
    super(options)

    this.#subApps = this.constructor.SUB_APPS.reduce(
      (obj, App) => ({
        ...obj,
        [App.constructor.name]: new App(this.document),
      }),
      {},
    )
  }

  static TABS = []

  static CLASSES_WINDOW = []

  static CLASSES_CONTENT = []

  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(
      foundry.applications.sheets.ItemSheetV2.DEFAULT_OPTIONS,
      {
        id: "character-class-{id}",
        classes: [
          "application--bags",
          "application--sheet",
          "application--hide-title",
          ...this.CLASSES_WINDOW,
        ],
        window: {
          controls: this.HEADER_CONTROLS,
          minimizable: true,
          resizable: true,
          contentTag: "section",
          contentClasses: this.CLASSES_CONTENT,
        },
        form: {
          handler: this.save,
          submitOnChange: true,
        },
      },
    )
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
        template: `${this.TEMPLATE_ROOT}/header.hbs`,
      },
      "tab-navigation": {
        template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
      },
    }
  }

  /** @override */
  async _prepareContext(_options) {
    const doc = this.document

    return {
      document: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      systemFields: doc.system.schema.fields,
      formattedSystem: this.#prepareFormattedFields(),
      tabs: this.#getTabs(),
    }
  }

  #prepareFormattedFields() {
    return null
  }

  close() {
    this.#subApps.forEach((a) => a.close())
    return super.close()
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = { ...this.constructor.TABS }
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id
      v.cssClass = v.active ? "active" : ""
    }
    return tabs
  }
}
