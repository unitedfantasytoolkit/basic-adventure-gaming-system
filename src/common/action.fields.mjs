/* eslint-disable max-lines */
// @ts-nocheck
/**
 * @file The schema factory and enums for the Action framework.
 */

/* === Constants ============================================================ */
import {
  ACTION_DEFAULT_ATTEMPT_TERM_DICE_COUNT,
  ACTION_DEFAULT_ATTEMPT_TERM_DICE_SIZE,
  ACTION_DEFAULT_EFFECT_TARGET,
  ACTION_DEFAULT_EFFECT_TERM_DICE_COUNT,
  ACTION_DEFAULT_EFFECT_TERM_DICE_SIZE,
  ROLL_RESOLUTION_OPERATORS,
  SYSTEM_ASSET_PATH,
} from "../config/constants.mjs"

/* === Data fields ========================================================== */
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

/* === Enums ================================================================ */
/**
 * The type of resource that an action might consume.
 * @readonly
 * @enum {string}
 */
export const consumedTypeOptions = {
  /** The action's parent's quantity. */
  selfQuantity: "BAGS.Actions.Consumption.Type.SelfQuantity",
  /** The action's parent's uses/charges. */
  selfUses: "BAGS.Actions.Consumption.Type.SelfUses",
  /** Quantity of another item owned by the parent item's owning actor */
  itemQuantity: "BAGS.Actions.Consumption.Type.ItemQuantity",
  /** Uses/charges of another item owned by the parent item's owning actor */
  itemUses: "BAGS.Actions.Consumption.Type.ItemUses",
  /** HP from the parent item's owning actor. */
  hp: "BAGS.Actions.Consumption.Type.HP",
  /** Spell slots of the parent item's owning actor. */
  spellslot: "BAGS.Actions.Consumption.Type.SpellSlot",
  /** Uses/charges of this action. */
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
  /**
   * This effect can be represented with code, and it uses an existing macro to
   * do so.
   */
  macro: "BAGS.Actions.Effects.Type.Macro",
  /**
   * This effect can be represented with code, and the code is embedded into
   * the effect.
   */
  script: "BAGS.Actions.Effects.Type.Script",
  /** This effect draws a result from a RollTable. */
  table: "BAGS.Actions.Effects.Type.RollTable",
  /** This effect has no mechanical impact. */
  misc: "BAGS.Actions.Effects.Type.Miscellaneous",
}

/**
 * The type of attack that an action represents.
 * @readonly
 * @enum {string}
 */
export const attackTypeOptions = {
  /** This attack uses the STR attack and damage mods. */
  melee: "BAGS.Actions.Attempt.AttackType.Melee",
  /** This attack uses the DEX attack and damage mods. */
  missile: "BAGS.Actions.Attempt.AttackType.Missile",
  /** This attack uses the base attack modifier. */
  none: "BAGS.Actions.Attempt.AttackType.None",
}

/**
 * The type of resistance an actor can use against an action's effects.
 * @readonly
 * @enum {string}
 */
export const resistanceTypeOptions = {
  /** Use a saving throw to resist this effect. */
  savingThrow: "BAGS.Actions.Effects.Resistance.Type.SavingThrow",
  /** Use a roll against an ability score to resist this effect. */
  abilityScore: "BAGS.Actions.Effects.Resistance.Type.AbilityScore",
  /** Use a roll against a static number to resist this effect. */
  number: "BAGS.Actions.Effects.Resistance.Type.Number",
}

/**
 * The frequency that an action's uses recharge.
 * @readonly
 * @enum {string}
 */
export const actionRechargeOptions = {
  /** This Action recharges every ten seconds. */
  perRound: "BAGS.Actions.RechargeType.Round",
  /** This Action recharges every ten minutes. */
  perTurn: "BAGS.Actions.RechargeType.Turn",
  /** This Action recharges every twenty-four hours. */
  perDay: "BAGS.Actions.RechargeType.Day",
  /** This Action recharges every dawn. */
  perDawn: "BAGS.Actions.RechargeType.Dawn",
  /** This Action recharges every dusk. */
  perDusk: "BAGS.Actions.RechargeType.Dusk",
  /** This Action recharges after getting the equivalent of a night's rest. */
  perRest: "BAGS.Actions.RechargeType.Rest",
  /** This Action has another, hard to automate recharge mechanism. */
  other: "BAGS.Actions.RechargeType.Other",
}

/* === The Actions Factory ================================================== */

/**
 * A unit of functionality; if an item, ability, spell, etc. can
 * -do something-, this is how we represent it.
 * @typedef Action
 * @property {string} name - The action's name.
 * @property {string} img - The path to the action's icon.
 * @property {ActionFlags} flags - Configuration for the action
 * @property {ActionLevelRange} level - What range of level should this action
 * display for?
 * @property {ActionConsumption} consumption - What does this action consume?
 * @property {string} description - A summary of the action.
 * @property {ActionUses} uses - How many uses does the action have left, if it
 * consumes itself?
 * @property {ActionEffect[]} effects - What does this action do?
 * @property {ActionAttempt} attempt - What roll is required for this action to
 * work?
 */

