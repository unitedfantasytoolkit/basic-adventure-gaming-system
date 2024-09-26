/**
 * @file An init hook that sets up system-level combat overrides.
 */

import {
  DEFAULT_INITIATIVE_FORMULA_GROUP,
  DEFAULT_INITIATIVE_FORMULA_INDIVIDUAL,
  SYSTEM_NAME,
} from "../config/constants.mjs";
import {
  CLASS_OVERRIDE_COMBAT,
  CLASS_OVERRIDE_COMBATANT,
  CLASS_OVERRIDE_COMBATANT_GROUP_INITIATIVE,
  CLASS_OVERRIDE_COMBAT_GROUP_INITIATIVE,
  CLASS_OVERRIDE_SIDEBAR_COMBAT_TRACKER,
} from "../config/overrides.mjs";

Hooks.once("init", () => {
  const { usesGroupInitiative } = game.settings.get(
    SYSTEM_NAME,
    CLASS_OVERRIDE_COMBAT.CONFIG_SETTING,
  );

  CONFIG.ui.combat = CLASS_OVERRIDE_SIDEBAR_COMBAT_TRACKER;

  if (usesGroupInitiative) {
    CONFIG.Combat.documentClass = CLASS_OVERRIDE_COMBAT_GROUP_INITIATIVE;
    CONFIG.Combatant.documentClass = CLASS_OVERRIDE_COMBATANT_GROUP_INITIATIVE;
    CONFIG.Combat.initiative = {
      decimals: 2,
      formula: DEFAULT_INITIATIVE_FORMULA_GROUP,
    };
  } else {
    CONFIG.Combat.documentClass = CLASS_OVERRIDE_COMBAT;
    CONFIG.Combatant.documentClass = CLASS_OVERRIDE_COMBATANT;
    CONFIG.Combat.initiative = {
      decimals: 2,
      formula: DEFAULT_INITIATIVE_FORMULA_INDIVIDUAL,
    };
  }
});
