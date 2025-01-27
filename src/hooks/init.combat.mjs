/**
 * @file An init hook that sets up system-level combat overrides.
 */

import {
  CLASS_OVERRIDE_COMBAT,
  CLASS_OVERRIDE_COMBATANT,
  CLASS_OVERRIDE_SIDEBAR_COMBAT_TRACKER,
} from "../config/overrides.mjs"

Hooks.once("init", () => {
  const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.COMBAT,
  )

  const initiativeSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.INITIATIVE,
  )

  CONFIG.ui.combat =
    combatSettings?.sidebar || CLASS_OVERRIDE_SIDEBAR_COMBAT_TRACKER

  CONFIG.Combat.documentClass = combatSettings?.Combat || CLASS_OVERRIDE_COMBAT
  CONFIG.Combatant.documentClass =
    combatSettings?.Combatant || CLASS_OVERRIDE_COMBATANT
  CONFIG.Combat.initiative = initiativeSettings || {
    decimals: 2,
    formula: "1d6",
  }
})
