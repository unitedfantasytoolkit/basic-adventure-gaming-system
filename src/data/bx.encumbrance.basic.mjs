import html from "../utils/html.mjs"

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
   * Helper to calculate effective weight of an item considering containers
   * @param {Item} item - The Item to get the weight of.
   * @param {any} actorData - The system object of the actor who owns the item.
   * @returns {number} The weight of the Item.
   */
  getEffectiveItemWeight(item, actorData) {
    const { quantity } = item.system
    if (!quantity) return 0

    let { weight } = item.system

    if (item.system.container?.containerId) {
      const container = actorData.parent.items.get(
        item.system.container.containerId,
      )
      if (container?.system.container?.weightModifier) {
        weight *= container.system.container.weightModifier
      }
    }

    const totalWeight = weight * quantity
    return totalWeight >= 0 ? totalWeight : 0
  },

  /**
   * Helper to get all relevant modifiers from effects
   * @todo Should we account for more than just addition?
   * @param {any} actorData - The system object of the actor to get modifiers
   * of.
   * @param {string} modifierKey - The active effect key to look up and apply.
   * @returns {number} The modifier.
   */
  getModifiers(actorData, modifierKey) {
    return actorData.parent.effects
      .filter((e) => e.changes.some((c) => c.key === modifierKey))
      .reduce(
        (total, effect) =>
          total +
          effect.changes
            .filter((c) => c.key === modifierKey)
            .reduce((sum, change) => sum + Number(change.value), 0),
        0,
      )
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
      return total + this.getEffectiveItemWeight(i, actorData)
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
    // Get base values
    const baseThresholds = {
      significant: this.baseEncumbrance / 2,
      maximum: this.baseEncumbrance,
    }

    // Get additive modifiers from effects
    const maximumModifier = this.getModifiers(
      actorData,
      "system.modifiers.encumbranceMaximumModifier",
    )

    const encumbranceMultiplier = this.getModifiers(
      actorData,
      "system.modifiers.encumbranceMultiplier",
    )

    // Get additive modifiers from effects
    const significantModifier = this.getModifiers(
      actorData,
      "system.modifiers.encumbranceSignificantTreasureModifier",
    )

    // Apply multipliers and modifiers
    return {
      significant:
        baseThresholds.significant * encumbranceMultiplier +
        significantModifier,
      maximum: baseThresholds.maximum * encumbranceMultiplier + maximumModifier,
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
    const speedModifier = this.getModifiers(actorData, "system.modifiers.speed")
    const speedMultiplier = this.getModifiers(
      actorData,
      "system.modifiers.speedMultiplier",
    )

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
