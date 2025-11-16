/**
 * @file The UI for viewing and editiing an ability Item.
 */
import BAGSCharacterClassXPTableEditor from "./item.character-class.xp-table-editor.mjs"
import BAGSCharacterClassDetailsEditor from "./item.character-class.details-editor.mjs"
import BAGSBaseItemSheet from "./item.sheet.mjs"
import ActionEditor from "../applications/action-editor.mjs"

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

  customizeTitleArea(titleBarContainer) {
    // If this is attached to a character, we should display an XP bar.
    if (!this.document.parent) {
      const xpBarContainer = document.createElement("div")
      xpBarContainer.classList.add("xp-meter")

      const xpBar = document.createElement("uft-character-info-meter")
      xpBar.setAttribute("value", this.document.system.xp)
      xpBar.setAttribute("max", this.document.system.xpToNext)
      xpBar.classList.add("clickable")
      xpBar.dataset.action = "add-xp"
      xpBar.dataset.tooltip = this.document.system.canAddXP
        ? "Click to add XP"
        : `Maximum level reached (${this.document.system.maxLevel})`

      xpBarContainer.append(xpBar)

      titleBarContainer
        .querySelector(".window-header__text")
        .append(xpBarContainer)
    }
  }

  _replaceHTML(...args) {
    super._replaceHTML(...args)

    const xpBar = this.element.querySelector(
      ".window-header__text uft-character-info-meter",
    )

    if (xpBar) {
      xpBar.setAttribute("value", this.document.system.xp)
      xpBar.setAttribute("max", this.document.system.xpToNext)
      xpBar.dataset.tooltip = this.document.system.canAddXP
        ? "Click to add XP"
        : `Maximum level reached (${this.document.system.maxLevel})`
    }
  }

  static async addXP() {
    if (!this.document.system.canAddXP) return

    const xpToAdd = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Add Experience Points" },
      content: `
        <form>
          <div class="form-group">
            <label>XP to add</label>
            <input type="number" name="xp" min="1" placeholder="Enter XP amount" autofocus />
          </div>
          <div class="form-group">
            <label>Note (optional)</label>
            <input type="text" name="note" placeholder="e.g., Defeated the goblin king" />
          </div>
        </form>
      `,
      ok: {
        label: "Add XP",
        callback: (event, button) => {
          const { form } = button
          return {
            xp: parseInt(form.elements.xp.value, 10),
            note: form.elements.note.value,
          }
        },
      },
      rejectClose: false,
    })

    if (!xpToAdd || !xpToAdd.xp) return

    const currentXP = this.document.system.xp
    const newXP = currentXP + xpToAdd.xp

    // Add to audit log
    const logEntry = {
      date: Date.now(),
      xpChange: xpToAdd.xp,
      levelChange: 0,
      note: xpToAdd.note || "XP added",
    }

    await this.document.update({
      "system.xp": newXP,
      "system.xpLog": [...this.document.system.xpLog, logEntry],
    })

    ui.notifications.info(
      `Added ${xpToAdd.xp} XP to ${this.document.name}. Total: ${newXP}`,
    )
  }

  static async levelUp() {
    if (!this.document.system.canLevelUp) return

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Level Up" },
      content: `<p>Level up to ${this.document.system.level + 1}?</p>`,
      yes: { label: "Level Up!" },
      no: { label: "Cancel" },
      rejectClose: false,
    })

    if (!confirmed) return

    const oldLevel = this.document.system.level
    const newLevel = oldLevel + 1

    // Add to audit log
    const logEntry = {
      date: Date.now(),
      xpChange: 0,
      levelChange: 1,
      note: `Leveled up from ${oldLevel} to ${newLevel}`,
    }

    await this.document.update({
      "system.manuallySetLevel": newLevel,
      "system.xpLog": [...this.document.system.xpLog, logEntry],
    })

    ui.notifications.info(`${this.document.name} is now level ${newLevel}!`)
  }

  static editAdvancement() {
    this.subApps.advancementEditor.render(true)
  }
}
