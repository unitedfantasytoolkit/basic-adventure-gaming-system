/**
 * @file Swords & Wizardry saving throw system integration.
 * Implements S&W's unified saving throw where all saves use the same target number.
 * Simpler than B/X's five categories - just one save value that improves with level.
 */

import rollDice from "../utils/roll-dice.mjs"

// Swords & Wizardry saving throw system registration
CONFIG.BAGS.SavingThrowResolver.registerSystem("snw", {
  displayName: "Swords & Wizardry",
  saves: ["save"],
  mappings: {
    save: ["death", "wands", "paralysis", "breath", "spells"],
  },
  resolve: async (actor, saveName, { modifier = 0, rollMode }) => {
    const target = actor.system.saves.base
    const roll = await rollDice(actor, "1d20", {
      operator: ">=",
      target,
      modifier,
      rollType: rollMode,
    })

    return {
      success: roll.total >= target,
      rolls: [roll],
      target,
      save: saveName,
    }
  },
})
