/**
 * @file The character sheet -- the primary UI for a player character.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

export default class BAGSCharacterSheet extends HandlebarsApplicationMixin(
  ActorSheetV2
) {
  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(ActorSheetV2.DEFAULT_OPTIONS, {
      id: "character-{id}",
      classes: [
        "application--bags",
        "application--sheet",
        "application--hide-title",
        "application--actor-sheet",
        "application--character-sheet",
      ],
      tag: "form",
      window: {
        frame: true,
        positioned: true,
        icon: "fa-flag",
        minimizable: true,
        resizable: true,
        contentTag: "section",
        contentClasses: [],
      },
      form: {
        handler: undefined,
        submitOnChange: true,
      },
    })
  }

  static TEMPLATE_ROOT = `${SYSTEM_TEMPLATE_PATH}/character`

  static get PARTS() {
    return {
      // header: {
      //   template: `${SYSTEM_TEMPLATE_PATH}/character/header.hbs`,
      // },
      "left-rail": {
        template: `${SYSTEM_TEMPLATE_PATH}/character/left-rail.hbs`,
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
      description: {
        template: `${SYSTEM_TEMPLATE_PATH}/character/content.hbs`,
      },
      svg: {
        template: `${SYSTEM_TEMPLATE_PATH}/svg-filters.hbs`,
      },
    }
  }

  /** @override */
  async _prepareContext(_options) {
    const doc = this.document
    return {
      actor: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      tabs: this.#getTabs(),
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document
    switch (partId) {
    }
    return context
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
      abilities: {
        id: "abilities",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "Abilities",
        cssClass: "tab--advancement",
      },
      inventory: {
        id: "inventory",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "Inventory",
        cssClass: "tab--effects",
      },
      spelllist: {
        id: "spelllist",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "Spell List",
        cssClass: "tab--effects",
      },
      description: {
        id: "description",
        group: "sheet",
        icon: "fa-solid fa-tag",
        label: "Description",
        cssClass: "tab--effects",
      },
    }

    if (!this.document.itemTypes.spell.length) delete tabs.spelllist

    for (const v of Object.values(tabs)) {
      v.active = this.tabGroups[v.group] === v.id
      v.cssClass = v.active ? "active" : ""
    }
    return tabs
  }

  /**
   * Render the outer framing HTMLElement which wraps the inner HTML of the Application.
   *
   * This override modifies the default frame by adding the following:
   * - an alternative header: the existing elements in the header are moved
   *                          around into a format tha makes more sense for
   *                          our design.
   * - tab navigation:        if the sheet has tabs, to enforce consistency.
   * - an effects pane:       common UI for managing active effects on
   *                          actors and items
   *
   * @param {RenderOptions} options                 Options which configure application rendering behavior
   * @returns {Promise<HTMLElement>}
   * @protected
   * @override
   */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options)

    if (Object.keys(this.#getTabs()).length)
      frame.append(await this.#renderTabNavigation())

    frame.append(await this.#renderEffectsPane())

    // this.#reorganizeHeaderElements(frame)

    return frame
  }

  async #renderTabNavigation() {
    const container = document.createElement("template")
    container.innerHTML = await renderTemplate(
      `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
      {
        tabs: this.#getTabs(),
      }
    )
    return container.content.firstElementChild
  }

  /**
   * Given the window's frame, reconfigure its header to make it easier to style.
   * @param frame {HTMLElement}  The window frame
   */
  // async #reorganizeHeaderElements(frame) {
  //   console.info(frame.querySelector(".window-header"))
  // }

  async #renderEffectsPane() {
    const container = document.createElement("template")
    container.innerHTML = await renderTemplate(
      `${SYSTEM_TEMPLATE_PATH}/common/effects-pane.hbs`,
      { effects: this.document.effects }
    )

    return container.content.firstElementChild
  }

  /**
   * Change the active tab within a tab group in this Application instance.
   *
   * This override looks for tab content across the whole Application,
   * rather than solely in the content frame.
   *
   * @param {string} tab        The name of the tab which should become active
   * @param {string} group      The name of the tab group which defines the set of tabs
   * @param {object} [options]  Additional options which affect tab navigation
   * @param {Event} [options.event]                 An interaction event which caused the tab change, if any
   * @param {HTMLElement} [options.navElement]      An explicit navigation element being modified
   * @param {boolean} [options.force=false]         Force changing the tab even if the new tab is already active
   * @param {boolean} [options.updatePosition=true] Update application position after changing the tab?
   * @override
   */
  changeTab(
    tab,
    group,
    { event, navElement, force = false, updatePosition = true } = {}
  ) {
    if (!tab || !group)
      throw new Error("You must pass both the tab and tab group identifier")
    if (this.tabGroups[group] === tab && !force) return // No change necessary
    const tabElement = this.element.querySelector(
      `.tabs > [data-group="${group}"][data-tab="${tab}"]`
    )
    if (!tabElement)
      throw new Error(
        `No matching tab element found for group "${group}" and tab "${tab}"`
      )

    // Update tab navigation
    for (const t of this.element.querySelectorAll(
      `.tabs > [data-group="${group}"]`
    )) {
      t.classList.toggle("active", t.dataset.tab === tab)
    }

    // Update tab contents
    for (const section of this.element.querySelectorAll(
      `.tab[data-group="${group}"]`
    )) {
      section.classList.toggle("active", section.dataset.tab === tab)
    }
    this.tabGroups[group] = tab

    // Update automatic width or height
    if (!updatePosition) return
    const positionUpdate = {}
    if (this.options.position.width === "auto") positionUpdate.width = "auto"
    if (this.options.position.height === "auto") positionUpdate.height = "auto"
    if (!foundry.utils.isEmpty(positionUpdate)) this.setPosition(positionUpdate)
  }

  _onClickAction(event, target) {
    const { action } = target.dataset

    if (!action) return

    switch (action) {
      case "toggle-effects-pane":
        target
          .closest(".application")
          .querySelector(".application__effects-pane ul")
          .toggleAttribute("aria-hidden")
        break
      default:
        super._onClickAction(event, target)
    }
  }
}
