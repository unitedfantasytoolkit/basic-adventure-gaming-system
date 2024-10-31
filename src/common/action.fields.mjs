/**
 * @file The A schema factory and enums for the Action framework.
 */

import {
  ACTION_DEFAULT_ATTEMPT_TERM_DICE_COUNT,
  ACTION_DEFAULT_ATTEMPT_TERM_DICE_SIZE,
  ACTION_DEFAULT_EFFECT_TARGET,
  ACTION_DEFAULT_EFFECT_TERM_DICE_COUNT,
  ACTION_DEFAULT_EFFECT_TERM_DICE_SIZE,
  ROLL_RESOLUTION_OPERATORS,
} from "../config/constants.mjs"

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

export const consumedTypeOptions = {
  selfQuantity: "BAGS.Actions.Consumption.Type.SelfQuantity",
  selfUses: "BAGS.Actions.Consumption.Type.SelfUses",
  itemQuantity: "BAGS.Actions.Consumption.Type.ItemQuantity",
  itemUses: "BAGS.Actions.Consumption.Type.ItemUses",
  hp: "BAGS.Actions.Consumption.Type.HP",
  spellslot: "BAGS.Actions.Consumption.Type.SpellSlot",
  actionUse: "BAGS.Actions.Consumption.Type.ActionUse",
}

/**
 * The type of effect an action ought to have on whoever it targets.
 * @readonly
 * @enum {string}
 */
export const effectTypeOptions = {
  /** This action deals damage. */
  attack: "BAGS.Actions.Effects.Type.Attack",
  /** This action heals damage. */
  healing: "BAGS.Actions.Effects.Type.Healing",
  /** This effect inflicts a status effect. */
  effect: "BAGS.Actions.Effects.Type.Effect",
  /** This effect can be represented with code  */
  macro: "BAGS.Actions.Effects.Type.Macro",
  /** This effect has no mechanical impact. */
  misc: "BAGS.Actions.Effects.Type.Miscellaneous",
}

/**
 * The type of attack that an action represents.
 * @readonly
 * @enum {string}
 */
export const attackTypeOptions = {
  melee: "BAGS.Actions.Attempt.AttackType.Melee",
  missile: "BAGS.Actions.Attempt.AttackType.Missile",
  none: "BAGS.Actions.Attempt.AttackType.None",
}

/**
 * The type of resistance an actor can use against an action's effects.
 * @readonly
 * @enum {string}
 */
export const resistanceTypeOptions = {
  savingThrow: "BAGS.Actions.Effects.Resistance.Type.SavingThrow",
  abilityScore: "BAGS.Actions.Effects.Resistance.Type.AbilityScore",
  number: "BAGS.Actions.Effects.Resistance.Type.Number",
}

export const actionRechargeOptions = {
  perRound: "BAGS.Actions.RechargeType.Round",
  perTurn: "BAGS.Actions.RechargeType.Turn",
  perDay: "BAGS.Actions.RechargeType.Day",
  perRest: "BAGS.Actions.RechargeType.Rest",
  other: "BAGS.Actions.RechargeType.Other",
}

/**
 * @typedef ActionFlags
 * Words
 * @property {boolean} usesAttempt - Words
 */
/**
 * @typedef ActionFlagConfig
 * Words
 * @property {boolean} usesAttempt - Words
 */
/**
 * @typedef ActionLevelRange
 * Words
 * @property {number} min - Words
 * @property {number} max - Words
 */
/**
 * @typedef ActionUses
 * Words
 * @property {boolean} usesAttempt - Words
 */
/**
 * @typedef ActionConsumption
 * Words
 * @property {boolean} usesAttempt - Words
 */
/**
 * @typedef ActionEffect
 * Words
 * @property {boolean} usesAttempt - Words
 */
/**
 * @typedef ActionAttempt
 * Words
 * @property {string} formula - If this isn't like an attack, this is the
 * formula we'll roll against.
 * @property {boolean} isLikeAttack - Is this like an attack? If so, assume a
 * formula of `1d20`, an operator of >=, a target of the action target's AC,
 * and potential modifiers based on attackType.
 * @property {string} attackType - Melee attacks get melee mods; missile attacks
 * get missle mods; untyped attacks get the character's base attack bonus.
 * @property {unknown} target - Settings for comparing the formula result
 * against a non-attack-like target value.
 * @property {string} target.operator - The operator to compare the target value
 * against the formula.
 * @property {number} target.value - The value to compare against the formula
 * with the operator.
 * @property {string} successText -
 * @property {string} failText - Text displayed in the chat card when the action
 * attempt fails
 */

/**
 * A unit of functionality; if an item, ability, spell, etc. can
 * -do something-, this is how we represent it.
 * @typedef Action
 * @property {string} name - The action's name.
 * @property {string} img - The path to the action's icon.
 * @property {ActionFlagConfig} flags - Configuration for the action
 * @property {ActionLevelRange} level - What range of level should this action display for?
 * @property {ActionConsumption} consumption - What does this action consume?
 * @property {string} description - A summary of the action.
 * @property {ActionUses} uses - How many uses does the action have left, if it consumes itself?
 * @property {ActionEffect[]} effects - What does this action do?
 * @property {ActionAttempt} attempt -
 */

