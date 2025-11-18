/**
 * @file Consumption and uses schema fields for the Action framework.
 */

import { actionRechargeOptions, consumedTypeOptions } from "./action.enums.mjs"

const { StringField, NumberField, SchemaField, DocumentUUIDField } =
  foundry.data.fields

/**
 * Schema for action consumption.
 * @typedef ActionConsumption
 * Resource consumption configuration for an action.
 * @property {consumedTypeOptions} type - What resource does this Action
 * consume?
 * @returns {SchemaField} The consumption schema
 */
export function consumptionFieldFactory() {
  return new SchemaField({
    type: new StringField({
      choices: consumedTypeOptions,
      label: "BAGS.Actions.Consumption.Types.Label",
      hint: "BAGS.Actions.Consumption.ResourceType.Hint",
    }),
    item: new SchemaField({
      item: new DocumentUUIDField({
        label: "BAGS.Actions.Consumption.Item.Label",
        hint: "BAGS.Actions.Consumption.ItemConsumption.ItemHint",
      }),
      quantity: new NumberField({
        label: "BAGS.Actions.Consumption.Quantity.Label",
        hint: "BAGS.Actions.Consumption.ItemConsumption.QuantityHint",
      }),
    }),
    spellSlots: new SchemaField({
      class: new DocumentUUIDField({
        type: "Item",
        label: "BAGS.Actions.Consumption.SpellSlot.Class.Label",
        hint: "BAGS.Actions.Consumption.SpellSlot.ClassHint",
      }),
      level: new NumberField({
        min: 1,
        label: "BAGS.Actions.Consumption.SpellSlot.Level.Label",
        hint: "BAGS.Actions.Consumption.SpellSlot.LevelHint",
      }),
    }),
  })
}

/**
 * Schema for action uses.
 * @typedef ActionUses
 * Tracks how many times an action can be used before recharging.
 * @property {number} value - How many uses remain for this Action.
 * @property {number} max - How many uses this Action caps out at.
 * @property {actionRechargeOptions} rechargesOn - The span of time it takes
 * to recharge a use of this action.
 * @returns {SchemaField} The uses schema
 */
export function usesFieldFactory() {
  return new SchemaField({
    value: new NumberField({
      min: 0,
      initial: 0,
      label: "BAGS.Actions.Uses.Value.Label",
      hint: "BAGS.Actions.Consumption.LimitedUses.ValueHint",
    }),
    max: new NumberField({
      min: 0,
      initial: 0,
      label: "BAGS.Actions.Uses.Max.Label",
      hint: "BAGS.Actions.Consumption.LimitedUses.MaxHint",
    }),
    rechargesOn: new StringField({
      choices: actionRechargeOptions,
      label: "BAGS.Actions.Uses.RechargesOn.Label",
      hint: "BAGS.Actions.Consumption.LimitedUses.RechargesOnHint",
    }),
  })
}
