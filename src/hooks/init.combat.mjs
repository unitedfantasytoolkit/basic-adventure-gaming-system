/**
 * @file An init hook that installs the system's combat documents and configures
 * Foundry's combat subsystem from the selected initiative rules module.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"
import BAGSCombat, {
  NEXT_ROUND_QUERY,
  invalidateInitiativeConfig,
} from "../combat/combat.document.mjs"
import BAGSCombatant from "../combat/combatant.document.mjs"
import BAGSCombatantGroup from "../combat/combatant-group.document.mjs"
import BAGSCombatDataModel from "../combat/combat.datamodel.mjs"
import BAGSCombatantDataModel from "../combat/combatant.datamodel.mjs"
import BAGSCombatantGroupDataModel from "../combat/combatant-group.datamodel.mjs"
import {
  DECLARATION_MODE,
  REROLL_CADENCE,
  TURN_GRANULARITY,
  resolveInitiativeConfig,
} from "../combat/initiative-config.mjs"
import { registerUniversalDeclarations } from "../combat/declarations.mjs"
import { registerMoraleStatus } from "../combat/morale.mjs"
import { ATTACK_SPACING } from "../rules-engines/segments.mjs"

/**
 * The shape Foundry expects at `CONFIG.Combat.initiative`.
 * @typedef {object} FoundryInitiativeConfig
 * @property {string} formula - The dice expression rolled for initiative.
 * @property {number} decimals - Decimal places the tracker shows when any
 * combatant has a fractional initiative score.
 */

/**
 * Hand Foundry the two fields it reads off `CONFIG.Combat.initiative`.
 *
 * Rules modules carry more than this. Assigning the whole module, as this file
 * used to, silently overwrote `decimals` with undefined.
 * @returns {FoundryInitiativeConfig} A configuration Foundry can use.
 */
const readInitiativeConfig = () => {
  const { formula, decimals } = resolveInitiativeConfig()
  return { formula, decimals }
}

/**
 * Open the next round on a player's behalf.
 *
 * Runs on the GM's client, in answer to a query from a player who has just
 * ended the last turn of a round. Only honoured for a player whose turn it
 * actually is -- the same person Foundry offers the "end turn" control to --
 * so a stray macro cannot skip the table ahead.
 * @param {object} data - The query's data.
 * @param {string} data.combatId - The encounter to advance.
 * @param {object} context - Who is asking.
 * @param {User} context.user - The player who sent the query.
 * @returns {Promise<boolean>} Whether the round was advanced.
 */
const openNextRoundFor = async ({ combatId }, { user }) => {
  const combat = game.combats.get(combatId)
  if (!combat?.started || combat.betweenRounds) return false
  if (!combat.combatant?.players?.includes(user)) return false

  await combat.nextRound()
  return true
}

/**
 * Register the world settings that are not rules modules.
 *
 * These are table preferences rather than rule variations, which is why they are
 * plain settings instead of SystemRegistry categories: a table can prefer to
 * step through a fight one combatant at a time without that being a different
 * game.
 * @returns {void}
 */
