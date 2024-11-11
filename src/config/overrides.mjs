/**
 * @file Overrides to default Foundry behavior.
 */

// --- Combat ------------------------------------------------------------------
import BAGSCombat from "../combat/combat.mjs"
import BAGSCombatGroup from "../combat/combat-group.mjs"
import BAGSCombatant from "../combat/combatant.mjs"
import BAGSCombatantGroup from "../combat/combatant-group.mjs"
import BAGSCombatTracker from "../combat/sidebar.mjs"
import BAGSCombatTrackerConfig from "../combat/combat-config.mjs"
// --- Actors ------------------------------------------------------------------
import BAGSActor from "../actors/actor.document.mjs"
import BAGSCharacterDataModel from "../actors/actor.character.datamodel.mjs"
// import BAGSMonsterDataModel   from "../actors/character/actor-monster-data-model.mjs";
// --- Items -------------------------------------------------------------------
import BAGSItem from "../items/item.document.mjs"
import BAGSCharacterClassDataModel from "../items/item.character-class.datamodel.mjs"
import BAGSItemAmmunitionDataModel from "../items/item.ammunition.datamodel.mjs"
import BAGSItemMiscellaneousDataModel from "../items/item.miscellaneous.datamodel.mjs"
import BAGSAbilityDataModel from "../items/item.ability.datamodel.mjs"
import BAGSItemArmorDataModel from "../items/item.armor.datamodel.mjs"
import BAGSItemContainerDataModel from "../items/item.container.datamodel.mjs"
import BAGSItemWeaponDataModel from "../items/item.weapon.datamodel.mjs"
import BAGSSpellDataModel from "../items/item.spell.datamodel.mjs"

// === Set overrides ===========================================================
// --- Combat ------------------------------------------------------------------
export const CLASS_OVERRIDE_COMBAT = BAGSCombat
export const CLASS_OVERRIDE_COMBAT_GROUP_INITIATIVE = BAGSCombatGroup
export const CLASS_OVERRIDE_COMBATANT = BAGSCombatant
export const CLASS_OVERRIDE_COMBATANT_GROUP_INITIATIVE = BAGSCombatantGroup
export const CLASS_OVERRIDE_SIDEBAR_COMBAT_TRACKER = BAGSCombatTracker
export const CLASS_OVERRIDE_SIDEBAR_COMBAT_CONFIG = BAGSCombatTrackerConfig
// --- Actors ------------------------------------------------------------------
export const CLASS_OVERRIDE_ACTOR = BAGSActor
export const DATA_MODEL_ACTOR_CHARACTER = BAGSCharacterDataModel
// export const DATA_MODEL_ACTOR_MONSTER   = BAGSMonsterDataModel;
// --- Items -------------------------------------------------------------------
export const CLASS_OVERRIDE_ITEM = BAGSItem
export const DATA_MODEL_ITEM_ABILITY = BAGSAbilityDataModel
export const DATA_MODEL_ITEM_AMMUNITION = BAGSItemAmmunitionDataModel
export const DATA_MODEL_ITEM_ARMOR = BAGSItemArmorDataModel
export const DATA_MODEL_ITEM_CHARACTER_CLASS = BAGSCharacterClassDataModel
export const DATA_MODEL_ITEM_CONTAINER = BAGSItemContainerDataModel
export const DATA_MODEL_ITEM_MISCELLANEOUS = BAGSItemMiscellaneousDataModel
export const DATA_MODEL_ITEM_WEAPON = BAGSItemWeaponDataModel
export const DATA_MODEL_ITEM_SPELL = BAGSSpellDataModel
