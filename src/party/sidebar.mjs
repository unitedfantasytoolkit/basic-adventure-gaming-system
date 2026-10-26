/**
 * @file The Party sidebar tab -- a roster of the characters currently
 * adventuring together, showing the numbers a referee reaches for most often.
 *
 * Foundry has no built-in idea of a party, so membership is a flag the system
 * sets on each Actor. That keeps the roster to one source of truth and means a
 * character can be added or dropped without touching any other document.
 *
 * The markup and classes follow Foundry's combat tracker, so the tab picks up the
 * sidebar's spacing, hover states, and theming.
 */

import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import { showMemberPicker } from "./member-picker.mjs"
import { getMarchingRate, getMemberContext, getMemberToken } from "./roster.mjs"

const { HandlebarsApplicationMixin } = foundry.applications.api
const { AbstractSidebarTab } = foundry.applications.sidebar

/**
 * The name of the Actor flag, stored under the system's scope, that marks an
 * Actor as a member of the party.
 * @type {string}
 */
const PARTY_FLAG = "party"

/**
 * Find a character's token on the current scene, warning if they have none.
 * @param {Actor} actor - The party member
 * @returns {Token|null} The token, or null once the user has been warned
 */
const requireMemberToken = (actor) => {
  const token = getMemberToken(actor)
  if (token) return token

  ui.notifications.warn(
    game.i18n.format("BAGS.Party.Members.NotOnScene", { name: actor.name }),
  )
  return null
}

/**
 * Move the view to a character's token.
 * @param {Actor} actor - The party member
 * @returns {Promise<void>|void} Resolves once the pan has finished
 */
const panToMember = (actor) => {
  const token = requireMemberToken(actor)
  if (!token) return undefined

  const { x, y } = token.center
  return canvas.animatePan({
    x,
    y,
    scale: Math.max(canvas.stage.scale.x, canvas.dimensions.scale.default),
  })
}

/**
 * Ping a character's token, so everyone at the table looks at it.
 * @param {Actor} actor - The party member
 * @returns {Promise<void>|void} Resolves once the ping has been sent
 */
const pingMember = (actor) => {
  const token = requireMemberToken(actor)
  if (!token) return undefined

  return canvas.ping(token.center)
}

/**
 * Allow a drop onto the roster.
 * @param {DragEvent} event - The dragover event
 */
const onDragOver = (event) => {
  event.preventDefault()

  // Read the transfer out first: assigning straight to `event.dataTransfer.x`
  // is a write through the event parameter, which the linter rightly objects to.
  const { dataTransfer } = event
  dataTransfer.dropEffect = "copy"
}

/**
 * The Party sidebar tab.
 *
 * Drop an Actor onto the tab to add them to the party; drop an Item onto a
 * member to hand it to them.
 */
