import html from "../utils/html.mjs"
import getModifiersOfKey from "../utils/get-modifiers-of-key.mjs"
import getEffectiveItemWeight from "../utils/get-effective-item-weight.mjs"

export default {
  baseEncumbrance: 1600,
  unitsEncumbrance: "coin",
  significantTreasureAmount: 800,
  adventuringGearBurden: 0,
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
    const { item } = actorData.parent.items.documentsByType

    return item.reduce((total, i) => {
      if (!i.system.countsAsTreasure) return total
      return total + getEffectiveItemWeight(i, actorData)
    }, 0)
  },

  /**
   * Get an actor's encumbrance thresholds -- the brackets at which they begin
   * to slow down.
   * @param {any} actorData - The system object of the actor to calculate
   * encumbrance thresholds for.
   * @returns {Record<string, number>} The encumbrance thresholds for the actor.
   */
  getEncumbranceThresholds(actorData) {
    const baseThresholds = {
      significant: this.baseEncumbrance / 2,
      maximum: this.baseEncumbrance,
    }

    const encumbranceModifier =
      getModifiersOfKey(actorData, "system.modifiers.encumbranceModifier") ?? 0

    const maximumModifier =
      getModifiersOfKey(
        actorData,
        "system.modifiers.encumbranceMaximumModifier",
      ) ?? 0

    const encumbranceMultiplier =
      getModifiersOfKey(actorData, "system.modifiers.encumbranceMultiplier") ??
      1

    // Get additive modifiers from effects
    const significantModifier =
      getModifiersOfKey(
        actorData,
        "system.modifiers.encumbranceSignificantTreasureModifier",
      ) ?? 0

    // Apply multipliers and modifiers
    return {
      significant:
        (baseThresholds.significant + encumbranceModifier) *
          encumbranceMultiplier +
        significantModifier,
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
    const { armor } = actorData.parent.items.documentsByType

    // Get speed modifiers
    const speedModifier =
      getModifiersOfKey(actorData, "system.modifiers.speed") ?? 0
    const speedMultiplier =
      getModifiersOfKey(actorData, "system.modifiers.speedMultiplier") ?? 1

    const currentEncumbrance = this.calculateEncumbrance(actorData)
    const { significant } = this.getEncumbranceThresholds(actorData)
    const hasSignificantTreasure = currentEncumbrance >= significant

    const isWearingHeavyArmor = armor.some((a) => a.system.isHeavy)
    const isWearingLightArmor = armor.some((a) => !a.system.isHeavy)

    let speed

    if (isWearingHeavyArmor)
      speed = hasSignificantTreasure
        ? this.baseSpeed * 0.25
        : this.baseSpeed * 0.5
    else if (isWearingLightArmor)
      speed = hasSignificantTreasure
        ? this.baseSpeed * 0.5
        : this.baseSpeed * 0.75
    else speed = hasSignificantTreasure ? this.baseSpeed * 0.75 : this.baseSpeed

    const ancestryBaseSpeed = actorData.ancestry?.baseSpeed
    if (ancestryBaseSpeed) {
      speed = ancestryBaseSpeed
    }

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
