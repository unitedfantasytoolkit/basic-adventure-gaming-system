/**
 * @file System data for a Combatant.
 *
 * This attaches to the *base* document type deliberately. Foundry creates
 * Combatants from the token HUD, the scene controls, and drag-and-drop, and
 * every one of those paths produces a base-typed document. A declared subtype
 * would miss the schema on all of them unless each creation path were
 * intercepted, so the schema goes where the documents actually land.
 *
 * The known cost: `Document#migrateSystemData` refuses to run for base-typed
 * documents, because Foundry cannot attribute a base type to a package. Combat
 * documents are transient -- they are created for a fight and deleted after it
 * -- so there is nothing to migrate.
 */

import { buildDeclarationValueFields } from "./declarations.mjs"
import { SIDE_VALUES } from "./sides.mjs"

const { ArrayField, SchemaField, StringField } = foundry.data.fields

/**
 * The schema for what a combatant says it is about to do.
 *
 * Shared by Combatants and CombatantGroups: a GM running a mob declares once for
 * the whole warband, while a character speaks for itself. Where both exist, the
 * combatant's own declaration wins -- being auto-grouped into the party should
 * not cost a player the ability to say what they are doing.
 * @returns {SchemaField} The declaration schema.
 */
export const declarationField = () =>
  new SchemaField({
    /**
     * An id from `CONFIG.BAGS.declarationTypes`. Blank means undeclared, which
     * is always a valid state: declarations are optional, and a mode that could
     * block on an absent player is a mode that can wedge a table.
     */
    type: new StringField({
      required: true,
      blank: true,
      initial: "",
      label: "BAGS.Combat.Fields.Declaration.Type.Label",
    }),
    /**
     * An Action on the actor or one of its items, when the declared type binds
     * to one -- "I attack with my sword" rather than merely "I attack".
     */
    actionId: new StringField({ required: true, blank: true, initial: "" }),
    itemId: new StringField({ required: true, blank: true, initial: "" }),
    /** Token ids, so a declaration can name what it is aimed at. */
    targetIds: new ArrayField(new StringField(), { initial: [] }),
    /**
     * Numbers the declared action asked for -- a spell's casting time, how far
     * someone means to move.
     *
     * Built from the declaration pool rather than written out here, so a module
     * contributing a type that needs a number gets a real, validated field
     * instead of somewhere loose to put it. The pool is fully seeded during
     * `init` and a schema is not built until the first document is constructed,
     * so everything registered is present by the time this runs.
     *
     * These are typed fields and not an `ObjectField` for a reason that is not
     * tidiness: the Combatant write allowlist lets a player write their own
     * `system` directly, so a player could otherwise declare a casting time of
     * -50 and lead every round forever. `NumberField#_cast` **clamps** to the
     * field's range rather than refusing the write (`fields.mjs:1510-1517`), so
     * -50 lands as the minimum and the attempt simply does nothing. That is the
     * one check a client cannot talk its way around.
     */
    values: new SchemaField(buildDeclarationValueFields()),
  })

/**
 * @typedef {object} CombatantSystemData
 * @property {string} side - Which faction this combatant fights for when it is
 * not in a group.
 * @property {object} declaration - What it says it is about to do.
 */

/**
 * The system data model for a single combatant.
 */
export default class BAGSCombatantDataModel extends foundry.abstract
  .TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    const fields = {
      /**
       * Which faction this combatant fights for.
       *
       * Only read when the combatant is not in a group. A grouped combatant
       * takes its side from its group, always -- otherwise a character dragged
       * into the enemy's group would report one side to the morale rules and
       * another to the tracker.
       *
       * Blank means "not set yet", which is the normal state for a combatant
       * that is about to be gathered into a group anyway.
       */
      side: new StringField({
        required: true,
        blank: true,
        initial: "",
        choices: ["", ...SIDE_VALUES],
        label: "BAGS.Combat.Fields.Side.Label",
        hint: "BAGS.Combat.Fields.Side.Hint",
      }),

      declaration: declarationField(),
    }

    /**
     * Let modules contribute fields.
     *
     * Attaching to the base document type means there is exactly one slot in
     * `CONFIG.Combatant.dataModels`, so a module that wants a field of its own
     * would otherwise have to replace this model wholesale. Handlers add
     * namespaced keys to the object they are given; the return value is ignored.
     * @fires BAGS.defineCombatantSchema
     */
    Hooks.callAll("BAGS.defineCombatantSchema", fields)

    return fields
  }
}
