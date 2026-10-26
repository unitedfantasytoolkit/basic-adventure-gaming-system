/**
 * @file The data model for armor -- gear that makes suffering damage from
 * attacks less likely.
 */

import PhysicalItemDataModel from "./item.physical.datamodel.mjs"

const { BooleanField, NumberField } = foundry.data.fields

export default class BAGSItemArmorDataModel extends PhysicalItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      armorClassOffset: new NumberField({
        label: "BAGS.Items.Armor.Fields.ArmorClassOffset.Label",
        hint: "BAGS.Items.Armor.Fields.ArmorClassOffset.Hint",
        integer: true,
        initial: 0,
      }),
      armorBonus: new NumberField({
        label: "BAGS.Items.Armor.Fields.ArmorBonus.Label",
        hint: "BAGS.Items.Armor.Fields.ArmorBonus.Hint",
        integer: true,
        initial: 0,
        step: 1,
      }),
      shouldTreatAsBonus: new BooleanField({
        label: "BAGS.Items.Armor.Fields.ShouldTreatAsBonus.Label",
        hint: "BAGS.Items.Armor.Fields.ShouldTreatAsBonus.Hint",
        initial: false,
      }),
      isHeavy: new BooleanField({
        label: "BAGS.Items.Armor.Fields.IsHeavy.Label",
        hint: "BAGS.Items.Armor.Fields.IsHeavy.Hint",
        initial: false,
      }),
    }
  }

  /**
   * What this piece of armor does to its wearer's Armor Class.
   *
   * Two different kinds of answer come out of here, depending on the item:
   *
   * - A **suit of armor** reports an absolute Armor Class -- the AC of someone
   *   wearing it and nothing else. Which way that runs depends on the rules in
   *   play: descending AC counts down from the base (B/X leather is 7), ascending
   *   AC counts up (leather is 12).
   * - A **bonus** item -- a shield, a ring of protection, anything with
   *   `shouldTreatAsBonus` set -- reports how much it *improves* AC by, and
   *   nothing more. It stays a plain positive number in both directions, because
   *   the actor is the one that knows which way to apply it: see
   *   `#calculateArmorBonuses` in the character and monster data models, which
   *   subtract the total under descending AC and add it under ascending.
   *
   * Signing the bonus here as well was a double negative under ascending rules,
   * and a shield made its wearer easier to hit.
   * @returns {number} An absolute AC, or an improvement to one
   */
  get armorClass() {
    const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )

    const { descending, baseAC } = combatSettings

    if (this.shouldTreatAsBonus) return this.armorClassOffset + this.armorBonus
    if (descending) return baseAC - this.armorClassOffset - this.armorBonus
    return baseAC + this.armorClassOffset + this.armorBonus
  }

  /**
   * Converts an absolute Armor Class value to an offset from the base AC
   * For descending AC (like AD&D): offset = baseAC - ac
   * For ascending AC: offset = ac - baseAC
   * @param {number} ac - The absolute Armor Class value to convert
   * @returns {number} The AC offset value (positive numbers are beneficial)
   * @example
   * // Descending AC (AD&D style, baseAC = 10)
   * acToOffset(5) // returns 5 (improves AC by 5)
   * acToOffset(12) // returns -2 (worsens AC by 2)
   *
   * // Ascending AC (modern style, baseAC = 10)
   * acToOffset(12) // returns 2 (improves AC by 2)
   * acToOffset(8) // returns -2 (worsens AC by 2)
   */
  static acToOffset(ac) {
    const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )

    const { descending, baseAC } = combatSettings

    if (this.shouldTreatAsBonus) return ac

    return descending
      ? baseAC - ac // For descending AC (AD&D style)
      : ac - baseAC // For ascending AC (modern style)
  }

  /**
   * Converts an AC offset value to an absolute Armor Class value
   * For descending AC (like AD&D): ac = baseAC - offset
   * For ascending AC: ac = baseAC + offset
   * @param {number} offset - The AC offset value (positive numbers are beneficial)
   * @returns {number} The absolute Armor Class value
   * @example
   * // Descending AC (AD&D style, baseAC = 10)
   * offsetToAC(5) // returns 5 (improves AC by 5)
   * offsetToAC(-2) // returns 12 (worsens AC by 2)
   *
   * // Ascending AC (modern style, baseAC = 10)
   * offsetToAC(2) // returns 12 (improves AC by 2)
   * offsetToAC(-2) // returns 8 (worsens AC by 2)
   */
  static offsetToAC(offset) {
    const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )

    const { descending, baseAC } = combatSettings

    if (this.shouldTreatAsBonus) return offset

    return descending
      ? baseAC - offset // For descending AC (AD&D style)
      : baseAC + offset // For ascending AC (modern style)
  }
}
