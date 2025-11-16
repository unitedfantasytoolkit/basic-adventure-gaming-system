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
      changes: new ArrayField(
        new SchemaField({
          key: new StringField({
            blank: false,
            label: "EFFECT.ChangeKey",
          }),
          value: new StringField({
            label: "EFFECT.ChangeValue",
          }),
          mode: new NumberField({
            required: true,
            nullable: false,
            integer: true,
            initial: CONST.ACTIVE_EFFECT_MODES.ADD,
            label: "EFFECT.ChangeMode",
          }),
          priority: new NumberField({
            min: 0,
            label: "EFFECT.ChangePriority",
          }),
        }),
        { initial: [] },
      ),
      duration: new SchemaField({
        rounds: new NumberField({
          min: 0,
          initial: 0,
          label: "COMBAT.Rounds",
        }),
        seconds: new NumberField({
          min: 0,
          initial: 0,
          label: "Seconds",
        }),
        turns: new NumberField({
          min: 0,
          initial: 0,
          label: "COMBAT.Turns",
        }),
      }),
    }),
  })
}
