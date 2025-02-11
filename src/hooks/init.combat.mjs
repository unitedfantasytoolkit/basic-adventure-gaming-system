/**
 * @file An init hook that sets up system-level combat overrides.
 */

Hooks.once("init", () => {
  const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.COMBAT,
  )

  const initiativeSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.INITIATIVE,
  )

  if (combatSettings?.sidebar) CONFIG.ui.combat = combatSettings.sidebar

  if (combatSettings?.Combat)
    CONFIG.Combat.documentClass = combatSettings.Combat
  if (combatSettings?.Combatant)
    CONFIG.Combatant.documentClass = combatSettings.Combatant
  CONFIG.Combat.initiative = initiativeSettings
})
