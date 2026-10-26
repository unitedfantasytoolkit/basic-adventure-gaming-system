/**
 * @file Effect schema fields for the Action framework.
 */

import {
  ACTION_DEFAULT_EFFECT_TERM_DICE_COUNT,
  ACTION_DEFAULT_EFFECT_TERM_DICE_SIZE,
  ROLL_RESOLUTION_OPERATORS,
} from "../config/constants.mjs"
import { effectTypeOptions, resistanceTypeOptions } from "./action.enums.mjs"

const {
  StringField,
  ArrayField,
  NumberField,
  BooleanField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
  FilePathField,
  JavaScriptField,
} = foundry.data.fields

/**
 * The units a condition's duration can be measured in, taken from Foundry's own
 * set so the two never drift apart, and mapped to labels Foundry already ships.
 * @type {Record<string, string>}
 */
const DURATION_UNIT_CHOICES = CONST.ACTIVE_EFFECT_DURATION_UNITS.reduce(
  (choices, unit) => ({
    ...choices,
    [unit]: `EFFECT.DURATION.UNITS.${unit}`,
  }),
  {},
)

/**
 * Schema for action effects.
 * @typedef ActionEffect
 * Represents an effect that an action can apply to targets.
 * @property {boolean} usesAttempt - Words
 * @returns {SchemaField} The effect schema
 */
