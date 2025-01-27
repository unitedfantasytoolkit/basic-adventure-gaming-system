import rollDice from "../utils/roll-dice.mjs"

// Into the Odd
CONFIG.BAGS.SavingThrowResolver.registerSystem("into-the-odd", {
  displayName: "Into the Odd",
  saves: ["str", "dex", "wil"],
  mappings: {
    str: ["death", "paralysis"],
    dex: ["breath", "wands"],
    wil: ["spells"],
  },
  operator: "<=", // Roll under
  resolve: async (actor, saveName, { modifier = 0, rollMode }) => {
    const target = actor.system.abilities[saveName].value
    const roll = await rollDice(actor, "1d20", {
      operator: "<=",
      target,
      modifier,
      rollType: rollMode,
    })

    return {
      success: roll.total <= target,
      rolls: [roll],
      target,
      save: saveName,
    }
  },
})
