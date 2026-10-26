/**
 * @file The editing application for Actors of type `character`
 */
import BAGSBaseActorEditor from "./actor.editor.mjs"
import { showAddXPDialog, addXPToClass } from "../dialogs/dialog.add-xp.mjs"
import { showLevelUpDialog, levelUpClass } from "../dialogs/dialog.level-up.mjs"
import animatedSheetAttention from "../utils/animated-sheet-attention.mjs"
import numberToOrdinal from "../utils/number-to-ordinal.mjs"
import signNumber from "../utils/sign-number.mjs"
import {
  isActionAvailable,
  isActionExhausted,
} from "../utils/action-availability.mjs"

/** Where the labels for Active Effect changes live in the language file. */
const CHANGE_LABEL_PREFIX = "BAGS.ActiveEffects.ModifierKeyLabels"

/** Where this tab's own labels live in the language file. */
const CLASS_TAB_PREFIX = "BAGS.Actors.Character.Editor.Class"

/**
 * Say in plain language what one Active Effect change does.
 *
 * The language file keeps a phrase for every field the system expects an effect
 * to touch -- "Melee damage rolls: {mod}" and so on. Nothing stops a referee
 * from pointing an effect at some other field, though, and `localize` hands back
 * the key it was given when it has no translation for it. A couple of the keys
 * that *do* exist are deliberately blank as well. Either case leaves nothing
 * worth reading, so the fallback names the raw field instead of printing a
 * translation key at the player.
 * @param {object} change - One entry from an ActiveEffect's `changes` array
 * @returns {string} A readable description of the change
 */
const describeEffectChange = (change) => {
  const key = `${CHANGE_LABEL_PREFIX}.${change.key}`
  const modifier = signNumber(change.value)
  const label = game.i18n.format(key, { mod: modifier })

  if (label && label !== key) return label

  return `${change.key}: ${modifier}`
}

/**
 * Explain why an action isn't available at the class's current level.
 *
 * Locked actions are listed rather than hidden. This tab is where a player goes
 * to find out what being a member of this class is worth, and "you get this at
 * 4th level" is part of the answer -- leaving it out would make the class look
 * smaller than it is, and would make an ability that vanished on level-up look
 * like it had been deleted.
 *
 * Mirrors {@link ../utils/action-availability.mjs}, which is what actually
 * decides availability; this only puts words to the same rule.
 * @param {object} action - The action being described
 * @param {number} level - The class's current level
 * @returns {string} The explanation, or "" when the action is available
 */
const describeActionGate = (action, level) => {
  if (!action?.flags?.usesRestrictions) return ""

  const { min, max } = action.level ?? {}

  if (typeof min === "number" && level < min)
    return game.i18n.format(`${CLASS_TAB_PREFIX}.UnlocksAtLevel`, {
      level: numberToOrdinal(min),
    })

  if (typeof max === "number" && level > max)
    return game.i18n.format(`${CLASS_TAB_PREFIX}.LostAfterLevel`, {
      level: numberToOrdinal(max),
    })

  return ""
}

