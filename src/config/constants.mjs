/**
 * @file A collection of defaults and overrides for the system
 *
 *
 */

// --- System Config and Filepaths ---------------------------------------------
export const SYSTEM_NAME = "basic-adventure-gaming-system";
export const SYSTEM_TEMPLATE_PATH = `systems/${SYSTEM_NAME}/templates`;
export const SYSTEM_ASSET_PATH = `systems/${SYSTEM_NAME}/assets`;

// --- Ability Scores and Saves ------------------------------------------------
import abilityScoreModifiers from "./ability-scores.mjs";

export const ABILITY_SCORES = abilityScoreModifiers;
export const SAVING_THROWS = [
  "death",
  "wands",
  "paralysis",
  "breath",
  "spells",
];
export const WORST_POSSIBLE_SAVE = 19;

// --- Move Speed and Encumbrance ----------------------------------------------
export const DEFAULT_BASE_SPEED = 120;
export const DEFAULT_BASE_ENCUMBRANCE = 1600;

// --- Armor Class, HP, and Hit Chance -----------------------------------------
export const DEFAULT_BASE_THAC0 = 19;
export const DEFAULT_BASE_DESCENDING_AC = DEFAULT_BASE_THAC0 - 10;
export const DEFAULT_BASE_ASCENDING_AC = 10;
export const HIT_DIE_OPTIONS = [4, 6, 8];
export const DEFAULT_CHARACTER_HIT_DIE_SIZE = HIT_DIE_OPTIONS[1];
export const DEFAULT_MONSTER_HIT_DIE_SIZE = HIT_DIE_OPTIONS[2];

// --- Initiative --------------------------------------------------------------
export const DEFAULT_INITIATIVE_FORMULA_GROUP = "1d6";
export const DEFAULT_INITIATIVE_FORMULA_INDIVIDUAL = "1d6+@initiative";

// --- Currency ----------------------------------------------------------------
// export const DEFAULT_PLATINUM_ITEM_UUID = "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";
// export const DEFAULT_ELECTRUM_ITEM_UUID = "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";
export const DEFAULT_GOLD_ITEM_UUID =
  "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";
// export const DEFAULT_SILVER_ITEM_UUID   = "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";
// export const DEFAULT_COPPER_ITEM_UUID   = "Compendium.basic-adventure-gaming-system.common-items.Item.DNa9nBcXQ7ZhmXcI";
