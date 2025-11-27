/**
 * @file Worlds Without Number saving throw system integration.
 * Implements WWN's three-category saves (Physical/Evasion/Mental) with
 * level-based progression and ability score modifiers.
 */

import rollDice from "../utils/roll-dice.mjs"

// Worlds Without Number saving throw system registration
CONFIG.BAGS.SavingThrowResolver.registerSystem("wwn", {
  displayName: "Worlds Without Number",
  saves: ["evasion", "physical", "mental"],
  mappings: {
    evasion: ["breath", "wands"],
    physical: ["death", "paralysis"],
    mental: ["spells"],
  },
  resolve: async (actor, saveName, { modifier = 0, rollMode }) => {
    const level = actor.system.level
    const abilityMod = {
      evasion: actor.system.abilityScores.dex.modifier,
      physical: actor.system.abilityScores.con.modifier,
      mental: actor.system.abilityScores.wis.modifier,
    }[saveName]

    const target = 15 - Math.floor(level / 2) - (abilityMod || 0)
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
