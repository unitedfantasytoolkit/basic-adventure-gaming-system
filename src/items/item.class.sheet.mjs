import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSCharacterClassXPTableEditor from "./item.character-class.xp-table-editor.mjs"
import BAGSCharacterClassDetailsEditor from "./item.character-class.details-editor.mjs"
import BAGSBaseItemSheet from "../common/item.sheet.mjs"

export default class BAGSCharacterClassSheet extends BAGSBaseItemSheet {
  static SUB_APPS = {
    xp: BAGSCharacterClassXPTableEditor,
    details: BAGSCharacterClassDetailsEditor,
  }

  constructor(options = {}) {
    super(options)

    console.info(this.subApps)

    // this.#xpTableEditor = new BAGSCharacterClassXPTableEditor({
    //   document: this.document,
    // })
    // this.#detailsEditor = new BAGSCharacterClassDetailsEditor({
    //   document: this.document,
    // })
  }

  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(
      foundry.applications.sheets.ItemSheetV2.DEFAULT_OPTIONS,
      {
        id: "character-class-{id}",
        classes: [
          "application--bags",
          "application--sheet",
          "application--hide-title",
          "application--item-sheet",
          "application--character-class-sheet",
        ],
        tag: "form",
        window: {
          frame: true,
          positioned: true,
          icon: "fa-regular fa-circle-star",
          // window-icon fa-fw fa-regular fa-game-board
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
          ],
          minimizable: true,
          resizable: true,
          contentTag: "section",
          contentClasses: [],
        },
        form: {
          handler: this.save,
          submitOnChange: true,
        },
        position: {
          width: 640,
          height: 480,
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
  // async _renderFrame(options) {
  //   let tabNav
  //   let expandedHeader
  //   let effectsPane
  //   const frame = await super._renderFrame(options)

  //   if (Object.keys(this.#getTabs()).length) {
  //     const tabNavContainer = document.createElement("template")
  //     tabNavContainer.innerHTML = await renderTemplate(
  //       `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
  //       {
  //         tabs: this.#getTabs(),
  //       }
  //     )
  //     tabNav = tabNavContainer.content.firstElementChild
  //     console.info(tabNavContainer)
  //     console.info(tabNav)
  //     if (tabNav) frame.append(tabNav)
  //   }

  //   console.info(this.#getTabs(), tabNav)

  //   return frame
  // }

  /**
   * Change the active tab within a tab group in this Application instance.
   *
   * This override looks for tab content across the whole Application,
   * rather than solely in the content frame.
   * @param {string} tab - The name of the tab which should become active
   * @param {string} group - The name of the tab group which defines the set of tabs
   * @param {object} [options] - Additional options which affect tab navigation
   * @param {Event} [options.event] - An interaction event which caused the tab change, if any
   * @param {HTMLElement} [options.navElement] - An explicit navigation element being modified
   * @param {boolean} [options.force=false] - Force changing the tab even if the new tab is already active
   * @param {boolean} [options.updatePosition=true] - Update application position after changing the tab?
   * @override
   */
  // changeTab(
  //   tab,
  //   group,
  //   { event, navElement, force = false, updatePosition = true } = {}
  // ) {
  //   if (!tab || !group)
  //     throw new Error("You must pass both the tab and tab group identifier")
  //   if (this.tabGroups[group] === tab && !force) return // No change necessary
  //   const tabElement = this.element.querySelector(
  //     `.tabs > [data-group="${group}"][data-tab="${tab}"]`
  //   )
  //   if (!tabElement)
  //     throw new Error(
  //       `No matching tab element found for group "${group}" and tab "${tab}"`
  //     )

  //   // Update tab navigation
  //   for (const t of this.element.querySelectorAll(
  //     `.tabs > [data-group="${group}"]`
  //   )) {
  //     t.classList.toggle("active", t.dataset.tab === tab)
  //   }

  //   // Update tab contents
  //   for (const section of this.element.querySelectorAll(
  //     `.tab[data-group="${group}"]`
  //   )) {
  //     section.classList.toggle("active", section.dataset.tab === tab)
  //   }
  //   this.tabGroups[group] = tab

  //   // Update automatic width or height
  //   if (!updatePosition) return
  //   const positionUpdate = {}
  //   if (this.options.position.width === "auto") positionUpdate.width = "auto"
  //   if (this.options.position.height === "auto") positionUpdate.height = "auto"
  //   if (!foundry.utils.isEmpty(positionUpdate)) this.setPosition(positionUpdate)
  // }
}
