/**
 * @file The character sheet -- the primary UI for a player character.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import animatedSheetError from "../utils/animated-sheet-error.mjs"

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
        // "application--hide-title",
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
        template: `${this.TEMPLATE_ROOT}/left-rail.hbs`,
      },
      summary: {
        template: `${this.TEMPLATE_ROOT}/summary.hbs`,
      },
      abilities: {
        template: `${this.TEMPLATE_ROOT}/content.hbs`,
      },
      spells: {
        template: `${this.TEMPLATE_ROOT}/content.hbs`,
      },
      inventory: {
        template: `${this.TEMPLATE_ROOT}/inventory.hbs`,
      },
      description: {
        template: `${this.TEMPLATE_ROOT}/content.hbs`,
      },
      tabs: {
        template: "templates/generic/tab-navigation.hbs",
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
      case "left-rail":
        context.classes = doc.itemTypes.class.map((cls) => ({
          ...cls,
          xpBar: {
            current: cls.system.xp,
            max: cls.system.xpTable[cls.system.level - 1].value,
          },
        }))
        context.hp = doc.system.hp
        break
      case "summary":
        context.tab = this.#getTabs()[partId]
        break
      case "abilities":
        context.tab = this.#getTabs()[partId]
        break
      case "spells":
        context.tab = this.#getTabs()[partId]
        break
      case "inventory":
        context.tab = this.#getTabs()[partId]
        break
      case "description":
        context.tab = this.#getTabs()[partId]
        break
      default:
        break
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
   *   around into a format tha makes more sense for our design.
   * - tab navigation: if the sheet has tabs, to enforce consistency.
   * - an effects pane: a common UI for managing active effects on
   *   actors and items
   * @param {unknown} options - Options which configure application rendering behavior. RenderOptions in Foundry's types.
   * @returns {Promise<HTMLElement>} The updated app frame
   * @protected
   * @override
   */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options)

    // if (Object.keys(this.#getTabs()).length)
    //   frame.append(await this.#renderTabNavigation())

    // frame.append(await this.#renderEncumbranceBar())
    // frame.append(await this.#renderEffectsPane())

    // this.#reorganizeHeaderElements(frame)

    return frame
  }

  _attachFrameListeners() {
    super._attachFrameListeners()

    // this.element.addEventListener("drop", this._onDropAction.bind(this))
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
   * Given the window's frame, mutate its header to make it easier to style.
   * @param {HTMLElement} frame - The window frame
   */
  async #reorganizeHeaderElements(frame) {
    const header = frame.querySelector(".window-header")
    const title = frame.querySelector(".window-title")

    const buttons = header.querySelectorAll("button")

    const titleContainer = document.createElement("div")
    titleContainer.classList.add("window-title-wrapper")

    const buttonContainer = document.createElement("div")
    buttonContainer.classList.add("window-buttons")

    const actorArt = document.createElement("img")
    actorArt.src = this.document.img

    titleContainer.appendChild(title)
    titleContainer.appendChild(actorArt)

    buttons.forEach((b) => buttonContainer.appendChild(b))

    header.appendChild(titleContainer)
    header.appendChild(buttonContainer)
  }

  async #renderEffectsPane() {
    const container = document.createElement("template")
    container.innerHTML = await renderTemplate(
      `${SYSTEM_TEMPLATE_PATH}/common/effects-pane.hbs`,
      { effects: this.document.effects }
    )

    return container.content.firstElementChild
  }

  // async #renderEncumbranceBar() {
  //   const container = document.createElement("template")
  //   container.innerHTML = `<uft-character-info-meter value="1200" max="1600" class="encumbrance"><i slot="icon" class="fa fa-weight-hanging"></i></uft-character-info-meter>`
  //   return container.content.firstElementChild
  // }

  async _onDropAction(event) {
    const { uuid } = TextEditor.getDragEventData(event)
    const droppedDocument = await fromUuid(uuid)
    switch (droppedDocument.documentName) {
      case "Actor":
        break
      default:
        console.warn("Only Actor and Item documents may be dropped!")
    }
    console.info(this, event, droppedDocument)
  }

  async _onDropActor(doc) {
    console.warn("Not yet implemented!")
        // switch (droppedDocument.type) {
        //   case "character":
        //     this.#onDropCharacter(droppedDocument)
        //     break
        //   case "monster":
        //     this.#onDropMonster(droppedDocument)
        //     break
        //   case "mount":
        //     this.#onDropMount(droppedDocument)
        //     break
        //   default:
        //     this._onDropActor(droppedDocument)
        //     break
        // }
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

  async #onDropWeapon(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropArmor(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropAmmunition(doc) {
    console.warn("Not yet implemented!")
  }

  async #onDropMiscellaneous(doc) {
    console.warn("Not yet implemented!")
  }

  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false
    const item = await Item.implementation.fromDropData(data)
    const itemData = item.toObject()

    if (this.actor.uuid === item.parent?.uuid)
      return this._onSortItem(event, itemData)

    console.info(item, itemData)
        // switch (droppedDocument.type) {
        //   case "class":
        //     this.#onDropCharacterClass(droppedDocument)
        //     break
          //       case "spell":
          //         this.#onDropSpell(droppedDocument)
          // case "ability":
          //   this.#onDropAbility(droppedDocument)
          //   break
          //       case "weapon":
          //       case "armor":
          //       case "ammunition":
          //       case "item":
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
