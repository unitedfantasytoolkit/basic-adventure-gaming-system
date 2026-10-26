/**
 * @file Works out which initiative rules are in force, and reduces them to the
 * handful of decisions the rest of the combat code actually asks about.
 *
 * Configuration comes from three places, in increasing order of specificity:
 * the rules module's own declarations, the world's settings, and any override
 * stored on an individual Combat document. A GM running a B/X skirmish and a
 * 2nd Edition duel in the same world needs that last level; everyone else never
 * touches it.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"
import {
  ATTACK_SPACING,
  DEFAULT_ROUND_LENGTH,
} from "../rules-engines/segments.mjs"
import { SURPRISE_EFFECT } from "../rules-engines/surprise.mjs"
import { toTurnOrderConfig } from "../rules-engines/turn-order.mjs"

/**
 * How the turn cursor moves.
 * @readonly
 * @enum {string}
 */
export const TURN_GRANULARITY = Object.freeze({
  /** One "next turn" step per rolling unit. */
  UNIT: "unit",
  /** One step per combatant, the way Foundry does it out of the box. */
  COMBATANT: "combatant",
  /** Work it out from the selected rules module. */
  AUTO: "auto",
})

/**
 * Whether combatants say what they are about to do.
 *
 * Binary on purpose. A "required" mode would need cross-client coordination to
 * know when everyone had declared, and any such mode can wedge on an absent or
 * AFK player. Optional means the interface invites a declaration, the rules use
 * one when it is there, and its absence is always a valid state.
 * @readonly
 * @enum {string}
 */
export const DECLARATION_MODE = Object.freeze({
  OFF: "off",
  OPTIONAL: "optional",
})

/**
 * What happens to initiative scores when a round ends.
 * @readonly
 * @enum {string}
 */
export const REROLL_CADENCE = Object.freeze({
  /** Roll again at the top of every round. What all five games actually say. */
  REROLL: "reroll",
  /** Keep last round's scores. */
  KEEP: "keep",
  /** Clear the scores and wait to be told to roll. */
  RESET: "reset",
})

/**
 * Used when no rules module can be resolved.
 *
 * `SystemRegistry.getSelectedOfCategory` swallows every error and returns
 * undefined, so a world saved against a rules module that has since been
 * uninstalled is indistinguishable from one that was never configured. Falling
 * back to plain B/X keeps such a world playable.
 * @type {object}
 */
export const FALLBACK_RULES = Object.freeze({
  id: "",
  name: "",
  ruleset: "bx",
  formula: "1d6",
  decimals: 0,
  direction: "high",
  rollingUnit: "group",
  perMemberOffsets: false,
  surprise: Object.freeze({
    formula: "1d6",
    surprisedOn: 2,
    effect: SURPRISE_EFFECT.ROUND,
  }),
  morale: Object.freeze({ formula: "2d6" }),
})

/**
 * Read a world setting without exploding if it has not been registered.
 *
 * Data preparation can run before `init.settings.mjs` has finished, and a
 * combat tracker that throws during prep is a lot harder to diagnose than one
 * that briefly shows a default.
 * @param {string} key - The setting's key.
 * @param {*} fallback - What to return if the setting is unavailable.
 * @returns {*} The stored value, or the fallback.
 */
