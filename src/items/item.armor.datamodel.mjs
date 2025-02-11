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
      armorClassOffset: new NumberField({ integer: true }),
      shouldTreatAsBonus: new BooleanField({ initial: false }),
      isHeavy: new BooleanField({ initial: false }),
    }
  }

  get armorClass() {
    const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )

    const { descending, baseAC } = combatSettings

    if (this.shouldTreatAsBonus) return this.armorClassOffset
    if (descending) return baseAC - this.armorClassOffset
    return baseAC + this.armorClassOffset
  }
}