export default class PartySidebar extends HandlebarsApplicationMixin(
  AbstractSidebarTab,
) {
  /** @override */
  static tabName = "party"

  /**
   * The tooltip for the sidebar tab's button. Read by `BAGSSidebar` when it
   * builds the tab strip.
   * @type {string}
   */
  static tooltip = "BAGS.Party.Title"

  /**
   * The icon for the sidebar tab's button. Read by `BAGSSidebar`.
   * @type {string}
   */
  static icon = "fa-solid fa-users"

  /**
   * No `classes` here on purpose: `AbstractSidebarTab` already pushes
   * `party-sidebar` (from `tabName`) onto the class list, and carries it through
   * to the popped-out copy. Declaring it again would only duplicate it.
   * @override
   */
  static DEFAULT_OPTIONS = {
    window: {
      title: "BAGS.Party.Title",
    },
    actions: {
      addMember: PartySidebar.#onAddMember,
      openMember: PartySidebar.#onOpenMember,
      panToMember: PartySidebar.#onMemberControl,
      pingMember: PartySidebar.#onMemberControl,
    },
  }

  /** @override */
  static PARTS = {
    header: {
      template: `${SYSTEM_TEMPLATE_PATH}/sidebar/party-header.hbs`,
    },
    roster: {
      template: `${SYSTEM_TEMPLATE_PATH}/sidebar/party.hbs`,
      scrollable: [""],
    },
  }

  /**
   * The token highlighted by hovering a row, so the highlight can be cleared when
   * the pointer leaves. Mirrors what the combat tracker keeps track of.
   * @type {Token|null}
   */
  #highlighted = null

  // === Membership ============================================================

  /**
   * Resolve something that might identify a character into an Actor.
   *
   * Accepts an id or an Actor so callers don't have to care which they hold.
   * Anything that isn't a character comes back as null -- monsters and vehicles
   * don't join the party.
   * @param {string|Actor} actor - An Actor, or the id of one
   * @returns {Actor|null} The character, or null if there isn't one
   */
  static lookupActor(actor) {
    const resolved = typeof actor === "string" ? game.actors.get(actor) : actor
    return resolved?.type === "character" ? resolved : null
  }

  /**
   * Whether a character is currently in the party.
   * @param {string|Actor} actor - An Actor, or the id of one
   * @returns {boolean} True when the character is a party member
   */
  static isInParty(actor) {
    return !!PartySidebar.lookupActor(actor)?.getFlag(SYSTEM_NAME, PARTY_FLAG)
  }

  /**
   * Add a character to the party.
   * @param {string|Actor} actor - An Actor, or the id of one
   * @returns {Promise<void>} Resolves once the flag is set
   */
  static async addToParty(actor) {
    await PartySidebar.lookupActor(actor)?.setFlag(
      SYSTEM_NAME,
      PARTY_FLAG,
      true,
    )
  }

  /**
   * Remove a character from the party.
   *
   * The flag is unset rather than set to false so the Actor doesn't carry a
   * flag that only ever means "not in the party".
   * @param {string|Actor} actor - An Actor, or the id of one
   * @returns {Promise<void>} Resolves once the flag is cleared
   */
  static async removeFromParty(actor) {
    await PartySidebar.lookupActor(actor)?.unsetFlag(SYSTEM_NAME, PARTY_FLAG)
  }

  /**
   * Every character currently in the party.
   * @type {Actor[]}
   */
  static get members() {
    return game.actors.filter((actor) => PartySidebar.isInParty(actor))
  }

  /**
   * Every character who could join the party but hasn't. Offered by the
   * add-member dialog.
   * @type {Actor[]}
   */
  static get candidates() {
    return game.actors.filter(
      (actor) => actor.type === "character" && !PartySidebar.isInParty(actor),
    )
  }

  // === Rendering =============================================================

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const members = this.constructor.members.map(getMemberContext)

    return {
      ...context,
      isGM: game.user.isGM,
      members,
      memberCount: members.length,
      marchingRate: getMarchingRate(members),
      // Chosen here because Handlebars has no way to pick between a singular and
      // a plural phrase.
      title: members.length
        ? game.i18n.format(
            members.length === 1
              ? "BAGS.Party.MemberCount.One"
              : "BAGS.Party.MemberCount.Many",
            { count: members.length },
          )
        : game.i18n.localize("BAGS.Party.Title"),
    }
  }

  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options)

    // Joining the Actors collection's list of applications is how a sidebar tab
    // gets re-rendered when an Actor is created, changed, or deleted. Foundry
    // does the same thing for the combat tracker.
    if (!this.isPopout) game.actors.apps.push(this)

    this._createContextMenu(this.#getMemberContextOptions, ".party-member", {
      fixed: true,
    })
  }

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options)

    const DragDrop = foundry.applications.ux.DragDrop.implementation

    new DragDrop({
      dragSelector: ".party-member",
      dropSelector: ".party-list, .party-empty",
      permissions: {
        dragstart: () => true,
        drop: () => true,
      },
      callbacks: {
        dragover: onDragOver,
        dragstart: this.#onDragStart.bind(this),
        drop: this.#onDrop.bind(this),
      },
    }).bind(this.element)

    // Hovering a row highlights the character's token, the same courtesy the
    // combat tracker extends.
    this.element.querySelectorAll(".party-member").forEach((row) => {
      row.addEventListener("pointerenter", this.#onMemberHoverIn.bind(this))
      row.addEventListener("pointerleave", this.#onMemberHoverOut.bind(this))
    })

    // Show the roster as a drop target while an Actor is dragged over it.
    const roster = this.element.querySelector(".party-list, .party-empty")
    if (roster) {
      roster.addEventListener("dragenter", () =>
        roster.classList.add("droptarget"),
      )
      roster.addEventListener("dragleave", (event) => {
        if (!roster.contains(event.relatedTarget))
          roster.classList.remove("droptarget")
      })
      roster.addEventListener("drop", () =>
        roster.classList.remove("droptarget"),
      )
    }
  }

  // === Context menu ==========================================================

  /**
   * The right-click menu for a party member.
   *
   * Rebuilt each time the menu opens, so `condition` is re-evaluated against
   * current ownership.
   * @returns {object[]} The context menu entries
   */
  #getMemberContextOptions() {
    // Reached through `this.constructor` rather than by name so a system built on
    // BAGS can subclass the tab and change what counts as a party member.
    const { lookupActor, removeFromParty } = this.constructor

    /**
     * Find the Actor a menu entry was opened against.
     * @param {HTMLElement} element - The clicked member row
     * @returns {Actor|null} The party member
     */
    const getMember = (element) => lookupActor(element.dataset.actorId)

    return [
      {
        name: "BAGS.Party.Members.ViewSheet",
        icon: '<i class="fa-solid fa-user"></i>',
        condition: (element) => !!getMember(element)?.isOwner,
        callback: (element) =>
          getMember(element)?.sheet?.render({ force: true }),
      },
      {
        name: "BAGS.Party.Members.PanTo",
        icon: '<i class="fa-solid fa-arrows-to-eye"></i>',
        condition: (element) => {
          const member = getMember(element)
          return !!member && !!getMemberToken(member)
        },
        callback: (element) => panToMember(getMember(element)),
      },
      {
        name: "BAGS.Party.Members.Ping",
        icon: '<i class="fa-solid fa-bullseye"></i>',
        condition: (element) => {
          const member = getMember(element)
          return !!member && !!getMemberToken(member)
        },
        callback: (element) => pingMember(getMember(element)),
      },
      {
        name: "BAGS.Party.Members.Remove",
        icon: '<i class="fa-solid fa-user-minus"></i>',
        condition: () => game.user.isGM,
        callback: (element) => removeFromParty(getMember(element)),
      },
    ]
  }

  // === Canvas ================================================================

  /**
   * Highlight a character's token while their row is hovered.
   * @param {PointerEvent} event - The pointerenter event
   */
  #onMemberHoverIn(event) {
    const { actorId } = event.currentTarget.dataset
    const member = this.constructor.lookupActor(actorId)
    const token = member && getMemberToken(member)

    if (!token?.isVisible) return

    token._onHoverIn(event, { hoverOutOthers: true })
    this.#highlighted = token
  }

  /**
   * Drop the highlight when the pointer leaves a row.
   * @param {PointerEvent} event - The pointerleave event
   */
  #onMemberHoverOut(event) {
    this.#highlighted?._onHoverOut(event)
    this.#highlighted = null
  }

  // === Event handlers ========================================================

  /**
   * Add a character to the party, chosen from those not already in it.
   * @this {PartySidebar}
   * @returns {Promise<void>} Resolves once the character has been added
   */
  static async #onAddMember() {
    const actorId = await showMemberPicker(this.constructor.candidates)
    if (actorId) await this.constructor.addToParty(actorId)
  }

  /**
   * Open a party member's sheet.
   * @this {PartySidebar}
   * @param {PointerEvent} _event - The originating click
   * @param {HTMLElement} target - The element carrying the action
   */
  static #onOpenMember(_event, target) {
    const { actorId } = target.closest("[data-actor-id]")?.dataset ?? {}
    this.constructor.lookupActor(actorId)?.sheet?.render({ force: true })
  }

  /**
   * Run one of the per-member canvas controls, dispatched on the action name the
   * way the combat tracker routes its combatant controls.
   * @this {PartySidebar}
   * @param {PointerEvent} _event - The originating click
   * @param {HTMLElement} target - The button that was clicked
   * @returns {Promise<void>|void} Resolves once the control has run
   */
  static #onMemberControl(_event, target) {
    const { actorId } = target.closest("[data-actor-id]")?.dataset ?? {}
    const member = this.constructor.lookupActor(actorId)
    if (!member) return undefined

    switch (target.dataset.action) {
      case "panToMember":
        return panToMember(member)
      case "pingMember":
        return pingMember(member)
      default:
        return undefined
    }
  }

  // === Drag and drop =========================================================

  /**
   * Let a party member be dragged out of the sidebar, so they can be dropped
   * onto a scene or another sheet the way any other Actor can.
   * @param {DragEvent} event - The dragstart event
   */
  #onDragStart(event) {
    const { actorId } = event.target.closest("[data-actor-id]")?.dataset ?? {}
    const actor = this.constructor.lookupActor(actorId)
    if (!actor) return

    const { dataTransfer } = event
    dataTransfer.setData("text/plain", JSON.stringify(actor.toDragData()))
  }

  /**
   * Handle something being dropped onto the roster.
   *
   * An Actor dropped anywhere on the tab joins the party. An Item dropped onto a
   * particular member is handed to that character.
   * @param {DragEvent} event - The drop event
   * @returns {Promise<void>} Resolves once the drop has been handled
   */
  async #onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event)
    if (!data?.type) return

    const dropped = await fromUuid(data.uuid)
    if (!dropped) return

    if (dropped.documentName === "Actor") {
      if (!game.user.isGM) return
      if (!this.constructor.lookupActor(dropped)) {
        ui.notifications.warn(
          game.i18n.localize("BAGS.Party.Members.OnlyCharacters"),
        )
        return
      }
      await this.constructor.addToParty(dropped)
      return
    }

    if (dropped.documentName === "Item")
      await this.#dropItemOnMember(event, dropped)
  }

  /**
   * Give a dropped Item to whichever party member it landed on.
   * @param {DragEvent} event - The drop event
   * @param {Item} item - The Item that was dropped
   * @returns {Promise<void>} Resolves once the Item has been created
   */
  async #dropItemOnMember(event, item) {
    const { actorId } = event.target.closest("[data-actor-id]")?.dataset ?? {}
    const member = this.constructor.lookupActor(actorId)

    // Dropping an item on the empty part of the roster isn't an error, it just
    // has no obvious recipient.
    if (!member) return

    if (!member.isOwner) {
      ui.notifications.warn(
        game.i18n.format("BAGS.Party.Members.CannotGrant", {
          name: member.name,
        }),
      )
      return
    }

    await member.createEmbeddedDocuments("Item", [item.toObject()])
    ui.notifications.info(
      game.i18n.format("BAGS.Party.Members.Granted", {
        item: item.name,
        name: member.name,
      }),
    )
  }
}

/**
 * Keep the Party tab in step with changes it can't hear about on its own.
 *
 * Being in `game.actors.apps` covers Actors being created, changed, and deleted,
 * but a character's load and armor class come from their items, and an embedded
 * change never reaches the Actors collection. These hooks fill that gap, and
 * only for characters actually on the roster.
 */
export function registerPartyHooks() {
  /**
   * Re-render the tab if an Item's owner is in the party.
   * @param {Item} item - The Item that changed
   */
  const refreshForItem = (item) => {
    if (!ui.party?.rendered) return
    if (PartySidebar.isInParty(item?.parent)) ui.party.render()
  }

  Hooks.on("createItem", refreshForItem)
  Hooks.on("updateItem", refreshForItem)
  Hooks.on("deleteItem", refreshForItem)

  // Whether a member is on the current scene decides if their canvas controls are
  // offered, and that changes when the view changes or tokens come and go.
  const refreshRoster = () => {
    if (ui.party?.rendered) ui.party.render()
  }

  Hooks.on("canvasReady", refreshRoster)
  Hooks.on("createToken", refreshRoster)
  Hooks.on("deleteToken", refreshRoster)
}
