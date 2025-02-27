/**
 * @file A collection of defaults and overrides for the system
 */

// --- System Config and Filepaths ---------------------------------------------
export const SYSTEM_NAME = "basic-adventure-gaming-system"
export const SYSTEM_TEMPLATE_PATH = `systems/${SYSTEM_NAME}/templates`
export const SYSTEM_ASSET_PATH = `systems/${SYSTEM_NAME}/assets`

// --- Currency ----------------------------------------------------------------
// export const DEFAULT_PLATINUM_ITEM_UUID = "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";
// export const DEFAULT_ELECTRUM_ITEM_UUID = "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";
export const DEFAULT_GOLD_ITEM_UUID =
  "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI"
// export const DEFAULT_SILVER_ITEM_UUID   = "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";
// export const DEFAULT_COPPER_ITEM_UUID   = "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";

// --- Actors ------------------------------------------------------------------
export const DEFAULT_ART_ACTOR_CHARACTER = `${SYSTEM_ASSET_PATH}/icons/actor.character.img.svg`
export const DEFAULT_ART_ACTOR_MONSTER = `${SYSTEM_ASSET_PATH}/icons/actor.monster.img.svg`
export const DEFAULT_ART_ACTOR_VEHICLE = ""

// --- Items -------------------------------------------------------------------
export const DEFAULT_ART_ITEM = ""
export const DEFAULT_ART_WEAPON = ""
export const DEFAULT_ART_ARMOR = ""
export const DEFAULT_ART_SPELL = ""
export const DEFAULT_ART_ABILITY = ""
export const DEFAULT_ART_CHARACTER_CLASS = ""

// --- Abilities ---------------------------------------------------------------
export const ABILITY_TYPES = {
  exploration: "BAGS.Abilities.Types.exploration",
  passive: "BAGS.Abilities.Types.passive",
  activeRolled: "BAGS.Abilities.Types.activeRolled",
  activeInvoked: "BAGS.Abilities.Types.activeInvoked",
}

// --- Actions -----------------------------------------------------------------
export const ACTION_DEFAULT_ATTEMPT_TERM_DICE_COUNT = 1
export const ACTION_DEFAULT_ATTEMPT_TERM_DICE_SIZE = 6
export const ACTION_DEFAULT_ATTEMPT_TARGET = 1

export const ACTION_DEFAULT_EFFECT_TERM_DICE_COUNT = 1
export const ACTION_DEFAULT_EFFECT_TERM_DICE_SIZE = 6
export const ACTION_DEFAULT_EFFECT_TARGET = 1

export const ACTION_DEFENSE_TARGETS = {
  "BAGS.None": null,
  "BAGS.Armor.ArmorClass.Short": "ac",
  "BAGS.SavingThrows.Death.Short": "death",
  "BAGS.SavingThrows.Wands.Short": "wands",
  "BAGS.SavingThrows.Paralysis.Short": "paralysis",
  "BAGS.SavingThrows.Breath.Short": "breath",
  "BAGS.SavingThrows.Spell.Short": "spell",
}

export const ROLL_RESOLUTION_OPERATORS = {
  "=": {
    resolution: (result, target) => result === target,
    label: "BAGS.Operators.Equal",
  },
  // "!=": {
  //   resolution: (result, target) => result !== target,
  //   label: "BAGS.Operators.NotEqual",
  // },
  "<": {
    resolution: (result, target) => result < target,
    label: "BAGS.Operators.LessThan",
  },
  "<=": {
    resolution: (result, target) => result <= target,
    label: "BAGS.Operators.LessThanEqual",
  },
  ">": {
    resolution: (result, target) => result > target,
    label: "BAGS.Operators.GreaterThan",
  },
  ">=": {
    resolution: (result, target) => result >= target,
    label: "BAGS.Operators.GreaterThanEqual",
  },
}

/**
 * Some rolls may allow for rerolls. This enum specifies the reroll strategy to use.
 * @readonly
 * @enum {number}
 */
export const REROLL_TYPE = {
  TAKE_WORST: -1,
  TAKE_BEST: 1,
}