export default class BAGSCharacterEditor extends BAGSBaseActorEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--character-editor"],
      actions: {
        "view-class": this.viewClass,
        "edit-class": this.editClass,
        "edit-class-effects": this.editClassEffects,
        "edit-class-actions": this.editClassActions,
        "add-class-xp": this.addXP,
        "level-up-class": this.levelUp,
      },
    }
  }

  static DOCUMENT_TYPE = "character"

  // --- Tabs ------------------------------------------------------------------

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.Actors.Character.Editor.Tabs.BasicInfo",
          cssClass: "tab--details",
        },
        {
          id: "stats",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.Actors.Character.Editor.Tabs.Stats",
          cssClass: "tab--stats",
        },
        {
          id: "class-and-abilities",
          group: "sheet",
          icon: "fa-solid fa-trophy",
          label: "BAGS.Actors.Character.Editor.Tabs.ClassAndAbilities",
          cssClass: "tab--class-and-abilities",
        },
        {
          id: "identity",
          group: "sheet",
          icon: "fa-solid fa-trophy",
          label: "BAGS.Actors.Character.Editor.Tabs.Identity",
          cssClass: "tab--identity",
        },
        ...super.TABS.sheet.tabs,
      ],
      // Dead weight, but kept honest: `_prepareTabs` only falls back to
      // `initial` when `tabGroups` hasn't already been set, and the base editor
      // sets it. Leaving a different tab named here would read as a promise the
      // app doesn't keep.
      initial: "class-and-abilities",
      labelPrefix: "BAGS.Actors.Character.Editor.Tabs",
    },
  }

  static TAB_PARTS = {
    stats: {
      template: `${this.TEMPLATE_ROOT}/stats.edit.hbs`,
    },
    details: {
      template: `${this.TEMPLATE_ROOT}/basic-info.edit.hbs`,
    },
    identity: {
      template: `${this.TEMPLATE_ROOT}/identity.edit.hbs`,
    },
    // Characters are the only actors that have classes, so this part lives here
    // rather than on the base editor. It used to sit in `BAGSBaseActorEditor`,
    // which meant the monster editor rendered a class tab it had no navigation
    // for.
    "class-and-abilities": {
      template: `${this.TEMPLATE_ROOT}/class.edit.hbs`,
      scrollable: [".scrollable"],
    },
  }

  // === Rendering =============================================================

  /** @override */
  async _preparePartContext(partId, context, options) {
    await super._preparePartContext(partId, context, options)

    if (partId === "class-and-abilities")
      context.classes = this.document.itemTypes.class.map((item) =>
        this.#prepareClass(item),
      )

    return context
  }

  /**
   * Everything the class tab shows about one class.
   *
   * Built here rather than read off the Item in the template because two of the
   * three sections need work done to them first: an effect's changes have to be
   * turned into sentences, and an action has to be measured against the class's
   * level before we know whether to present it as something the character can
   * do or as something still ahead of them.
   * @param {Item} item - A class Item owned by this character
   * @returns {object} The class, ready to render
   */
  #prepareClass(item) {
    const { system } = item
    const { level } = system

    return {
      id: item.id,
      name: item.name,
      img: item.img,

      level,
      maxLevel: system.maxLevel,
      canLevelUp: system.canLevelUp,
      canAddXP: system.canAddXP,

      xp: {
        value: system.xp,
        min: system.xpFromPrev,
        max: system.xpToNext,
        hint: this.#experienceHint(system),
      },

      effects: item.effects.map((effect) => ({
        id: effect.id,
        name: effect.name,
        img: effect.img,
        disabled: effect.disabled,
        changes: effect.changes.map(describeEffectChange).filter(Boolean),
      })),

      actions: system.actionList
        .map((action) => ({
          id: action.id,
          name: action.name,
          img: action.img,
          uses: action.uses,
          exhausted: isActionExhausted(action),
          available: isActionAvailable(action, item, this.document),
          gate: describeActionGate(action, level),
          hideWhenUnmet: !!action.level?.hideWhenUnmet,
        }))
        .filter((action) => action.available || !action.hideWhenUnmet),
    }
  }

  /**
   * What the experience meter says when you hover it.
   *
   * The same three states the class sheet's own header describes, worded the
   * same way, because a player who has seen one shouldn't have to work out that
   * the other means the same thing.
   * @see {@link ../items/item.character-class.sheet.mjs}
   * @param {object} system - The class's data model
   * @returns {string} The tooltip text
   */
  // eslint-disable-next-line class-methods-use-this
  #experienceHint(system) {
    if (!system.canAddXP)
      return game.i18n.format(
        "BAGS.CharacterClass.Information.MaxLevelReached",
        {
          level: system.maxLevel,
        },
      )

    if (system.canLevelUp)
      return game.i18n.localize("BAGS.CharacterClass.Information.ReadyToLevel")

    return game.i18n.format("BAGS.CharacterClass.Information.AddXPHint", {
      xp: system.xpRemaining,
    })
  }

  // === Action management =====================================================

  /**
   * The class Item a control in the class tab belongs to.
   *
   * Every control in the tab sits inside an element carrying the class's id, so
   * one lookup serves all of them. Foundry hands action handlers the element
   * that carried `data-action`, which is what we walk up from -- reading
   * `event.target` instead would land inside the shadow root of the experience
   * meter, which is a custom element.
   * @param {HTMLElement} target - The element the action fired on
   * @returns {Item|null} The class, or null if the control was orphaned
   */
  #classFromTarget(target) {
    const container = target?.closest("[data-item-id]")
    if (!container) return null
    return this.document.items.get(container.dataset.itemId) ?? null
  }

  /**
   * Open one of a class's own editing applications.
   *
   * The class Item owns these, not the character editor: a class's actions are
   * edited in the action editor its sheet already builds, so editing them from
   * here and editing them from the class sheet are the same window rather than
   * two windows disagreeing about the same Item.
   * @param {HTMLElement} target - The element the action fired on
   * @param {string} subApp - Which of the class sheet's sub-apps to open
   */
  #openClassSubApp(target, subApp) {
    const classItem = this.#classFromTarget(target)
    if (!classItem) return

    const app = classItem.sheet.subApps[subApp]
    if (!app) return

    if (app.rendered) {
      app.bringToFront()
      animatedSheetAttention(app.element)
    }

    app.render(true)
  }

  // === Events ================================================================

  static viewClass(_event, target) {
    this.#classFromTarget(target)?.sheet.render(true)
  }

  static editClass(_event, target) {
    this.#openClassSubApp(target, "itemEditor")
  }

  static editClassEffects(_event, target) {
    this.#openClassSubApp(target, "activeEffectEditor")
  }

  static editClassActions(_event, target) {
    this.#openClassSubApp(target, "actionEditor")
  }

  /**
   * Award experience to one of the character's classes.
   *
   * This editor is a plain application rather than a document sheet, so nothing
   * re-renders it when the class changes underneath it. Every handler that
   * writes has to ask for the render itself.
   * @param {PointerEvent} _event - The click that got us here
   * @param {HTMLElement} target - The element the action fired on
   */
  static async addXP(_event, target) {
    const classItem = this.#classFromTarget(target)
    if (!classItem) return

    const result = await showAddXPDialog(classItem)
    if (!result) return

    await addXPToClass(classItem, result.xp, result.note)
    this.render()
  }

  static async levelUp(_event, target) {
    const classItem = this.#classFromTarget(target)
    if (!classItem) return

    const result = await showLevelUpDialog(classItem)
    if (!result) return

    await levelUpClass(classItem, result.note)
    this.render()
  }

  // Saving is inherited: `BAGSBaseActorEditor.save` writes the submitted form to
  // the Actor. There was a `console.info` stub here that overrode it, which never
  // actually ran -- the form handler is bound in the base class's
  // `DEFAULT_OPTIONS` getter, where `this` is the base class -- but it would have
  // started swallowing every edit the moment this class declared a `form` option
  // of its own.
}