export function effectFieldFactory() {
  return new SchemaField({
    name: new StringField({
      label: "BAGS.Actions.Effects.Name.Label",
      initial: "New Effect",
    }),
    id: new StringField({
      blank: false,
      nullable: false,
    }),
    flags: new SchemaField({
      canBeResisted: new BooleanField({
        initial: false,
        label: "BAGS.Actions.Effects.Flags.CanBeResisted.Label",
        hint: "BAGS.Actions.Effects.Flags.CanBeResisted.Hint",
      }),
      isMagical: new BooleanField({
        initial: false,
        label: "BAGS.Actions.Effects.Flags.IsMagical.Label",
        hint: "BAGS.Actions.Effects.Flags.IsMagical.Hint",
      }),
      isLikeAttack: new BooleanField({
        initial: false,
        label: "BAGS.Actions.Effects.IsLikeAttack.Label",
        hint: "BAGS.Actions.Effects.IsLikeAttack.Hint",
      }),
    }),
    note: new StringField({
      label: "BAGS.Actions.Effects.Note.Label",
      hint: "BAGS.Actions.Effects.Note.Hint",
    }),
    description: new HTMLField({
      label: "BAGS.Actions.Effects.Description.Label",
      hint: "BAGS.Actions.Effects.Description.Hint",
    }),
    type: new StringField({
      choices: effectTypeOptions,
      initial: "attack",
      blank: false,
      nullable: false,
      label: "BAGS.Actions.Effects.Type.Label",
      hint: "BAGS.Actions.Effects.Type.Hint",
    }),
    resistance: new SchemaField({
      type: new StringField({
        initial: "savingThrow",
        choices: resistanceTypeOptions,
        label: "BAGS.Actions.Effects.Resistance.Type.Label",
        hint: "BAGS.Actions.Effects.Resistance.Type.Hint",
      }),
      savingThrow: new StringField({
        label: "BAGS.Actions.Effects.Resistance.SavingThrow.Label",
        hint: "BAGS.Actions.Effects.Resistance.SavingThrow.Hint",
      }),
      abilityScore: new StringField({
        label: "BAGS.Actions.Effects.Resistance.AbilityScore.Label",
        hint: "BAGS.Actions.Effects.Resistance.AbilityScore.Hint",
      }),
      targetRollModifier: new NumberField({
        label: "BAGS.Actions.Effects.Resistance.TargetRollModifier.Label",
        hint: "BAGS.Actions.Effects.Resistance.TargetRollModifier.Hint",
        integer: true,
      }),
      roll: new SchemaField({
        formula: new StringField({
          initial: "1d20",
          label: "BAGS.Actions.Effects.Resistance.Formula.Label",
          hint: "BAGS.Actions.Effects.Resistance.Formula.Hint",
        }),
        operator: new StringField({
          choices: ROLL_RESOLUTION_OPERATORS,
          initial: "<=",
          label: "BAGS.Actions.Effects.Resistance.Operator.Label",
          hint: "BAGS.Actions.Effects.Resistance.Operator.Hint",
        }),
        target: new NumberField({
          label: "BAGS.Actions.Effects.Resistance.StaticTarget.Label",
          hint: "BAGS.Actions.Effects.Resistance.StaticTarget.Hint",
          integer: true,
        }),
      }),
    }),
    macro: new DocumentUUIDField({
      type: "Macro",
      label: "BAGS.Actions.Effects.Macro.Document.Label",
      hint: "BAGS.Actions.Effects.Macro.Document.Hint",
    }),

    script: new JavaScriptField({
      initial:
        "/**\n * Write your own script that executes when this effect triggers.\n * @param {Actor} actor - the actor performing this action.\n * @param {Actor} target - the actor targeted by this action.\n * @param {Action} action - the action being executed.\n */",
      label: "BAGS.Actions.Effects.Script.Label",
      hint: "BAGS.Actions.Effects.Script.Hint",
      async: true,
    }),

    rollTable: new SchemaField({
      document: new DocumentUUIDField({
        type: "RollTable",
        label: "BAGS.Actions.Effects.RollTable.Document.Label",
        hint: "BAGS.Actions.Effects.RollTable.Document.Hint",
      }),
      modifier: new NumberField({
        label: "BAGS.Actions.Effects.RollTable.Editor.Label",
        hint: "BAGS.Actions.Effects.RollTable.Editor.Hint",
      }),
    }),

    areaOfEffect: new SchemaField({
      type: new StringField({
        choices: ["rectangle", "circle", "ray", "cone"],
        label: "BAGS.Actions.Effects.AreaOfEffect.Type.Label",
        hint: "BAGS.Actions.Effects.AreaOfEffect.Type.Hint",
      }),
      size: new NumberField({
        min: 0,
        label: "BAGS.Actions.Effect.AreaOfEffect.Size.Label",
        hint: "BAGS.Actions.Effect.AreaOfEffect.Size.Hint",
      }),
    }),
    formula: new StringField({
      initial: `${ACTION_DEFAULT_EFFECT_TERM_DICE_COUNT}d${ACTION_DEFAULT_EFFECT_TERM_DICE_SIZE}`,
      label: "BAGS.Actions.Effects.Formula.Label",
      hint: "BAGS.Actions.Effects.Formula.Hint",
    }),
    condition: new SchemaField({
      name: new StringField({
        label: "BAGS.Actions.Effects.Condition.Name.Label",
        initial: "New Condition",
      }),
      img: new FilePathField({
        categories: ["IMAGE"],
        label: "EFFECT.FIELDS.img.label",
      }),
      description: new HTMLField({
        label: "EFFECT.FIELDS.description.label",
      }),
      // This mirrors Foundry's own ActiveEffect change schema, because that's
      // exactly where these end up. `type` and `phase` are left unconstrained
      // for the same reason Foundry leaves them so: systems and modules can
      // register change types and phases of their own, and the editor is what
      // decides which ones to offer.
      changes: new ArrayField(
        new SchemaField({
          key: new StringField({
            blank: false,
            label: "EFFECT.FIELDS.changes.element.key.label",
          }),
          value: new StringField({
            label: "EFFECT.FIELDS.changes.element.value.label",
          }),
          type: new StringField({
            required: true,
            blank: false,
            initial: "add",
            label: "EFFECT.FIELDS.changes.element.type.label",
          }),
          phase: new StringField({
            required: true,
            blank: false,
            initial: "initial",
            label: "EFFECT.FIELDS.changes.element.phase.label",
            hint: "EFFECT.FIELDS.changes.element.phase.hint",
          }),
          priority: new NumberField({
            min: 0,
            label: "EFFECT.FIELDS.changes.element.priority.label",
          }),
        }),
        { initial: [] },
      ),
      // A duration is one amount and one unit, matching Foundry. A null value
      // means the condition lasts until somebody removes it; Foundry works out
      // the expiry event itself once there's a number here.
      duration: new SchemaField({
        value: new NumberField({
          min: 0,
          integer: true,
          nullable: true,
          initial: null,
          label: "EFFECT.FIELDS.duration.value.label",
        }),
        units: new StringField({
          required: true,
          blank: false,
          initial: "rounds",
          choices: DURATION_UNIT_CHOICES,
          label: "EFFECT.FIELDS.duration.units.label",
        }),
      }),
    }),
  })
}
