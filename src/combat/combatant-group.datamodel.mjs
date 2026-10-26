/**
 * @file System data for a CombatantGroup -- the ball of actors that rolls
 * initiative together.
 *
 * This attaches to the *base* document type rather than to a declared subtype.
 * Foundry looks a type data model up by name in `CONFIG.CombatantGroup.dataModels`
 * with no special casing for the base type, so `dataModels.base` works and needs
 * no `documentTypes` entry in system.json. That matters more for Combatants than
 * for groups -- see combatant.datamodel.mjs -- but keeping both on the base type
 * means there is one shape of each to reason about.
 */

import { declarationField } from "./combatant.datamodel.mjs"
import { SIDES, SIDE_VALUES } from "./sides.mjs"

const { ColorField, StringField } = foundry.data.fields

/**
 * @typedef {object} CombatantGroupSystemData
 * @property {string} side - Which faction this group fights for.
 * @property {Color|null} color - An explicit colour for this group, or null to
 * take the side's.
 */

/**
 * The system data model for a group of combatants.
 */
export default class BAGSCombatantGroupDataModel extends foundry.abstract
  .TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    const fields = {
      /**
       * Which faction the group fights for.
       *
       * Stored rather than derived, because the thing it would be derived from
       * -- token disposition -- cannot express the cases that matter. A charmed
       * character is still displayed as friendly.
       */
      side: new StringField({
        required: true,
        blank: false,
        initial: SIDES.HOSTILE,
        choices: SIDE_VALUES,
        label: "BAGS.Combat.Fields.Side.Label",
        hint: "BAGS.Combat.Fields.Side.Hint",
      }),

      /**
       * What colour to draw this group in.
       *
       * Null means "whatever the side uses", which is the normal state and the
       * reason a table never has to think about this. Setting one is for the
       * case the side cannot express: two hostile warbands that need telling
       * apart at a glance.
       */
      color: new ColorField({
        label: "BAGS.Combat.Fields.Color.Label",
        hint: "BAGS.Combat.Fields.Color.Hint",
      }),

      /**
       * What the group as a whole says it is about to do.
       *
       * For a GM running a mob that acts as one -- "the orcs all charge". A
       * member's own declaration always takes precedence, so this never strips
       * agency from an auto-grouped party.
       */
      declaration: declarationField(),
    }

    /**
     * Let modules contribute fields. See the equivalent in
     * combatant.datamodel.mjs for why this exists.
     * @fires BAGS.defineCombatantGroupSchema
     */
    Hooks.callAll("BAGS.defineCombatantGroupSchema", fields)

    return fields
  }
}