export const safeSetting = (key, fallback) => {
  try {
    return game.settings.get(SYSTEM_NAME, key) ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Find the rules module a given combat is being run under.
 * @param {Combat} [combat] - The combat in question. Omit for the world default.
 * @returns {object} An INITIATIVE registry component, or FALLBACK_RULES.
 */
export const resolveInitiativeRules = (combat) => {
  const registry = CONFIG.BAGS?.SystemRegistry
  if (!registry) return FALLBACK_RULES

  const override = combat?.system?.initiativePreset
  const rules = override
    ? registry.get(registry.categories.INITIATIVE, override)
    : registry.getSelectedOfCategory(registry.categories.INITIATIVE)

  return rules ?? FALLBACK_RULES
}

/**
 * Decide whether the turn cursor steps past a whole unit at a time.
 *
 * Stepping a unit at a time is what makes side initiative bearable: a fight
 * between four characters and six orcs is two decisions, and it should not cost
 * ten clicks to play out. But it is only coherent when every member of a unit
 * acts at the same moment. Once a ruleset lets members of one side resolve at
 * different points -- AD&D casting times, 2nd Edition weapon speeds -- skipping
 * the unit would skip past the very ordering the ruleset went to the trouble of
 * working out.
 * @param {object} rules - The resolved rules module.
 * @param {string} setting - The world or per-combat granularity preference.
 * @returns {string} Either TURN_GRANULARITY.UNIT or TURN_GRANULARITY.COMBATANT.
 */
const resolveGranularity = (rules, setting) => {
  const canStepByUnit =
    rules.rollingUnit === "group" && rules.perMemberOffsets !== true

  if (setting === TURN_GRANULARITY.UNIT) {
    return canStepByUnit ? TURN_GRANULARITY.UNIT : TURN_GRANULARITY.COMBATANT
  }
  if (setting === TURN_GRANULARITY.COMBATANT) return TURN_GRANULARITY.COMBATANT

  return canStepByUnit ? TURN_GRANULARITY.UNIT : TURN_GRANULARITY.COMBATANT
}

/**
 * Everything the combat documents and the tracker need to know about the rules
 * currently in force.
 * @typedef {object} ResolvedInitiativeConfig
 * @property {object} rules - The INITIATIVE registry component itself.
 * @property {import("../rules-engines/turn-order.mjs").TurnOrderConfig} turnOrder
 * - The subset the sorting engine reads.
 * @property {string} formula - The dice expression to roll for each unit.
 * @property {number} decimals - Display precision in the tracker.
 * @property {boolean} rollsByGroup - Whether combatants should be gathered into
 * groups when they enter combat.
 * @property {string} granularity - One of TURN_GRANULARITY, already resolved
 * away from "auto".
 * @property {string} rerollCadence - One of REROLL_CADENCE.
 * @property {string} declarationMode - One of DECLARATION_MODE.
 * @property {number} roundLength - How many segments the round has.
 * @property {boolean} usesAttackRoutines - Whether this ruleset gives combatants
 * more than one attack in a round. Gates the spacing control in the tracker's
 * configuration, which is noise in four of the five games BAGS models.
 * @property {boolean} usesSlowWeapons - Whether a weapon can be "slow" and lose
 * initiative ties. The Basic/Expert family's rule.
 * @property {boolean} usesWeaponSpeed - Whether a weapon's speed factor shifts
 * its wielder's segment. The Advanced games' rule.
 * @property {boolean} usesRateOfFire - Whether a missile weapon's own rate
 * decides how often it is loosed.
 * @property {string} attackSpacing - One of ATTACK_SPACING.
 * @property {SurpriseRule|null} surprise - How surprise is rolled and what it
 * costs, or null for a ruleset with no surprise rule.
 * @property {MoraleRule|null} morale - How morale is checked, or null for a
 * ruleset with no morale rule.
 * @property {object[]} phases - The steps of a unit's turn, in order, each
 * `{id, label, declarations}`. Empty for a ruleset without phases.
 * @property {string[]} carriesOver - Declarations that continue into the next
 * round when they land past the end of this one. Empty for a ruleset where
 * nothing does.
 */

/**
 * A ruleset's surprise rule. See `src/rules-engines/surprise.mjs`.
 * @typedef {object} SurpriseRule
 * @property {string} formula - The die each side rolls.
 * @property {number} surprisedOn - The highest roll that means surprised.
 * @property {string} effect - One of SURPRISE_EFFECT: a lost round, or lost
 * segments.
 */

/**
 * A ruleset's morale rule. See `src/rules-engines/morale.mjs`.
 * @typedef {object} MoraleRule
 * @property {string} formula - The dice each monster rolls against its rating.
 */

/**
 * Resolve the full configuration for a combat.
 *
 * Prefer `BAGSCombat#initiativeConfig`, which caches this per preparation cycle.
 * This function is the uncached implementation and is exported so that it can be
 * called for a combat that does not exist yet.
 * @param {Combat} [combat] - The combat in question.
 * @returns {ResolvedInitiativeConfig} The resolved configuration.
 */
export const resolveInitiativeConfig = (combat) => {
  const rules = resolveInitiativeRules(combat)

  const granularitySetting =
    combat?.system?.turnGranularity ||
    safeSetting("turnGranularity", TURN_GRANULARITY.AUTO)

  const rerollCadence =
    combat?.system?.rerollCadence ||
    safeSetting("rerollCadence", REROLL_CADENCE.REROLL)

  const declarationMode =
    combat?.system?.declarationMode ||
    safeSetting("declarationMode", DECLARATION_MODE.OFF)

  // The ruleset ships a default because the sensible answer differs by edition,
  // and the world setting only overrides it once a table has actually chosen.
  // Reading it the other way round would silently impose one edition's
  // convention on another the first time anyone opened the settings menu.
  const attackSpacing =
    combat?.system?.attackSpacing ||
    safeSetting("attackSpacing", "") ||
    rules.defaultAttackSpacing ||
    ATTACK_SPACING.INITIATIVE

  return {
    rules,
    turnOrder: toTurnOrderConfig(rules),
    formula: rules.formula || FALLBACK_RULES.formula,
    decimals: rules.decimals ?? FALLBACK_RULES.decimals,
    rollsByGroup: rules.rollingUnit === "group",
    granularity: resolveGranularity(rules, granularitySetting),
    rerollCadence,
    declarationMode,
    roundLength: rules.roundLength || DEFAULT_ROUND_LENGTH,
    usesAttackRoutines: rules.usesAttackRoutines === true,
    usesSlowWeapons: rules.usesSlowWeapons === true,
    usesWeaponSpeed: rules.usesWeaponSpeed === true,
    usesRateOfFire: rules.usesRateOfFire === true,
    attackSpacing,
    // A ruleset that leaves the field out gets B/X's rule; one that sets it to
    // null is saying it has no surprise roll at all.
    surprise:
      rules.surprise === undefined ? FALLBACK_RULES.surprise : rules.surprise,
    morale: rules.morale === undefined ? FALLBACK_RULES.morale : rules.morale,
    phases: Array.isArray(rules.phases) ? rules.phases : [],
    carriesOver: Array.isArray(rules.carriesOver) ? rules.carriesOver : [],
  }
}