export const actionsFactory = (fields) => {
  /**
   * @typedef ActionFlags
   * Flags that enable or disable features of the Action.
   * @property {boolean} usesAttempt - Does this Action use an attempt roll.
   * @property {boolean} usesEffect - Does this Action have effects?
   * @property {boolean} usesLevelRestrictions - Does this action have a minimum
   * and/or maximum level?
   * @property {boolean} usesConsumption - Does this action consume anything?
   */
  const flags = new SchemaField({
    usesAttempt: new BooleanField({
      initial: true,
      label: "BAGS.Actions.Flags.UsesAttempt.Label",
      // hint: "BAGS.Actions.Flags.UsesAttempt.Hint",
    }),
    usesEffect: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.UsesEffect.Label",
      // hint: "BAGS.Actions.Flags.UsesEffect.Hint",
    }),
    usesLevelRestrictions: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.UsesLevelRestrictions.Label",
      // hint: "BAGS.Actions.Flags.UsesEffect.Hint",
    }),
    usesConsumption: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.UsesConsumption.Label",
      // hint: "BAGS.Actions.Flags.UsesEffect.Hint",
    }),
    isBlind: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.IsBlind.Label",
      hint: "BAGS.Actions.Flags.isBlind.Hint",
    }),
  })

  /**
   * @typedef ActionLevelRange
   * The character levels in which this Action is available.
   * @property {number} min - Self-explanatory.
   * @property {number} max - Self-explanatory.
   */
  const level = new SchemaField({
    min: new NumberField({
      min: 1,
      label: "BAGS.Actions.Level.Minimum.Label",
      hint: "BAGS.Actions.Level.Minimum.Hint",
    }),
    max: new NumberField({
      min: 1,
      label: "BAGS.Actions.Level.Maximum.Label",
      hint: "BAGS.Actions.Level.Maximum.Hint",
    }),
  })

  /**
   * @typedef ActionConsumption
   * Words
   * @property {consumedTypeOptions} types - What resource does this Action
   * consume?
   */
  const consumption = new SchemaField({
    type: new StringField({
      choices: consumedTypeOptions,
      label: "BAGS.Actions.Consumption.Types.Label",
      hint: "BAGS.Actions.Consumption.Types.Hint",
    }),
    item: new SchemaField({
      item: new DocumentUUIDField({
        label: "BAGS.Actions.",
        hint: "BAGS.Actions.",
      }),
      quantity: new NumberField({}),
    }),
    spellSlots: new SchemaField({
      class: new DocumentUUIDField({
        type: "Item",
      }),
      level: new NumberField({
        min: 1,
        label: "BAGS.Actions.",
        hint: "BAGS.Actions.",
      }),
    }),
  })

  /**
   * @typedef ActionUses
   * Words
   * @property {number} value - How many uses remain for this Action.
   * @property {number} max - How many uses this Action caps out at.
   * @property {actionRechargeOptions} rechargesOn - The span of time it takes
   * to recharge a use of this action.
   */
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

  /**
   * @typedef ActionEffect
   * Words
   * @property {boolean} usesAttempt - Words
   */
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
      isLikeAttack: new BooleanField({
        initial: false,
        label: "BAGS.Actions.Attempt.IsLikeAttack.Label",
        hint: "BAGS.Actions.Attempt.IsLikeAttack.Hint",
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
      roll: new SchemaField({
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
      }),
      /**
       * Static target number should only be available when the resistance's
       * type is "number."
       */
      staticTarget: new NumberField({
        label: "BAGS.Actions.Effects.Resistance.StaticTarget.Label",
        hint: "BAGS.Actions.Effects.Resistance.StaticTarget.Hint",
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

  /**
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
   */
  const attempt = new SchemaField({
    flags: new SchemaField({
      isLikeAttack: new BooleanField({
        initial: false,
        label: "BAGS.Actions.Attempt.IsLikeAttack.Label",
        hint: "BAGS.Actions.Attempt.IsLikeAttack.Hint",
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
        label: "BAGS.Actions.Attempt.Attack.Type.Label",
        hint: "BAGS.Actions.Attempt.Attack.Type.Hint",
      }),
      bonus: new NumberField({
        min: 1,
        initial: ACTION_DEFAULT_EFFECT_TARGET,
        label: "BAGS.Actions.Attempt.Attack.Bonus.Attack.Label",
        // hint: "BAGS.Actions.Attempt.Roll.Target.Hint",
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
        // hint: "BAGS.Actions.Attempt.Roll.Formula.Hint",
      }),
      operator: new StringField({
        choices: ROLL_RESOLUTION_OPERATORS,
        initial: ">=",
        label: "BAGS.Actions.Attempt.Roll.Operator.Label",
        // hint: "BAGS.Actions.Attempt.Roll.Operator.Hint",
      }),
      target: new NumberField({
        min: 1,
        initial: ACTION_DEFAULT_EFFECT_TARGET,
        label: "BAGS.Actions.Attempt.Roll.Target.Label",
        // hint: "BAGS.Actions.Attempt.Roll.Target.Hint",
      }),
    }),
    flavorText: new SchemaField({
      success: new StringField({
        label: "BAGS.Actions.Attempt.SuccessText.Label",
        // hint: "BAGS.Actions.Attempt.SuccessText.Hint",
      }),
      fail: new StringField({
        label: "BAGS.Actions.Attempt.FailText.Label",
        // hint: "BAGS.Actions.Attempt.FailText.Hint",
      }),
    }),
  })

  const schema = new SchemaField({
    id: new StringField({
      blank: false,
      nullable: false,
    }),

    name: new StringField({
      blank: false,
      initial: "New Action",
      label: "BAGS.Actions.Name.Label",
      hint: "BAGS.Actions.Name.Hint",
    }),
    img: new FilePathField({
      categories: ["IMAGE"],
      initial: `${SYSTEM_ASSET_PATH}/icons/default-action.svg`,
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

  // @TODO: Figure out a way to get `id` to autofill
  // return new ArrayField(schema, {
  //   initial: [schema.initial()],
  // })

  return new ArrayField(schema, {
    initial: [],
  })
}
