import html from "../utils/html.mjs"

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
   * Helper to calculate effective weight of an item considering containers
   * @param {Item} item - The Item to get the weight of.
   * @param {any} actorData - The system object of the actor who owns the item.
   * @returns {number} The weight of the Item.
   */
  getEffectiveItemWeight(item, actorData) {
    const { quantity } = item.system
    if (!quantity) return 0

    let { weight } = item.system

    // Apply container modifiers if item is in a container
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
    const { weapon, armor, item } = actorData.parent.items.documentsByType

    const accumulatedEncumbrance = [
      ...weapon,
      ...armor,
      ...item.filter((i) => i.system.countsAsTreasure),
    ].reduce((total, i) => {
      if (i.type === "item" && !i.system.countsAsTreasure) return total
      return total + this.getEffectiveItemWeight(i, actorData)
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

    // Get additive modifiers from effects
    const maximumModifier = this.getModifiers(
      actorData,
      "system.modifiers.encumbranceMaximumModifier",
    )

    const encumbranceMultiplier = this.getModifiers(
      actorData,
      "system.modifiers.encumbranceMultiplier",
    )

    // Apply multipliers and modifiers
    return {
      light: baseThresholds.light * encumbranceMultiplier,
      medium: baseThresholds.medium * encumbranceMultiplier,
      heavy: baseThresholds.heavy * encumbranceMultiplier,
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
    const speedModifier = this.getModifiers(actorData, "system.modifiers.speed")
    const speedMultiplier = this.getModifiers(
      actorData,
      "system.modifiers.speedMultiplier",
    )
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
