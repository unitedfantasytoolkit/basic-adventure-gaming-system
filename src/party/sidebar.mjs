import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

/**
 * A class that represents the UI used for managing the Party
 * and exploration tasks.
 *
 * Features:
 * - Add/remove Characters
 * - Display character info -- HP, move speed, etc.
 */

export default class PartySidebar extends SidebarTab {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "party",
      template: `${SYSTEM_TEMPLATE_PATH}/sidebar/party.hbs`,
      title: "BAGS.Party.Title",
      dragDrop: [
        { dragSelector: ".party-list__item", dropSelector: ".party-list" },
      ],
      // filters: [{inputSelector: 'input[name="search"]', contentSelector: ".directory-list"}],
      contextMenuSelector: ".party-list__item",
    })
  }

  static tooltip = "BAGS.Party.Title"

  static icon = "fas fa-users"

  static lookupActor(actor) {
    const actorObj = typeof actor === "string" ? game.actors.get(actor) : actor

    return actorObj?.type !== "character" ? null : actorObj
  }

  static isInParty(actor) {
    const actorObj = PartySidebar.lookupActor(actor)
    return !actorObj ? false : actorObj.getFlag(game.system.id, "party")
  }

  static async addToParty(actor) {
    await PartySidebar.lookupActor(actor)?.setFlag(
      game.system.id,
      "party",
      true,
    )
    ui.sidebar.render()
  }

  static async removeFromParty(actor) {
    await PartySidebar.lookupActor(actor)?.setFlag(
      game.system.id,
      "party",
      false,
    )
    ui.sidebar.render()
  }

  static async grantItemToPartyMember(actor, item) {
    await PartySidebar.lookupActor(actor)?.createEmbeddedDocuments("Item", item)
  }

  /** @override */
  async getData(options = {}) {
    const context = await super.getData(options)
    context.party = this.partyMembers
    return context
  }

  get partyMembers() {
    return game.actors.filter((a) => a.getFlag(game.system.id, "party"))
  }

  _onDragStart(event) {
    const { entryId } = event.target.closest("[data-entry-id]").dataset

    const actor = game.actors.get(entryId)
    if (!actor) return

    const dragData = actor.toDragData()
    if (!dragData) return

    event.dataTransfer.setData("text/plain", JSON.stringify(dragData))
  }

  /**
   * @override
   * @param {DragEvent} event - The drag event fired when dropping an item onto the party list
   */
  async _onDrop(event) {
    const typesAllowed = ["Actor", "Item", "Folder"]

    const performAddToParty = (doc) => {
      if (
        doc &&
        doc.documentName === "Actor" &&
        !PartySidebar.isInParty(doc.id)
      ) {
        doc.setFlag(game.system.id, "party", true)
        return true
      }

      return false
    }

    const performAddItemToPartyMember = (actor, item) => {
      if (item.documentName !== "Item") return
      actor.createEmbeddedDocuments("Item", [item])
    }

    const targetId = event.target.closest("[data-entry-id]")?.dataset.entryId
    const { type, uuid } = TextEditor.getDragEventData(event)

    // Kick out things that aren't actors or embedded into actors
    if (!typesAllowed.includes(type)) return

    // An item can't be a party member.
    // It must be dropped onto a party member.
    if (type === "Item" && !targetId) return

    // This is the latest we can wait to fetch the dropped document
    const sourceDoc = await fromUuid(uuid)

    // If it's not a character, don't allow it to join the party
    if (type === "Actor" && (!sourceDoc || sourceDoc?.type !== "character"))
      return

    if (performAddToParty(sourceDoc)) return

    // This is the latest we can wait to fetch the target document
    const targetDoc = game.actors.get(targetId)

    if (performAddItemToPartyMember(targetDoc, sourceDoc)) return

    if (type === "Folder") {
      sourceDoc.contents.forEach((doc) => {
        if (doc.documentName === "Item") {
          performAddItemToPartyMember(targetDoc, doc)
          return
        }

        if (doc.documentName === "Actor") {
          performAddToParty(doc)
        }
      })
    }
  }

  #openXPApp() {}

  #openPartyMemberSheet(event) {
    const entryId = event.target?.closest("[data-entry-id]")?.dataset.entryId
    game.actors.get(entryId)?.sheet?.render(true)
  }

  /**
   * @todo - Listener for "Distribute XP"
   * @todo - Listener for "Distrbute Treasure"
   * @override
   */
  activateListeners(html) {
    super.activateListeners(html)

    html.find(".add-xp").click(this.#openXPApp.bind(this))
    html
      .find(".thumbnail, .entry-name")
      .click(this.#openPartyMemberSheet.bind(this))

    this._contextMenu(html)
  }

  /**
   * Configure the context menu which should be used for party members
   * @protected
   * @override
   */
  _contextMenu(html) {
    const contextOptions = [
      {
        name: "UFT.partytab.removeFromParty",
        icon: '<i class="fa-light fa-users"></i>',
        condition: (node) =>
          PartySidebar.isInParty(node.data("entry-id")) === true,
        callback: (node) =>
          game.user.isGM && PartySidebar.removeFromParty(node.data("entry-id")),
      },
    ]

    // ContextMenu is a global.

    ContextMenu.create(
      this,
      html,
      this.options.contextMenuSelector,
      contextOptions,
    )
  }
}
