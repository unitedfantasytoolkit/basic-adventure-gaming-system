/**
 * @file The data model for armor -- gear that makes suffering damage from
 * attacks less likely.
 */

import PhysicalItemDataMixin from "./item-physical-data-model.mjs"
import { actionsFactory } from "../common/action.fields.mjs"

const {
  StringField,
  DocumentUUIDField,
  HTMLField,
  FilePathField,
  BooleanField,
  NumberField,
  SchemaField,
} = foundry.data.fields

export default class BAGSItemArmorDataModel extends PhysicalItemDataMixin({
  actions: actionsFactory(),
}) {
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
