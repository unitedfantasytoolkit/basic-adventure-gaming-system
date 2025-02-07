import html from "../utils/html.mjs"
import getModifiersOfKey from "../utils/get-modifiers-of-key.mjs"
import getEffectiveItemWeight from "../utils/get-effective-item-weight.mjs"

export default {
  baseEncumbrance: 1600,
  unitsEncumbrance: "coin",
  adventuringGearBurden: 80,
  baseSpeed: 120,
  unitsSpeed: "ft",

  /**
   * The encumbrance meter to be displayed on the character sheet.
   * @param {any} actorData - The system object of the actor to build out an
   * encumbrance meter for
   * @returns {string} A string representation of some HTML to be inserted into
   * the character sheet via Handlebars.
   */
  encumbranceMeter(actorData) {
    return html`
      <uft-character-info-meter
        value="${actorData.encumbrance.value}"
        max="${actorData.encumbrance.thresholds.maximum}"
        class="encumbrance"
      >
        <i
          slot="icon"
          class="fa fa-scale-balanced"
        ></i>
      </uft-character-info-meter>
    `
  },

  /**
   * Total up the actor's encumbrance.
   * @param {any} actorData - The system object of the actor to calculate
   * encumbrance thresholds for
   * @returns {number} The encumbrance total for the actor.
   */
  calculateEncumbrance(actorData) {
    const { weapon, armor, item } = actorData.parent.items.documentsByType

    const accumulatedEncumbrance = [
      ...weapon,
      ...armor,
      ...item.filter((i) => i.system.countsAsTreasure),
    ].reduce((total, i) => {
      if (i.type === "item" && !i.system.countsAsTreasure) return total
      return total + getEffectiveItemWeight(i, actorData)
    }, 0)

    const hasAdventuringGear = item.some((i) => !i.system.countsAsTreasure)

    return (
      accumulatedEncumbrance +
      (hasAdventuringGear ? this.adventuringGearBurden : 0)
    )
  },

  /**
   * Get an actor's encumbrance thresholds -- the brackets at which they begin
   * to slow down.
   * @param {any} actorData - The system object of the actor to calculate
   * encumbrance thresholds for.
   * @returns {Record<string, number>} The encumbrance thresholds for the actor.
   */
  getEncumbranceThresholds(actorData) {
    // Get base values
    const baseThresholds = {
      light: 400,
      medium: 600,
      heavy: 800,
      maximum: 1600,
    }

    const encumbranceModifier =
      getModifiersOfKey(actorData, "system.modifiers.encumbranceModifier") ?? 1

    const maximumModifier =
      getModifiersOfKey(
        actorData,
        "system.modifiers.encumbranceMaximumModifier",
      ) ?? 0

    const encumbranceMultiplier =
      getModifiersOfKey(actorData, "system.modifiers.encumbranceMultiplier") ??
      1

    // Apply multipliers and modifiers
    return {
      light:
        (baseThresholds.light + encumbranceModifier) * encumbranceMultiplier,
      medium:
        (baseThresholds.medium + encumbranceModifier) * encumbranceMultiplier,
      heavy:
        (baseThresholds.heavy + encumbranceModifier) * encumbranceMultiplier,
      maximum:
        (baseThresholds.maximum + encumbranceModifier) * encumbranceMultiplier +
        maximumModifier,
    }
  },

  /**
   * Calculate the exploration speed for a given actor.
   * @todo Only count armor worn if it's equipped
   * @param {any} actorData - The system object of the actor to calculate speed
   * for.
   * @returns {number} The exploration speed for the actor.
   */
  calculateSpeed(actorData) {
    const speedModifier =
      getModifiersOfKey(actorData, "system.modifiers.speed") ?? 0
    const speedMultiplier =
      getModifiersOfKey(actorData, "system.modifiers.speedMultiplier") ?? 1
    const currentEncumbrance = this.calculateEncumbrance(actorData)
    const thresholds = this.getEncumbranceThresholds(actorData)

    let speed
    if (currentEncumbrance > thresholds.maximum) speed = 0
    else if (currentEncumbrance > thresholds.heavy)
      speed = this.baseSpeed * 0.25
    else if (currentEncumbrance > thresholds.medium)
      speed = this.baseSpeed * 0.5
    else if (currentEncumbrance > thresholds.light)
      speed = this.baseSpeed * 0.75
    else speed = this.baseSpeed

    const speedWithMultiplier = speed * speedMultiplier
    return speedWithMultiplier ? speedWithMultiplier + speedModifier : 0
  },

  /**
   * Calculate the actor's exploration, encounter, and overland speed.
   * @param {any} actorData - The system object for the actor to get speed
   * categories for.
   * @returns {Record<string, number>} An object of speed categories and values.
   */
  getSpeedCategories(actorData) {
    const speed = this.calculateSpeed(actorData)

    return {
      exploration: speed,
      encounter: speed / 3,
      overland: speed / 5,
    }
  },
}
