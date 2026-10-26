/**
 * @file System data for a Combat -- per-encounter overrides of the world's
 * initiative settings.
 *
 * Without this, every knob is a world setting, and a GM cannot run a B/X
 * skirmish and a 2nd Edition duel in the same world without changing a setting
 * that retroactively re-sorts every saved encounter. Each field here is nullable,
 * and null means "use the world setting".
 */

import {
  DECLARATION_MODE,
  REROLL_CADENCE,
  TURN_GRANULARITY,
} from "./initiative-config.mjs"

const { StringField } = foundry.data.fields

/**
 * @typedef {object} CombatSystemData
 * @property {string|null} initiativePreset - An INITIATIVE rules module id.
 * @property {string|null} turnGranularity - Whether the turn cursor steps by
 * unit or by combatant.
 * @property {string|null} rerollCadence - What happens to initiative between
 * rounds.
 */

/**
 * The system data model for a combat encounter.
 */
export default class BAGSCombatDataModel extends foundry.abstract
  .TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    /**
     * Every field follows the same pattern: nullable, defaulting to null, where
     * null defers to the world setting. Foundry has no "inherit" primitive, so
     * this is the convention that stands in for one.
     * @param {object} [options] - Extra field options, such as `choices`.
     * @returns {StringField} A field that defers to the world by default.
     */
    const inheritable = (options = {}) =>
      new StringField({
        required: false,
        nullable: true,
        blank: false,
        initial: null,
        ...options,
      })

    return {
      initiativePreset: inheritable({
        label: "BAGS.Combat.Fields.InitiativePreset.Label",
        hint: "BAGS.Combat.Fields.InitiativePreset.Hint",
      }),
      turnGranularity: inheritable({
        choices: Object.values(TURN_GRANULARITY),
        label: "BAGS.Combat.Fields.TurnGranularity.Label",
        hint: "BAGS.Combat.Fields.TurnGranularity.Hint",
      }),
      rerollCadence: inheritable({
        choices: Object.values(REROLL_CADENCE),
        label: "BAGS.Combat.Fields.RerollCadence.Label",
        hint: "BAGS.Combat.Fields.RerollCadence.Hint",
      }),
      declarationMode: inheritable({
        choices: Object.values(DECLARATION_MODE),
        label: "BAGS.Combat.Fields.DeclarationMode.Label",
        hint: "BAGS.Combat.Fields.DeclarationMode.Hint",
      }),
    }
  }
}
