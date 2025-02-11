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
      armorBonus: new NumberField({ integer: true, initial: 0 }),
      shouldTreatAsBonus: new BooleanField({ initial: false }),
      isHeavy: new BooleanField({ initial: false }),
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
}
