/**
 * @file The base class for applications in this system.
 */
import { html } from "../components/utils.mjs";

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
  foundry.applications.sheets.ItemSheetV2
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
      {}
    )
  }

  static DOCUMENT_TYPE = "item"

  static TABS = []

  static CLASSES_WINDOW = []

  static CLASSES_CONTENT = []

  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(
      foundry.applications.sheets.ItemSheetV2.DEFAULT_OPTIONS,
      {
        id: `${DOCUMENT_TYPE}-{id}`,
        classes: [
          "application--bags",
          "application--sheet",
          "application--item-sheet",
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
      }
    ) 
  }

  static async save(_event, _form, formData) {
    // console.info(this, event, form, formData);
    await this.document.update(formData.object)
  }

  #window = {
    title: undefined,
    icon: undefined,
    close: undefined,
    controls: undefined,
    controlsDropdown: undefined,
    onDrag: this.#onWindowDragMove.bind(this),
    onResize: this.#onWindowResizeMove.bind(this),
    pointerStartPosition: undefined,
    pointerMoveThrottle: false
  };

/**
   * Drag the Application position during mouse movement.
   * @param {PointerEvent} event
   */
  #onWindowDragMove(event) {
    if ( !this.#window.header.hasPointerCapture(event.pointerId) ) {
      this.#window.header.setPointerCapture(event.pointerId);
    }
    const delta = this.#onPointerMove(event);
    if ( !delta ) return;
    const { pointerStartPosition } = this.#window;
    let { top, left, height, width } = pointerStartPosition;
    left += delta.dx;
    top += delta.dy;
    this.setPosition({ top, left, height, width });
  }
 /**
   * Resize the Application during mouse movement.
   * @param {PointerEvent} event
   */
  #onWindowResizeMove(event) {
    if ( !this.#window.resize.hasPointerCapture(event.pointerId) ) {
      this.#window.resize.setPointerCapture(event.pointerId);
    }
    const delta = this.#onPointerMove(event);
    if ( !delta ) return;
    const { scale } = this.#position;
    const { pointerStartPosition } = this.#window;
    let { top, left, height, width } = pointerStartPosition;
    if ( width !== "auto" ) width += delta.dx / scale;
    if ( height !== "auto" ) height += delta.dy / scale;
    this.setPosition({ top, left, width, height });
  }


  
/**
 * Render the outer framing HTMLElement which wraps the inner HTML of the Application.
 * @param {RenderOptions} options                 Options which configure application rendering behavior
 * @returns {Promise<HTMLElement>}
 * @protected
 */
async _renderFrame(options) {
  const frame = document.createElement(this.options.tag);
  frame.id = this.options.id.replace("{id}", this.options.uniqueId);
  if ( this.options.classes.length ) frame.className = this.options.classes.join(" ");
  if ( !this.hasFrame ) return frame;

  // Window applications
  const labels = {
    controls: game.i18n.localize("APPLICATION.TOOLS.ControlsMenu"),
    toggleControls: game.i18n.localize("APPLICATION.TOOLS.ToggleControls"),
    close: game.i18n.localize("APPLICATION.TOOLS.Close")
  }
  const contentClasses = ["window-content", ...this.options.window.contentClasses].join(" ");
  frame.innerHTML = html`<header class="window-header">
    <i class="window-icon hidden"></i>
    <h1 class="window-title"></h1>
    <button type="button" class="header-control fa-solid fa-ellipsis-vertical"
            data-tooltip="${labels.toggleControls}" aria-label="${labels.toggleControls}"
            data-action="toggleControls"></button>
    <button type="button" class="header-control fa-solid fa-times"
            data-tooltip="${labels.close}" aria-label="${labels.close}" data-action="close"></button>
  </header>
  <menu class="controls-dropdown"></menu>
  <${this.options.window.contentTag} class="${contentClasses}"></section>
  ${this.options.window.resizable ? `<div class="window-resize-handle"></div>` : ""}`;

  // Reference elements
  this.#window.header = frame.querySelector(".window-header");
  this.#window.title = frame.querySelector(".window-title");
  this.#window.icon = frame.querySelector(".window-icon");
  this.#window.resize = frame.querySelector(".window-resize-handle");
  this.#window.close = frame.querySelector("button[data-action=close]");
  this.#window.controls = frame.querySelector("button[data-action=toggleControls]");
  this.#window.controlsDropdown = frame.querySelector(".controls-dropdown");
  return frame;
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
      summary: {
        template: `${this.TEMPLATE_ROOT}/main.hbs`,
      },
      advancement: {
        template: `${this.TEMPLATE_ROOT}/xp-table.view.hbs`,
      },
      // main: {
      //   template: `${this.TEMPLATE_ROOT}/main.hbs`,
      // },
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    console.log(partId)
    switch (partId) {
      case "header":
        context.shouldShowFlavorText =
          !!doc.system.flavorText && this.tabGroups.sheet === "summary"
        console.log(context)
        break
      case "summary":
        context.tab = context.tabs.summary
        break
      case "advancement":
        context.tab = context.tabs.advancement
        break
      case "effects":
        context.tab = context.tabs.effects
        break
      default:
        break
    }
    return context
  }

  /** @override */
  async _prepareContext(_options) {
    const doc = this.document

    const gearTable = doc.system.gearTable
      ? await TextEditor.enrichHTML(
          fromUuidSync(doc.system.gearTable)._createDocumentLink()
        )
      : ""

    return {
      item: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      systemFields: doc.system.schema.fields,
      formattedSystem: {
        gearTable,
      },
      tabs: this.#getTabs(),
    }
  }

  _onClickAction(event, target) {
    const { action } = target.dataset

    if (!action) return

    switch (action) {
      case "edit-xp-table":
        this.#xpTableEditor.render(true)
        break
      case "edit-details":
        this.#detailsEditor.render(true)
        break
      default:
        super._onClickAction(event, target)
        break
    }
  }

  close() {
    this.#detailsEditor.close()
    this.#xpTableEditor.close()
    return super.close()
  }

  tabGroups = {
    sheet: "summary",
  }

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {
      summary: {
        id: "summary",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Summary",
        cssClass: "tab--summary",
      },
      advancement: {
        id: "advancement",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Advancement",
        cssClass: "tab--advancement",
      },
      effects: {
        id: "effects",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "BAGS.CharacterClass.Tabs.Effects",
        cssClass: "tab--effects",
      },
    }
    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id
      v.cssClass = v.active ? "active" : ""
    }
    return tabs
  }
}