export const actionsFactory = (fields) => {
  const flags = new SchemaField({
    usesAttempt: new BooleanField({
      initial: true,
      label: "BAGS.Actions.Flags.UsesAttempt.Label",
      hint: "BAGS.Actions.Flags.UsesAttempt.Hint",
    }),
    usesEffect: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.UsesEffect.Label",
      hint: "BAGS.Actions.Flags.UsesEffect.Hint",
    }),
  })

  const level = new SchemaField({
    min: new NumberField({
      min: 1,
      label: "BAGS.Actions.",
      hint: "BAGS.Actions.",
    }),
    max: new NumberField({
      min: 1,
      label: "BAGS.Actions.",
      hint: "BAGS.Actions.",
    }),
  })

  const consumption = new SchemaField({
    type: new StringField({
      choices: consumedTypeOptions,
      label: "BAGS.Actions.Consumption.Types.Label",
      hint: "BAGS.Actions.Consumption.Types.Hint",
    }),
    item: new DocumentUUIDField({
      label: "BAGS.Actions.",
      hint: "BAGS.Actions.",
    }),
    slotLevel: new NumberField({
      min: 1,
      label: "BAGS.Actions.",
      hint: "BAGS.Actions.",
    }),
  })

  const uses = new SchemaField({
    value: new NumberField({
      min: 0,
      initial: 0,
      label: "BAGS.Actions.",
      hint: "BAGS.Actions.",
    }),
    max: new NumberField({
      min: 0,
      initial: 0,
      label: "BAGS.Actions.",
      hint: "BAGS.Actions.",
    }),
    rechargesOn: new StringField(),
  })

  const effect = new SchemaField({
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
      /**
       * Formula and operator should only be available when the
       * resistance's type is "number" or "abilityScore". It is assumed that
       * an actor should roll under a saving throw.
       */
      formula: new StringField({
        initial: "1d20",
        label: "BAGS.Actions.Effects.Resistance.Formula.Label",
        hint: "BAGS.Actions.Effects.Resistance.Formula.Hint",
      }),
      /**
       * Operator should only be available when the
       * resistance's type is "number" or "abilityScore". It is assumed that
       * an actor should roll under a saving throw.
       */
      operator: new StringField({
        choices: ROLL_RESOLUTION_OPERATORS,
        initial: "<=",
        label: "BAGS.Actions.Effects.Resistance.Operator.Label",
        hint: "BAGS.Actions.Effects.Resistance.Operator.Hint",
      }),
      abilityScore: new StringField({
        label: "BAGS.Actions.Effects.Resistance.AbilityScore.Label",
        hint: "BAGS.Actions.Effects.Resistance.AbilityScore.Hint",
      }),
      /**
       * Static target number should only be available when the resistance's type is "number."
       */
      staticTarget: new NumberField({
        label: "BAGS.Actions.Effects.Resistance.StaticTarget.Label",
        hint: "BAGS.Actions.Effects.Resistance.StaticTarget.Hint",
      }),
    }),
    macro: new SchemaField({
      fromDocument: new DocumentUUIDField({
        type: "Macro",
        label: "BAGS.Actions.Effects.Macro.Document.Label",
        hint: "BAGS.Actions.Effects.Macro.Document.Hint",
      }),
      fromEditor: new JavaScriptField({
        initial: "// Macro",
        label: "BAGS.Actions.Effects.Macro.Editor.Label",
        hint: "BAGS.Actions.Effects.Macro.Editor.Hint",
        async: true,
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
    // @todo provide means to create active effects from here
    condition: new StringField(),
  })

  const attempt = new SchemaField({
    isLikeAttack: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Attempt.IsLikeAttack.Label",
      hint: "BAGS.Actions.Attempt.IsLikeAttack.Hint",
    }),
    attackType: new StringField({
      choices: attackTypeOptions,
      nullable: false,
      blank: false,
      initial: "melee",
      label: "BAGS.Actions.Attempt.AttackType.Label",
      hint: "BAGS.Actions.Attempt.AttackType.Label",
    }),
    roll: new SchemaField({
      formula: new StringField({
        initial: `${ACTION_DEFAULT_ATTEMPT_TERM_DICE_COUNT}d${ACTION_DEFAULT_ATTEMPT_TERM_DICE_SIZE}`,
        label: "BAGS.Actions.Attempt.Roll.Formula.Label",
        hint: "BAGS.Actions.Attempt.Roll.Formula.Hint",
      }),
      operator: new StringField({
        choices: ROLL_RESOLUTION_OPERATORS,
        initial: ">=",
        label: "BAGS.Actions.Attempt.Roll.Operator.Label",
        hint: "BAGS.Actions.Attempt.Roll.Operator.Hint",
      }),
      target: new NumberField({
        min: 1,
        initial: ACTION_DEFAULT_EFFECT_TARGET,
        label: "BAGS.Actions.Attempt.Roll.Target.Label",
        hint: "BAGS.Actions.Attempt.Roll.Target.Hint",
      }),
    }),
    successText: new StringField({
      label: "BAGS.Actions.Attempt.SuccessText.Label",
      hint: "BAGS.Actions.Attempt.SuccessText.Hint",
    }),
    failText: new StringField({
      label: "BAGS.Actions.Attempt.FailText.Label",
      hint: "BAGS.Actions.Attempt.FailText.Hint",
    }),
  })

  const schema = new SchemaField({
    id: new StringField({
      blank: false,
      nullable: false,
    }),
    name: new StringField({
      blank: false,
      initial: "Localize me!",
      label: "BAGS.Actions.Name.Label",
      hint: "BAGS.Actions.Name.Hint",
    }),
    img: new FilePathField({
      categories: ["IMAGE"],
    }),
    description: new HTMLField({
      label: "BAGS.Actions.Description.Label",
      hint: "BAGS.Actions.Description.Hint",
    }),
    flags,
    level,
    consumption,
    uses,
    effects: new ArrayField(effect, { initial: [effect.initial()] }),
    attempt,
    ...fields,
  })

  return new ArrayField(schema, {
    initial: [schema.initial()],
  })
}
