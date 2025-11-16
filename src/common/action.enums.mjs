/**
 * @file Enums and constant options for the Action framework.
 */

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
