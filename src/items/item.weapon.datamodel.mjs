/**
 * @file The data model for weapons -- items that are used to deal damage.
 */

import PhysicalItemDataMixin from "./item-physical-data-model.mjs"
import { actionsFactory } from "../common/action.fields.mjs"

const {
  StringField,
  DocumentUUIDField,
  HTMLField,
  FilePathField,
  NumberField,
  SchemaField,
} = foundry.data.fields

export default class BAGSItemWeaponDataModel extends PhysicalItemDataMixin({
  actions: actionsFactory(),
}) {
  static LOCALIZATION_PREFIXES = ["BAGS.Weapon"]

  static defineSchema() {
    return {
      flavorText: new HTMLField({
        required: false,
        blank: true,
      }),
      description: new HTMLField({
        required: false,
        blank: true,
      }),
      banner: new FilePathField({
        required: false,
        categories: ["IMAGE"],
      }),
      quantity: new NumberField({
        required: true,
        integer: true,
        min: 0,
      }),
      uses: new SchemaField({
        minimum: new NumberField({
          integer: true,
          min: 0,
        }),
        maximum: new NumberField({
          integer: true,
          min: 1,
        }),
      }),
      actions: actionsFactory(),
    }
  }

  get tooltip() {
    return `
${this.flavorText || ""}
<footer>
<span><span class="keybind">Left-Click</span> Use</span>
<span><span class="keybind">Right-Click</span> Menu</span>
</footer>
`
  }
}
