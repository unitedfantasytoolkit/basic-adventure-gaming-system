/**
 * @file The character sheet -- the primary UI for a player character.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import animatedSheetError from "../utils/animated-sheet-error.mjs"
import sortDocuments from "../utils/sort-documents.mjs"

const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

export default class BAGSCharacterSheet extends HandlebarsApplicationMixin(
  ActorSheetV2,
) {
  static INVENTORY_SORT_MODES = {
    NAME_ASCENDING: 0,
    NAME_DESCENDING: 1,
    ENCUMBRANCE_DESCENDING: 2,
    ENCUMBRANCE_ASCENDING: 3,
    VALUE_DESCENDING: 4,
    VALUE_ASCENDING: 5,
  }

  #inventorySortMode = BAGSCharacterSheet.INVENTORY_SORT_MODES.NAME_ASCENDING

  static get DEFAULT_OPTIONS() {
    return {
      id: "character-{id}",
      classes: [
        "application--bags",
        "application--sheet",
        // "application--hide-title",
        "application--actor-sheet",
        "application--character-sheet",
      ],
      tag: "form",
      window: {
        frame: true,
        positioned: true,
        minimizable: true,
        resizable: true,
        contentTag: "section",
        contentClasses: [],
      },
      form: {
        handler: undefined,
        submitOnChange: true,
      },
      actions: {
        "use-character-action": this.#onCharacterAction,
      },
    }
  }

  static async #onCharacterAction(e) {
    const el = e.target.closest("[data-action-id]")
    if (!el) return
    const { actionId } = el.dataset
    const action = this.actor.system.actions.find((a) => a.id === actionId)
    await this.actor.resolveAction(action)
  }

  static TEMPLATE_ROOT = `${SYSTEM_TEMPLATE_PATH}/character`

  static get PARTS() {
    return {
      "left-rail": {
        template: `${this.TEMPLATE_ROOT}/left-rail.hbs`,
      },
      summary: {
        template: `${this.TEMPLATE_ROOT}/summary.hbs`,
      },
      abilities: {
        template: `${this.TEMPLATE_ROOT}/content.hbs`,
      },
      spells: {
        template: `${this.TEMPLATE_ROOT}/spells.hbs`,
      },
      inventory: {
        template: `${this.TEMPLATE_ROOT}/inventory.hbs`,
      },
      description: {
        template: `${this.TEMPLATE_ROOT}/identity.hbs`,
      },
      tabs: {
        template: `${SYSTEM_TEMPLATE_PATH}/common/tabs.hbs`,
      },
    }
  }

  /**
   * Provide context to the templating engine.
   * @override
   */
  async _prepareContext() {
    const context = await super._prepareContext()
    if (!this.actor.items.documentsByType.spell.length)
      delete context.tabs.spells

    const doc = this.document
    return {
      ...context,
      actor: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      // tabs: this.#getTabs(),
    }
  }

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document

    const encumbranceSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ENCUMBRANCE,
      )

    switch (partId) {
      case "left-rail":
        context.classes = doc.itemTypes.class.map((cls) => ({
          ...cls,
          xpBar: {
            current: cls.system.xp,
            max: cls.system.xpTable[cls.system.level - 1].value,
          },
        }))
        context.hp = doc.system.hp
        context.savingThrowLocaleStrings =
          CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
            CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
          )?.savingThrows
        context.usesDescendingAC =
          CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
            CONFIG.BAGS.SystemRegistry.categories.COMBAT,
          )?.descending

        context.encumbranceMeter = encumbranceSettings.encumbranceMeter(
          doc.system,
        )
        break
      case "summary":
        break
      case "abilities":
        context.abilities = this.actor.items.documentsByType.ability
        break
      case "spells":
        context.abilities = this.actor.items.documentsByType.spell
        break
      case "inventory":
        context.weapons =
          this.actor.items.documentsByType.weapon.sort(sortDocuments)
        context.armor =
          this.actor.items.documentsByType.armor.sort(sortDocuments)
        context.items =
          this.actor.items.documentsByType.item.sort(sortDocuments)
        context.inventory = [
          ...context.weapons,
          ...context.armor,
          ...context.items,
        ].sort(sortDocuments())
        context.sortMode = this.#inventorySortMode
        break
      case "description":
        break
      default:
        break
    }

    context.tab = context.tabs[partId] || null

    // context.tab = this.#getTabs()[partId]
    return context
  }

  tabGroups = {
    sheet: "summary",
  }

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "summary",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.CharacterClass.Tabs.Summary",
          cssClass: "tab--summary",
        },
        {
          id: "abilities",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "Abilities",
          cssClass: "tab--advancement",
        },
        {
          id: "inventory",
          group: "sheet",
          icon: "fa-solid fa-backpack",
          label: "Inventory",
          cssClass: "tab--effects",
        },
        {
          id: "spells",
          group: "sheet",
          icon: "fa-solid fa-sparkle",
          label: "Spell List",
          cssClass: "tab--effects",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-scroll-old",
          label: "Character Identity",
          cssClass: "tab--effects",
        },
      ],
      initial: "summary",
      labelPrefix: "BAGS.Actors.Character.Tabs",
    },
  }

  // /**
  //  * Prepare an array of form header tabs.
  //  * @returns {Record<string, Partial<ApplicationTab>>}
  //  */
  // #getTabs() {
  //   const tabs = {
  //     summary: {
  //       id: "summary",
  //       group: "sheet",
  //       icon: "fa-solid fa-square-list",
  //       label: "BAGS.CharacterClass.Tabs.Summary",
  //       cssClass: "tab--summary",
  //     },
  //     abilities: {
  //       id: "abilities",
  //       group: "sheet",
  //       icon: "fa-solid fa-tag",
  //       label: "Abilities",
  //       cssClass: "tab--advancement",
  //     },
  //     inventory: {
  //       id: "inventory",
  //       group: "sheet",
  //       icon: "fa-solid fa-backpack",
  //       label: "Inventory",
  //       cssClass: "tab--effects",
  //     },
  //     spells: {
  //       id: "spells",
  //       group: "sheet",
  //       icon: "fa-solid fa-sparkle",
  //       label: "Spell List",
  //       cssClass: "tab--effects",
  //     },
  //     description: {
  //       id: "description",
  //       group: "sheet",
  //       icon: "fa-solid fa-scroll-old",
  //       label: "Character Identity",
  //       cssClass: "tab--effects",
  //     },
  //   }
  //
  //   if (!this.document.itemTypes.spell.length) delete tabs.spells
  //
  //   return Object.values(tabs)
  //     .map((v) => ({
  //       ...v,
  //       active: this.tabGroups[v.group] === v.id,
  //       cssClass: v.active ? "active" : "",
  //     }))
  //     .reduce((obj, curr) => ({ ...obj, [curr.id]: curr }), {})
  // }

  get title() {
    return this.actor.name
  }

  /**
   * Render the outer framing HTMLElement which wraps the inner HTML of
   * the Application.
   *
   * This override modifies the default frame by adding the following:
   * - an alternative header: the existing elements in the header are moved
   *   around into a format tha makes more sense for our design.
   * - tab navigation: if the sheet has tabs, to enforce consistency.
   * - an effects pane: a common UI for managing active effects on
   *   actors and items
   * @param {unknown} options - Options which configure application rendering
   * behavior. See {RenderOptions} in Foundry's types.
   * @returns {Promise<HTMLElement>} The updated app frame
   * @protected
   * @override
   */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options)
    this.#reorganizeHeaderElements(frame)
    return frame
  }

  _onRender(context, options) {
    super._onRender(context, options)

    if (options.parts.includes("inventory")) {
      new SearchFilter({
        inputSelector: "search input",
        contentSelector: ".character-sheet-inventory .item-grid",
        callback: this._onFilterInventory.bind(this),
        initial: this.element.querySelector("search input").value,
      }).bind(this.element)
    }
  }

  /**
   * Given the window's frame, mutate its header to make it easier to style.
   * @param {HTMLElement} frame - The window frame
   */
  async #reorganizeHeaderElements(frame) {
    const header = frame.querySelector(".window-header")
    const title = frame.querySelector(".window-title")

    const buttons = header.querySelectorAll("button")

    const buttonContainer = document.createElement("div")
    buttonContainer.classList.add("window-buttons")

    const actorArt = document.createElement("img")
    actorArt.src = this.document.img

    buttons.forEach((b) => buttonContainer.appendChild(b))

    header.appendChild(title)
    header.appendChild(actorArt)
    header.appendChild(buttonContainer)
  }

  /**
   * A handler for dropping actors onto the sheet.
   * @param {DragEvent} event - The browser event fired when dropping the item
   * @param {unknown} doc - The Foundry Actor to handle
   * @returns {Promise<unknown>} The dropped actor, if associating it works.
   */
  async _onDropActor(event, doc) {
    switch (doc.type) {
      case "character":
        this.#onDropCharacter(doc)
        break
      case "monster":
        this.#onDropMonster(doc)
        break
      case "mount":
        this.#onDropMount(doc)
        break
      default:
        this._onDropActor(doc)
        break
    }
  }

  async #onDropCharacter(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropMonster(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropMount(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropSpell(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropAbility(doc) {
    this.document.createEmbeddedDocuments("Item", [doc])
  }

  async #onDropCharacterClass(doc) {
    if (this.document.itemTypes.class.length)
      animatedSheetError(this.element, "A character may only have one class.")
    else this.document.createEmbeddedDocuments("Item", [doc])
  }

  async #onDropWeapon(doc) {
    this.document.createEmbeddedDocuments("Item", [doc])
  }

  async #onDropArmor(doc) {
    this.document.createEmbeddedDocuments("Item", [doc])
  }

  // TODO: Add onto an existing stack, if one exists.
  async #onDropMiscellaneous(doc) {
    this.document.createEmbeddedDocuments("Item", [doc])
  }

  /**
   * A handler for dropping items onto the sheet.
   * @param {DragEvent} event - The browser event fired when dropping the item
   * @param {unknown} doc - The Foundry Item to handle
   * @todo handle duplicate items on types with quantities
   * @todo handle duplicate items on types that shouldn't have copies
   * @returns {Promise<unknown>} The dropped item, if creating it works.
   */
  async _onDropItem(event, doc) {
    if (!this.actor.isOwner) return false

    // TODO: Handle containers
    if (this.actor.uuid === doc.parent?.uuid)
      return this._onSortItem(event, doc)

    switch (doc.type) {
      case "class":
        return this.#onDropCharacterClass(doc)
      case "spell":
      case "ability":
      case "weapon":
      case "armor":
      case "item":
      default:
        return super._onDropItem(event, doc)
    }
  }

  _onFilterInventory(event, query, rgx, html) {
    const ids = new Set()
    const options = {}

    // Match entries and folders.
    if (query) this._matchSearchItems(rgx, ids, options)

    html
      .querySelectorAll(".item-grid--inventory uft-item-tile")
      .forEach((el) => {
        if (el.hidden) return
        el.classList.toggle("filtered", query && !ids.has(el.dataset.itemId))
      })
  }

  _matchSearchItems(query, entryIds) {
    this.actor.items.contents.forEach((entry) => {
      if (query.test(SearchFilter.cleanQuery(entry.name))) {
        entryIds.add(entry.id)
      }
    })
  }
}
