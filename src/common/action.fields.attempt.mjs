/**
 * @file Attempt schema fields for the Action framework.
 */

import {
  ACTION_DEFAULT_ATTEMPT_TERM_DICE_COUNT,
  ACTION_DEFAULT_ATTEMPT_TERM_DICE_SIZE,
  ACTION_DEFAULT_EFFECT_TARGET,
  ROLL_RESOLUTION_OPERATORS,
} from "../config/constants.mjs"
import { attackTypeOptions } from "./action.enums.mjs"

const { StringField, NumberField, BooleanField, SchemaField } =
  foundry.data.fields

/**
 * Roll modes, adopted from Foundry's configuration.
 * @type {Record<string, string>}
 */
const rollModes = Object.keys(CONFIG.Dice.rollModes).reduce(
  (obj, key) => ({
    ...obj,
    [key]: CONFIG.Dice.rollModes[key].label,
  }),
  {},
)

/**
 * Schema for action attempt rolls.
 * The dice roll that determines if an Action is successfully executed.
 * @typedef ActionAttempt
 * @property {string} formula - If this isn't like an attack, this is the
 * formula we'll roll against.
 * @property {boolean} isLikeAttack - Is this like an attack? If so, assume a
 * formula of `1d20`, an operator of >=, a target of the action target's AC,
 * and potential modifiers based on attackType.
 * @property {string} attackType - Melee attacks get melee mods; missile
 * attacks get missle mods; untyped attacks get the character's base attacks
 * bonus.
 * @property {unknown} target - Settings for comparing the formula result
 * against a non-attack-like target value.
 * @property {string} target.operator - The operator to compare the target
 * value against the formula.
 * @property {number} target.value - The value to compare against the formula
 * with the operator.
 * @property {string} successText -
 * @property {string} failText - Text displayed in the chat card when the
 * action attempt fails
 * @returns {SchemaField} The attempt schema
 */
export function attemptFieldFactory() {
  return new SchemaField({
    flags: new SchemaField({
      isLikeAttack: new BooleanField({
        initial: false,
        label: "BAGS.Actions.Attempt.IsLikeAttack.Label",
        hint: "BAGS.Actions.Attempt.Type.IsLikeAttack",
      }),
      hasFlavorText: new BooleanField({
        initial: false,
        label: "BAGS.Actions.Attempt.HasFlavorText.Label",
        hint: "BAGS.Actions.Attempt.HasFlavorText.Hint",
      }),
    }),
    attack: new SchemaField({
      type: new StringField({
        choices: attackTypeOptions,
        nullable: false,
        blank: false,
        initial: "melee",
        label: "BAGS.Actions.Attempt.AttackType.Label",
        hint: "BAGS.Actions.Attempt.Attack.TypeHint",
      }),
      bonus: new NumberField({
        min: 0,
        integer: true,
        initial: ACTION_DEFAULT_EFFECT_TARGET,
        label: "BAGS.Actions.Attempt.AttackBonus.Label",
        hint: "BAGS.Actions.Attempt.Attack.BonusHint",
      }),
    }),
    roll: new SchemaField({
      type: new StringField({
        initial: CONST.DICE_ROLL_MODES.PUBLIC,
        label: "BAGS.Actions.Attempt.Roll.Formula.Label",
        choices: rollModes,
      }),
      formula: new StringField({
        initial: `${ACTION_DEFAULT_ATTEMPT_TERM_DICE_COUNT}d${ACTION_DEFAULT_ATTEMPT_TERM_DICE_SIZE}`,
        label: "BAGS.Actions.Attempt.Roll.Formula.Label",
        hint: "BAGS.Actions.Attempt.CustomRoll.FormulaHint",
      }),
      operator: new StringField({
        choices: ROLL_RESOLUTION_OPERATORS,
        initial: ">=",
        label: "BAGS.Actions.Attempt.Roll.Operator.Label",
        hint: "BAGS.Actions.Attempt.CustomRoll.OperatorHint",
      }),
      target: new NumberField({
        min: 1,
        initial: ACTION_DEFAULT_EFFECT_TARGET,
        label: "BAGS.Actions.Attempt.Roll.Target.Label",
        hint: "BAGS.Actions.Attempt.CustomRoll.TargetHint",
      }),
    }),
    flavorText: new SchemaField({
      attempt: new StringField({
        label: "BAGS.Actions.Attempt.AttemptText.Label",
      }),
      success: new StringField({
        label: "BAGS.Actions.Attempt.SuccessText.Label",
      }),
      fail: new StringField({
        label: "BAGS.Actions.Attempt.FailText.Label",
      }),
      blind: new StringField({
        label: "BAGS.Actions.Attempt.BlindText.Label",
      }),
    }),
  })
}
