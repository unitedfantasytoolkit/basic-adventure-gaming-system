/**
 * @file Setup related to chat message config -- overriding the default document
 * class, template, and so on
 */

import AbilityScoreRoll from "../dice/dice.ability-score.mjs"
import SavingThrowRoll from "../dice/dice.saving-throw.mjs"

Hooks.once("init", async () => {
  CONFIG.Dice.rolls.push(AbilityScoreRoll)
  CONFIG.Dice.rolls.push(SavingThrowRoll)
})
