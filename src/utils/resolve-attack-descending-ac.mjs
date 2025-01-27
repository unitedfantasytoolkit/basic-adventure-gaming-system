import rollDice from "./roll-dice.mjs"

/**
 * Resolves an attack using THAC0 and descending AC rules.
 * @param {object} actor - The Actor making the attack.
 * @param {number} thac0 - The attacker's THAC0 value.
 * @param {number} targetAC - The target's Armor Class.
 * @param {object} options - Additional options for the attack roll.
 * @param {number} options.modifier - Attack roll modifier.
 * @param {string} options.rollType - Type of roll (advantage/disadvantage).
 * @returns {Promise<object>} Result of the attack including success/failure.
 */
async function resolveThac0Attack(actor, thac0, targetAC, options = {}) {
  try {
    // Calculate the target number needed on d20
    const targetNumber = thac0 - targetAC

    // Roll the attack
    const roll = await rollDice(actor, "1d20", {
      operator: ">=",
      target: targetNumber,
      modifier: options.modifier,
      rollType: options.rollType,
    })

    // Calculate the effective AC hit
    const effectiveACHit = thac0 - roll.total

    // Determine if the attack hits
    const success = roll.total >= targetNumber

    // Check for natural 1s and 20s
    const isCriticalHit = roll.total === 20
    const isCriticalMiss = roll.total === 1

    return {
      success,
      roll,
      targetNumber,
      effectiveACHit,
      isCriticalHit,
      isCriticalMiss,
      details: `Roll: ${roll.total} vs Target: ${targetNumber} (THAC0: ${thac0}, AC: ${targetAC})`,
    }
  } catch (error) {
    console.error("Error resolving THAC0 attack:", error)
    throw error
  }
}
