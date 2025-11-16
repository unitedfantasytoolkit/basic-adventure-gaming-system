/**
 * @file The schema factory and enums for the Action framework.
 *
 * This file serves as the main entry point that combines all action field
 * factories into the complete action schema.
 */

const { ArrayField, SchemaField } = foundry.data.fields

// Import all the field factories
import {
  coreFieldsFactory,
  flagsFieldFactory,
  levelFieldFactory,
} from "./action.fields.core.mjs"
import {
  consumptionFieldFactory,
  usesFieldFactory,
} from "./action.fields.consumption.mjs"
import { attemptFieldFactory } from "./action.fields.attempt.mjs"
import { effectFieldFactory } from "./action.fields.effects.mjs"

// Type imports for JSDoc
/**
 * @typedef {import('./action.fields.core.mjs').ActionFlags}
 * ActionFlags
 */
/**
 * @typedef {import('./action.fields.core.mjs').ActionLevelRange}
 * ActionLevelRange
 */
/**
 * @typedef {import('./action.fields.consumption.mjs').ActionConsumption}
 * ActionConsumption
 */
/**
 * @typedef {import('./action.fields.consumption.mjs').ActionUses}
 * ActionUses
 */
/**
 * @typedef {import('./action.fields.effects.mjs').ActionEffect}
 * ActionEffect
 */
/**
 * @typedef {import('./action.fields.attempt.mjs').ActionAttempt}
 * ActionAttempt
 */

// Re-export enums for backward compatibility
export {
  consumedTypeOptions,
  effectTypeOptions,
  attackTypeOptions,
  resistanceTypeOptions,
  actionRechargeOptions,
} from "./action.enums.mjs"

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

/**
 * Factory for creating a complete Action schema.
 * @param {object} fields - Additional fields to merge into the action schema
 * @param {object} options - Schema options
 * @returns {SchemaField} Complete action schema
 */
export const actionFactory = (fields = {}, options = {}) =>
  new SchemaField(
    {
      ...coreFieldsFactory(),
      flags: flagsFieldFactory(),
      level: levelFieldFactory(),
      consumption: consumptionFieldFactory(),
      uses: usesFieldFactory(),
      effects: new ArrayField(effectFieldFactory(), { initial: [] }),
      attempt: attemptFieldFactory(),
      ...fields,
    },
    options,
  )

/**
 * Factory for creating an array of actions.
 * @param {object} fields - Additional fields to merge into each action schema
 * @returns {ArrayField} Array of action schemas
 */
export const actionsFactory = (fields = {}) =>
  new ArrayField(actionFactory(fields), {
    initial: [],
  })