const registerCombatSettings = () => {
  game.settings.register(SYSTEM_NAME, "turnGranularity", {
    name: "BAGS.Settings.Combat.TurnGranularity.Name",
    hint: "BAGS.Settings.Combat.TurnGranularity.Hint",
    scope: "world",
    config: false,
    type: String,
    choices: {
      [TURN_GRANULARITY.AUTO]:
        "BAGS.Settings.Combat.TurnGranularity.Choices.auto",
      [TURN_GRANULARITY.UNIT]:
        "BAGS.Settings.Combat.TurnGranularity.Choices.unit",
      [TURN_GRANULARITY.COMBATANT]:
        "BAGS.Settings.Combat.TurnGranularity.Choices.combatant",
    },
    default: TURN_GRANULARITY.AUTO,
    onChange: invalidateInitiativeConfig,
  })

  game.settings.register(SYSTEM_NAME, "rerollCadence", {
    name: "BAGS.Settings.Combat.RerollCadence.Name",
    hint: "BAGS.Settings.Combat.RerollCadence.Hint",
    scope: "world",
    config: false,
    type: String,
    choices: {
      [REROLL_CADENCE.REROLL]:
        "BAGS.Settings.Combat.RerollCadence.Choices.reroll",
      [REROLL_CADENCE.KEEP]: "BAGS.Settings.Combat.RerollCadence.Choices.keep",
      [REROLL_CADENCE.RESET]:
        "BAGS.Settings.Combat.RerollCadence.Choices.reset",
    },
    default: REROLL_CADENCE.REROLL,
    onChange: invalidateInitiativeConfig,
  })

  game.settings.register(SYSTEM_NAME, "attackSpacing", {
    name: "BAGS.Settings.Combat.AttackSpacing.Name",
    hint: "BAGS.Settings.Combat.AttackSpacing.Hint",
    scope: "world",
    config: false,
    type: String,
    choices: {
      "": "BAGS.Settings.Combat.AttackSpacing.Choices.default",
      [ATTACK_SPACING.INITIATIVE]:
        "BAGS.Settings.Combat.AttackSpacing.Choices.initiative",
      [ATTACK_SPACING.INITIATIVE_THEN_END]:
        "BAGS.Settings.Combat.AttackSpacing.Choices.initiativeThenEnd",
      [ATTACK_SPACING.SPREAD]:
        "BAGS.Settings.Combat.AttackSpacing.Choices.spread",
      [ATTACK_SPACING.EVEN]: "BAGS.Settings.Combat.AttackSpacing.Choices.even",
    },
    // Blank means "whatever the ruleset says", which is not the same as any of
    // the named strategies. Defaulting to one of them would impose an edition's
    // convention on every other edition the moment a GM opened the settings.
    default: "",
    onChange: invalidateInitiativeConfig,
  })

  game.settings.register(SYSTEM_NAME, "declarationMode", {
    name: "BAGS.Settings.Combat.DeclarationMode.Name",
    hint: "BAGS.Settings.Combat.DeclarationMode.Hint",
    scope: "world",
    config: false,
    type: String,
    choices: {
      [DECLARATION_MODE.OFF]:
        "BAGS.Settings.Combat.DeclarationMode.Choices.off",
      [DECLARATION_MODE.OPTIONAL]:
        "BAGS.Settings.Combat.DeclarationMode.Choices.optional",
    },
    // Off by default: declaring is a real change to how a table runs a round,
    // and the games that need it are the ones a GM opts into.
    default: DECLARATION_MODE.OFF,
    onChange: invalidateInitiativeConfig,
  })

  game.settings.register(SYSTEM_NAME, "showMovementBudget", {
    name: "BAGS.Settings.Combat.ShowMovementBudget.Name",
    hint: "BAGS.Settings.Combat.ShowMovementBudget.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    // On by default: the allowance already exists in the rules and the tracker
    // is where it is needed. A table that does not measure movement can turn it
    // off, and a creature with no speed on its sheet shows nothing regardless.
    default: true,
  })

  game.settings.register(SYSTEM_NAME, "blindDeclarations", {
    name: "BAGS.Settings.Combat.BlindDeclarations.Name",
    hint: "BAGS.Settings.Combat.BlindDeclarations.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    // Off by default: open declarations are simpler to run, and the Advanced
    // games are the ones where committing blind is the point.
    default: false,
    // Redraw so that what players can see changes at once, rather than the
    // next time something else happens to redraw.
    onChange: () => ui.combat?.render(),
  })

  game.settings.register(SYSTEM_NAME, "postRoundCard", {
    name: "BAGS.Settings.Combat.PostRoundCard.Name",
    hint: "BAGS.Settings.Combat.PostRoundCard.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    // Kept separate from declarations on purpose: a round marker and the turn
    // order are worth having at a table that never declares anything, and a
    // table that does declare might still not want the chat traffic.
    default: true,
  })
}

Hooks.once("init", () => {
  CONFIG.Combat.documentClass = BAGSCombat
  CONFIG.Combatant.documentClass = BAGSCombatant
  CONFIG.CombatantGroup.documentClass = BAGSCombatantGroup

  // Seed the declarable-action pool before anything can read it. Rules modules
  // add their own during `BAGS.RegisterSystems`, which has already run by now --
  // the pool is additive, so ordering only matters in that it must exist first.
  registerUniversalDeclarations()

  // Attached to the base document type rather than to declared subtypes. Foundry
  // itself creates Combatants -- from the token HUD, the scene controls, and
  // drag-and-drop -- and every one of those produces a base-typed document that
  // a declared subtype's schema would never reach.
  CONFIG.Combat.dataModels.base = BAGSCombatDataModel
  CONFIG.Combatant.dataModels.base = BAGSCombatantDataModel
  CONFIG.CombatantGroup.dataModels.base = BAGSCombatantGroupDataModel

  registerCombatSettings()

  CONFIG.Combat.initiative = readInitiativeConfig()

  CONFIG.queries[NEXT_ROUND_QUERY] = openNextRoundFor
  registerMoraleStatus()
})

/**
 * Re-read the configuration when a GM switches rules modules mid-session.
 *
 * `init.settings.mjs` fires this hook from every rules-module setting's
 * `onChange`, so filter for the one that concerns us.
 */
Hooks.on("BAGS.SystemChange", (category) => {
  if (category !== CONFIG.BAGS.SystemRegistry.categories.INITIATIVE) return

  CONFIG.Combat.initiative = readInitiativeConfig()
  invalidateInitiativeConfig()
})
