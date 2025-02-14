/**
 * @file The data model for weapons -- items that are used to deal damage.
 */

import PhysicalItemDataModel from "./item.physical.datamodel.mjs"

const { BooleanField, NumberField } = foundry.data.fields

export default class BAGSItemWeaponDataModel extends PhysicalItemDataModel {
  static READ_VIEW_EDITABLE_FIELDS = ["quantity", "uses.value"]

  static defineSchema() {
    return {
      ...super.defineSchema(),
      weaponBonus: new NumberField({
        label: "BAGS.Items.Weapon.Fields.WeaponBonus.Label",
        hint: "BAGS.Items.Weapon.Fields.WeaponBonus.Hint",
        initial: 0,
      }),
      isSlow: new BooleanField({
        initial: false,
        label: "BAGS.Items.Weapon.Fields.IsSlow.Label",
        hint: "BAGS.Items.Weapon.Fields.IsSlow.Hint",
      }),
    }
  }
}
