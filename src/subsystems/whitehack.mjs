import rollDice from "../utils/roll-dice.mjs"

// Whitehack
CONFIG.BAGS.SavingThrowResolver.registerSystem("whitehack", {
  displayName: "Whitehack",
  saves: ["str", "dex", "con", "int", "wis", "cha"],
  mappings: {
    str: ["death"],
    dex: ["breath"],
    con: ["paralysis"],
    int: ["wands"],
    wis: ["spells"],
  },
  operator: "<=", // Roll under
  resolve: async (actor, saveName, { modifier = 0, rollMode }) => {
    const target = actor.system.abilities[saveName].value
    const roll1 = await rollDice(actor, "1d20", {
      operator: "<=",
      target,
      modifier,
    })
    const roll2 = await rollDice(actor, "1d20", {
      operator: "<=",
      target,
      modifier,
    })

    return {
      success: roll1.total <= target && roll2.total <= target,
      rolls: [roll1, roll2],
      target,
      save: saveName,
    }
  },
})
