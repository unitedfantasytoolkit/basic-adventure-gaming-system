/**
 * @file The group manager: the GM's tool for deciding who rolls with whom.
 *
 * Foundry ships no interface for CombatantGroup at all -- no sheet, no creation
 * control, nothing. Everything here is ours, and it has to cover the whole
 * lifecycle, because a group that can be created but not emptied or deleted is
 * worse than no groups at all.
 *
 * Reassignment is GM-only by Foundry's own permission rules: a player may write
 * a Combatant's `initiative`, `flags`, `defeated` and `system`, but not its
 * `group`.
 */

import { SYSTEM_TEMPLATE_PATH } from "../../config/constants.mjs"
import { SIDES, SIDE_LABELS, SIDE_VALUES, colorForGroup } from "../sides.mjs"

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * An application for creating groups and moving combatants between them.
 */
export default class BAGSGroupManager extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /**
   * @param {object} options - Application options.
   * @param {Combat} options.combat - The combat being organised.
   */
  constructor({ combat, ...options } = {}) {
    super(options)
    this.#combat = combat
  }

  /**
   * The combat this manager is organising.
   * @type {Combat}
   */
  #combat

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "bags-group-manager",
    classes: ["bags", "bags-group-manager"],
    tag: "div",
    window: {
      title: "BAGS.Combat.Groups.Manage",
      icon: "fa-solid fa-flag",
      resizable: true,
    },
    position: { width: 420, height: "auto" },
    actions: {
      createGroup: BAGSGroupManager.#onCreateGroup,
      deleteGroup: BAGSGroupManager.#onDeleteGroup,
      ungroup: BAGSGroupManager.#onUngroup,
      resetColor: BAGSGroupManager.#onResetColor,
    },
  }

  /** @inheritdoc */
  static PARTS = {
    main: { template: `${SYSTEM_TEMPLATE_PATH}/combat/group-manager.hbs` },
  }

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  /** @inheritdoc */
  async _prepareContext() {
    const combat = this.#combat

    const describe = (combatant) => ({
      id: combatant.id,
      name: combatant.name,
      img: combatant.img,
      groupId: combatant.rollingGroup?.id ?? "",
    })

    const groups = combat.groups.map((group) => ({
      id: group.id,
      name: group.name,
      side: group.system.side,
      initiative: group.initiative,
      // The picker always shows the colour the group is actually drawn in, even
      // when that colour is inherited -- an empty swatch would be a lie. The
      // reset control is what distinguishes "inherited" from "chosen".
      color: colorForGroup(group),
      hasOwnColor: !!group.system.color,
      members: combat.combatants
        .filter((combatant) => combatant.rollingGroup?.id === group.id)
        .map(describe),
    }))

    return {
      groups,
      ungrouped: combat.combatants
        .filter((combatant) => !combatant.rollingGroup)
        .map(describe),
      // Every group, plus a blank entry meaning "not in a group at all", which
      // has to be reachable: an ungrouped combatant rolls for itself, and that
      // is a legitimate state rather than an error.
      groupChoices: [
        { value: "", label: game.i18n.localize("BAGS.Combat.Groups.None") },
        ...combat.groups.map((group) => ({
          value: group.id,
          label: group.name,
        })),
      ],
      sideChoices: SIDE_VALUES.map((side) => ({
        value: side,
        label: game.i18n.localize(SIDE_LABELS[side]),
      })),
    }
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options)

    this.element
      .querySelectorAll("[data-change='assign']")
      .forEach((select) =>
        select.addEventListener("change", this.#onAssign.bind(this)),
      )

    this.element
      .querySelectorAll("[data-change='side']")
      .forEach((select) =>
        select.addEventListener("change", this.#onChangeSide.bind(this)),
      )

    this.element
      .querySelectorAll("[data-change='rename']")
      .forEach((input) =>
        input.addEventListener("change", this.#onRename.bind(this)),
      )

    this.element
      .querySelectorAll("[data-change='color']")
      .forEach((input) =>
        input.addEventListener("change", this.#onChangeColor.bind(this)),
      )

    // Re-render when the combat changes underneath us, so the manager and the
    // tracker never disagree about who is where.
    this.#hookId ??= Hooks.on("updateCombat", () => this.render())
  }

  /** @inheritdoc */
  _onClose(options) {
    if (this.#hookId) Hooks.off("updateCombat", this.#hookId)
    this.#hookId = null
    super._onClose(options)
  }

  /**
   * The `updateCombat` hook registration, so it can be released on close.
   * @type {number|null}
   */
  #hookId = null

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  /**
   * Move a combatant into a different group, or out of all of them.
   * @param {Event} event - The change event.
   * @returns {Promise<void>} Resolves once the write completes.
   */
  async #onAssign(event) {
    const { combatantId } = event.target.closest("[data-combatant-id]").dataset
    const combatant = this.#combat.combatants.get(combatantId)

    await combatant?.update({ group: event.target.value || null })
    this.render()
  }

  /**
   * Change which faction a group fights for.
   * @param {Event} event - The change event.
   * @returns {Promise<void>} Resolves once the write completes.
   */
  async #onChangeSide(event) {
    const { groupId } = event.target.closest("[data-group-id]").dataset

    await this.#combat.groups
      .get(groupId)
      ?.update({ "system.side": event.target.value })
    this.render()
  }

  /**
   * Rename a group.
   * @param {Event} event - The change event.
   * @returns {Promise<void>} Resolves once the write completes.
   */
  async #onRename(event) {
    const { groupId } = event.target.closest("[data-group-id]").dataset

    await this.#combat.groups.get(groupId)?.update({ name: event.target.value })
    this.render()
  }

  /**
   * Give a group its own colour.
   * @param {Event} event - The change event.
   * @returns {Promise<void>} Resolves once the write completes.
   */
  async #onChangeColor(event) {
    const { groupId } = event.target.closest("[data-group-id]").dataset

    await this.#combat.groups
      .get(groupId)
      ?.update({ "system.color": event.target.value })
    this.render()
  }

  /**
   * Hand a group's colour back to its side.
   * @this {BAGSGroupManager}
   * @param {PointerEvent} event - The triggering event.
   * @param {HTMLElement} target - The button that was clicked.
   * @returns {Promise<void>} Resolves once the write completes.
   */
  static async #onResetColor(event, target) {
    const { groupId } = target.closest("[data-group-id]").dataset

    await this.#combat.groups.get(groupId)?.update({ "system.color": null })
    this.render()
  }

  /**
   * Create a new, empty group.
   * @this {BAGSGroupManager}
   * @returns {Promise<void>} Resolves once the group exists.
   */
  static async #onCreateGroup() {
    await this.#combat.createGroup(SIDES.HOSTILE)
    this.render()
  }

  /**
   * Delete a group, releasing its members.
   * @this {BAGSGroupManager}
   * @param {PointerEvent} event - The triggering event.
   * @param {HTMLElement} target - The button that was clicked.
   * @returns {Promise<void>} Resolves once the group is gone.
   */
  static async #onDeleteGroup(event, target) {
    const { groupId } = target.closest("[data-group-id]").dataset

    // No confirmation prompt: deleting a group destroys no combatants, it only
    // sends them back to rolling for themselves, and it is one click to rebuild.
    await this.#combat.groups.get(groupId)?.delete()
    this.render()
  }

  /**
   * Empty a group without deleting it.
   * @this {BAGSGroupManager}
   * @param {PointerEvent} event - The triggering event.
   * @param {HTMLElement} target - The button that was clicked.
   * @returns {Promise<void>} Resolves once the members are released.
   */
  static async #onUngroup(event, target) {
    const { groupId } = target.closest("[data-group-id]").dataset

    const members = this.#combat.combatants.filter(
      (combatant) => combatant.rollingGroup?.id === groupId,
    )
    if (members.length) {
      await this.#combat.updateEmbeddedDocuments(
        "Combatant",
        members.map((combatant) => ({ _id: combatant.id, group: null })),
      )
    }
    this.render()
  }
}
