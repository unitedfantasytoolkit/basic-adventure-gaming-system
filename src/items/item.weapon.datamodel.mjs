/**
 * @file The data model for weapons -- items that are used to deal damage.
 */

import PhysicalItemDataModel from "./item.physical.datamodel.mjs"

const { BooleanField, NumberField } = foundry.data.fields

export default class BAGSItemWeaponDataModel extends PhysicalItemDataModel {
  static LOCALIZATION_PREFIXES = ["BAGS.Weapon"]

  static READ_VIEW_EDITABLE_FIELDS = ["quantity", "uses.value"]

  static defineSchema() {
    return {
      ...super.defineSchema(),
      weaponBonus: new NumberField({
        label: "",
        hint: "",
        initial: 0,
      }),
      isSlow: new BooleanField({ initial: false, label: "", hint: "" }),
    }
  }
}
