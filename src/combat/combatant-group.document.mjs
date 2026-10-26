/**
 * @file The CombatantGroup document -- a ball of actors that rolls initiative
 * together.
 *
 * Foundry gives CombatantGroup no lifecycle hooks of its own, in either the
 * client or the common document. That leaves two gaps this class fills: changing
 * a group's initiative re-sorts the turn order without preserving whose turn it
 * is, and deleting a group leaves every former member holding a group id that no
 * longer resolves.
 */

/**
 * Identifies this browser session.
 *
 * A user id is not enough to say which client made a change: a referee with the
 * world open in two windows is the same user in both. Some follow-up writes must
 * come from exactly one client, so the change carries this to name it.
 * @type {string}
 */
export const SESSION_ID = foundry.utils.randomID()

/**
 * The operation option carrying {@link SESSION_ID}. Options are broadcast with
 * the change, so every client can tell whether it was the one that made it.
 * @type {string}
 */
export const PIN_SESSION_OPTION = "bagsPinSession"

/**
 * A group of combatants that share one initiative roll.
 */
export default class BAGSCombatantGroup extends foundry.documents
  .CombatantGroup {
  /**
   * Keep the turn cursor pinned to whoever is acting when a group's initiative
   * changes.
   *
   * Foundry's Combatant document does exactly this for combatant updates: clone
   * the combat, apply the pending change, re-sort, and tell the operation which
   * index the active combatant ended up at. Everyone else's turn status then
   * follows from which side of that cursor they land on. Group updates reorder
   * just as much and get none of it for free.
   * @inheritDoc
   */
  static async _preUpdateOperation(documents, operation, user) {
    await super._preUpdateOperation(documents, operation, user)

    const combatant = operation.parent?.combatant
    if (!combatant || operation.combatTurn !== undefined) return

    const combat = operation.parent.clone()
    combat.updateSource({ groups: operation.updates })

    // `updateSource` writes source data and re-initialises the fields it
    // touched, but it does not re-run data preparation. Without this the
    // clone's combatants would still hold the initiative they derived from the
    // *old* group data, and the re-sort below would order them by stale numbers.
    combat.reset()
    combat.setupTurns()

    /* Writing back to `operation` is the entire purpose of a pre-operation
     * hook: it is how a document tells the database layer what the update
     * should also do. Foundry's own Combatant document does exactly this.
     */
    /* eslint-disable no-param-reassign */
    operation.combatTurn = Math.max(
      combat.turns.findIndex((turn) => turn.id === combatant.id),
      0,
    )
    operation.turnEvents = false
    // Names this session as the one that saves the pinned cursor. See
    // `BAGSCombat#onModifyGroups`.
    operation[PIN_SESSION_OPTION] = SESSION_ID
    /* eslint-enable no-param-reassign */
  }

  /**
   * Release a group's members before the group goes away.
   *
   * Foundry does not cascade group deletion, so without this every former member
   * keeps pointing at an id that no longer resolves. `BAGSCombatant` is written
   * not to trust that this succeeded -- a dangling reference falls back to the
   * combatant's own stored roll rather than breaking -- but leaving the data
   * wrong would still show up as combatants that cannot be re-grouped.
   *
   * Ungrouping first also settles the turn order for free: it is an ordinary
   * Combatant update, so Foundry's own `_preUpdateOperation` preserves the
   * cursor. By the time the group itself is deleted, nothing references it and
   * its removal cannot reorder anything.
   * @inheritDoc
   */
  static async _preDeleteOperation(documents, operation, user) {
    await super._preDeleteOperation(documents, operation, user)

    const combat = operation.parent
    if (!combat) return

    const orphaned = combat.combatants.filter((combatant) =>
      operation.ids.includes(combatant._source.group),
    )
    if (!orphaned.length) return

    await combat.updateEmbeddedDocuments(
      "Combatant",
      orphaned.map((combatant) => ({ _id: combatant.id, group: null })),
    )
  }
}
