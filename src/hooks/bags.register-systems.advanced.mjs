/**
 * @file Registers the Advanced games' rules modules with the SystemRegistry.
 *
 * Only the spell rules so far. A world can pick these up without taking on
 * anything else Advanced -- rules modules are chosen one category at a time, so
 * Advanced spellbooks on top of B/X combat is a supported combination rather
 * than an accident.
 */

import advancedInitiativeModules from "../data/advanced.initiative.mjs"
import {
  advancedFirstEditionSpells,
  advancedSecondEditionSpells,
} from "../data/spells.advanced.mjs"

/**
 * @typedef {import("../config/system-registry.mjs").SystemRegistry} SystemRegistry
 */

/**
 * Register rules modules for the Advanced games.
 * @param {SystemRegistry} registry - A registry of rules modules.
 */
const registerAdvanced = (registry) => {
  registry.register(registry.categories.SPELLS, advancedFirstEditionSpells)
  registry.register(registry.categories.SPELLS, advancedSecondEditionSpells)

  // None of these is flagged `default` -- B/X's group initiative keeps that, and
  // `init.settings.mjs` reads the default with no guard against there being
  // none. A table opts into segments deliberately.
  advancedInitiativeModules.forEach((initiativeModule) =>
    registry.register(registry.categories.INITIATIVE, initiativeModule),
  )
}

Hooks.once("BAGS.RegisterSystems", registerAdvanced)
