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

  get armorClass() {
    const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )

    const { descending, baseAC } = combatSettings

    if (this.shouldTreatAsBonus)
      return (
        this.armorClassOffset +
        (descending ? this.armorBonus : this.armorBonus * -1)
      )
    if (descending) return baseAC - this.armorClassOffset - this.armorBonus
    return baseAC + this.armorClassOffset + this.armorBonus
  }

  /**
   * Converts an absolute Armor Class value to an offset from the base AC
   * For descending AC (like AD&D): offset = baseAC - ac
   * For ascending AC: offset = ac - baseAC
   *
   * @param {number} ac - The absolute Armor Class value to convert
   * @returns {number} The AC offset value (positive numbers are beneficial)
   *
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
   *
   * @param {number} offset - The AC offset value (positive numbers are beneficial)
   * @returns {number} The absolute Armor Class value
   *
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
