/**
 * @file Core schema fields for the Action framework
 * (id, name, img, description, range).
 */

import { SYSTEM_ASSET_PATH } from "../config/constants.mjs"

const {
  StringField,
  NumberField,
  BooleanField,
  SchemaField,
  HTMLField,
  FilePathField,
} = foundry.data.fields

/**
 * Schema for action identification fields.
 * @returns {object} Schema fields for id, name, img, description
 */
export function coreFieldsFactory() {
  return {
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
    range: new SchemaField({
      short: new NumberField({
        initial: 0,
        min: 0,
        integer: true,
        label: "BAGS.Actions.Range.Short",
      }),
      medium: new NumberField({
        initial: 0,
        min: 0,
        integer: true,
        label: "BAGS.Actions.Range.Medium",
      }),
      long: new NumberField({
        initial: 0,
        min: 0,
        integer: true,
        label: "BAGS.Actions.Range.Long",
      }),
    }),
    description: new HTMLField({
      label: "BAGS.Actions.Description.Label",
      hint: "BAGS.Actions.Description.Hint",
    }),
  }
}

/**
 * Schema for action flags.
 * @typedef ActionFlags
 * Flags that enable or disable features of the Action.
 * @property {boolean} usesAttempt - Does this Action use an attempt roll.
 * @property {boolean} usesEffect - Does this Action have effects?
 * @property {boolean} usesLevelRestrictions - Does this action have a minimum
 * and/or maximum level?
 * @property {boolean} usesConsumption - Does this action consume anything?
 * @returns {SchemaField} The action flags schema
 */
export function flagsFieldFactory() {
  return new SchemaField({
    usesAttempt: new BooleanField({
      initial: true,
      label: "BAGS.Actions.Flags.UsesAttempt.Label",
      hint: "BAGS.Actions.Settings.Capabilities.UsesAttempt",
    }),
    usesEffect: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.UsesEffect.Label",
      hint: "BAGS.Actions.Settings.Capabilities.UsesEffect",
    }),
    usesRestrictions: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.UsesRestrictions.Label",
      hint: "BAGS.Actions.Settings.Capabilities.UsesRestrictions",
    }),
    usesConsumption: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.UsesConsumption.Label",
      hint: "BAGS.Actions.Settings.Capabilities.UsesConsumption",
    }),
    isBlind: new BooleanField({
      initial: false,
      label: "BAGS.Actions.Flags.IsBlind.Label",
      hint: "BAGS.Actions.Settings.SpecialProperties.IsBlind",
    }),
  })
}

/**
 * Schema for level restrictions.
 * @typedef ActionLevelRange
 * The character levels in which this Action is available.
 * @property {number} min - Self-explanatory.
 * @property {number} max - Self-explanatory.
 * @returns {SchemaField} The level restriction schema
 */
export function levelFieldFactory() {
  return new SchemaField({
    min: new NumberField({
      min: 1,
      label: "BAGS.Actions.Level.Minimum.Label",
      hint: "BAGS.Actions.Restrictions.LevelRestrictions.MinHint",
    }),
    max: new NumberField({
      min: 1,
      label: "BAGS.Actions.Level.Maximum.Label",
      hint: "BAGS.Actions.Restrictions.LevelRestrictions.MaxHint",
    }),
  })
}
