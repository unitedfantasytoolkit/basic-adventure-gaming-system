/**
 * @file Overrides to default Foundry behavior.
 *
 *
 */

// --- Foundry Overrides: Combat -----------------------------------------------
import BAGSCombat from "../combat/combat.mjs";
import BAGSCombatGroup from "../combat/combat-group.mjs";
import BAGSCombatant from "../combat/combatant.mjs";
import BAGSCombatantGroup from "../combat/combatant-group.mjs";
import BAGSCombatTracker from "../combat/sidebar.mjs";
import BAGSCombatTrackerConfig from "../combat/combat-config.mjs";

export const CLASS_OVERRIDE_COMBAT = BAGSCombat;
export const CLASS_OVERRIDE_COMBAT_GROUP_INITIATIVE = BAGSCombatGroup;
export const CLASS_OVERRIDE_COMBATANT = BAGSCombatant;
export const CLASS_OVERRIDE_COMBATANT_GROUP_INITIATIVE = BAGSCombatantGroup;
export const CLASS_OVERRIDE_SIDEBAR_COMBAT_TRACKER = BAGSCombatTracker;
export const CLASS_OVERRIDE_SIDEBAR_COMBAT_CONFIG = BAGSCombatTrackerConfig;

// --- Foundry Overrides: Actors -----------------------------------------------
import BAGSActor from "../actors/actor.mjs";
import BAGSCharacterDataModel from "../actors/character/actor-character-data-model.mjs";
// import BAGSMonsterDataModel   from "../actors/character/actor-monster-data-model.mjs";

export const CLASS_OVERRIDE_ACTOR = BAGSActor;
export const DATA_MODEL_ACTOR_CHARACTER = BAGSCharacterDataModel;
// export const DATA_MODEL_ACTOR_MONSTER   = BAGSMonsterDataModel;

// --- Foundry Overrides: Items ------------------------------------------------
import BAGSItem from "../items/item.mjs";
import BAGSCharacterClassDataModel from "../items/class/item-character-class-data-model.mjs";

export const CLASS_OVERRIDE_ITEM = BAGSItem;
export const DATA_MODEL_ITEM_CHARACTER_CLASS = BAGSCharacterClassDataModel;
