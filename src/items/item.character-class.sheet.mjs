/**
 * @file The UI for viewing and editiing an ability Item.
 */
import BAGSCharacterClassXPTableEditor from "./item.character-class.xp-table-editor.mjs"
import BAGSCharacterClassDetailsEditor from "./item.character-class.details-editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"
import ActionEditor from "../applications/action-editor.mjs"
import { showAddXPDialog, addXPToClass } from "../dialogs/dialog.add-xp.mjs"
import { showLevelUpDialog, levelUpClass } from "../dialogs/dialog.level-up.mjs"
import BAGSActiveEffectEditor from "../applications/active-effects.editor.mjs"

/**
 * @typedef {import('../types.mjs').SheetNavTab} SheetNavTab
 */

export default class BAGSCharacterClassSheet extends BAGSBaseItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ["application--character-class-sheet"],
    window: {
      controls: [
        {
          action: "edit-item",
          icon: "fa-solid fa-pencil",
          label: "BAGS.CharacterClass.Information.ActionLabel",
          ownership: "OWNER",
        },
        {
          action: "edit-advancement",
          icon: "fa-solid fa-table",
          label: "BAGS.CharacterClass.XPTable.ActionLabel",
          ownership: "OWNER",
        },
        {
          action: "edit-actions",
          icon: "fa-solid fa-sparkles",
          label: "Edit Actions",
          ownership: "OWNER",
        },
        {
          action: "edit-active-effects",
          icon: "fa-solid fa-sparkles",
          label: "Manage Active Effects",
          ownership: "OWNER",
        },
      ],
    },
    actions: {
      "edit-advancement": this.editAdvancement,
      "add-xp": this.addXP,
      "level-up": this.levelUp,
    },
  }

  static DOCUMENT_TYPE = "class"

  // --- Sub apps --------------------------------------------------------------
  static SUB_APPS = {
    actionEditor: ActionEditor,
    itemEditor: BAGSCharacterClassDetailsEditor,
    advancementEditor: BAGSCharacterClassXPTableEditor,
    activeEffectEditor: BAGSActiveEffectEditor,
  }

  static get PARTS() {
    return {
      summary: {
        template: `${this.TEMPLATE_ROOT}/main.hbs`,
      },
      advancement: {
        template: `${this.TEMPLATE_ROOT}/xp-table.view.hbs`,
      },
      history: {
        template: `${this.TEMPLATE_ROOT}/history.hbs`,
      },
      ...super.TAB_PARTS,
    }
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    super._preparePartContext(partId, context, options)
    const doc = this.document

    const savingThrowSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
      )
    context.usesDescendingAC = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )?.descending
    context.savingThrows = savingThrowSettings.savingThrows

    switch (partId) {
      case "summary":
        context.gearTable = doc.system.gearTable
          ? await foundry.applications.ux.TextEditor.enrichHTML(
              fromUuidSync(doc.system.gearTable)._createDocumentLink(),
            )
          : ""
        break
      case "advancement":
        context.savingThrowTypeCount = Object.keys(
          savingThrowSettings.savingThrows,
        ).length
        break
      default:
        return super._preparePartContext(partId, context)
    }
    return context
  }

  tabGroups = {
    sheet: "summary",
  }

  static TABS = {
    sheet: {
      ...super.TABS.sheet,
      tabs: [
        ...super.TABS.sheet.tabs,
        {
          id: "advancement",
          group: "sheet",
          icon: "fa-solid fa-tag",
          label: "BAGS.CharacterClass.Tabs.Advancement",
          cssClass: "tab--advancement",
        },
        {
          id: "history",
          group: "sheet",
          icon: "fa-solid fa-clock-rotate-left",
          label: "BAGS.CharacterClass.Tabs.History",
          cssClass: "tab--history",
        },
      ],
    },
  }

  /**
   * Put the class's standing -- what level it is, how close the next one is,
   * and whether it can be taken -- into the window header.
   *
   * Level and experience are the same fact, so they live together, and the
   * header keeps them visible while the body is scrolled. Levelling up gets a
   * control of its own rather than sharing the meter, because clicking the
   * meter already means "add experience".
   * @param {HTMLDivElement} titleBarContainer - The header's title area
   * @override
   */
  customizeTitleArea(titleBarContainer) {
    const meta = document.createElement("div")
    meta.classList.add("class-standing")

    const level = document.createElement("span")
    level.classList.add("class-standing__level")
    meta.append(level)

    if (!this.document.parent) {
      const xpBar = document.createElement("uft-character-info-meter")
      xpBar.classList.add("clickable")
      xpBar.dataset.action = "add-xp"
      meta.append(xpBar)
    }

    const levelUp = document.createElement("button")
    levelUp.type = "button"
    levelUp.classList.add("class-standing__level-up")
    levelUp.dataset.action = "level-up"
    levelUp.textContent = game.i18n.localize(
      "BAGS.CharacterClass.Information.LevelUp",
    )
    meta.append(levelUp)

    titleBarContainer.querySelector(".window-header__text").append(meta)

    this.#refreshStanding(meta)
  }

  _replaceHTML(...args) {
    super._replaceHTML(...args)
    this.#refreshStanding(this.element.querySelector(".class-standing"))
  }

  /**
   * Bring the header's standing up to date after a render.
   *
   * The level-up control is hidden rather than disabled when there's nothing
   * to spend: a header with no button is quieter than one with a dead button,
   * and the meter's own tooltip already explains how far off the next level is.
   * @param {HTMLElement|null} meta - The standing container, if it exists
   */
  #refreshStanding(meta) {
    if (!meta) return

    const { system } = this.document

    const level = meta.querySelector(".class-standing__level")
    level.textContent = game.i18n.format(
      "BAGS.CharacterClass.Information.LevelAbbreviation",
      { level: system.level },
    )

    const xpBar = meta.querySelector("uft-character-info-meter")
    if (xpBar) {
      xpBar.setAttribute("value", system.currentLevelDetails.xp.current)
      xpBar.setAttribute("min", system.currentLevelDetails.xp.prev || 0)
      xpBar.setAttribute("max", system.currentLevelDetails.xp.next)
      xpBar.dataset.tooltip = this.#experienceHint()
    }

    const levelUp = meta.querySelector(".class-standing__level-up")
    levelUp.hidden = !system.canLevelUp
  }

  /**
   * What the experience meter says when you hover it.
   *
   * The meter carries the "how far off is the next level" answer, because the
   * level-up control isn't there to carry it -- that only appears once there's
   * a level waiting.
   * @returns {string} The tooltip text
   */
  #experienceHint() {
    const { system } = this.document

    if (!system.canAddXP) {
      return game.i18n.format(
        "BAGS.CharacterClass.Information.MaxLevelReached",
        { level: system.maxLevel },
      )
    }

    if (system.canLevelUp) {
      return game.i18n.localize("BAGS.CharacterClass.Information.ReadyToLevel")
    }

    return game.i18n.format("BAGS.CharacterClass.Information.AddXPHint", {
      xp: system.xpRemaining,
    })
  }

  static async addXP() {
    const result = await showAddXPDialog(this.document)
    if (result) {
      await addXPToClass(this.document, result.xp, result.note)
    }
  }

  static async levelUp() {
    const result = await showLevelUpDialog(this.document)
    if (result) {
      await levelUpClass(this.document, result.note)
    }
  }

  static editAdvancement() {
    this.subApps.advancementEditor.render(true)
  }
}
