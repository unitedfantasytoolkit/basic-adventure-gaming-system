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
  BooleanField,
  NumberField,
  SchemaField,
} = foundry.data.fields

export default class BAGSItemWeaponDataModel extends PhysicalItemDataMixin({
  actions: actionsFactory(),
}) {
  static LOCALIZATION_PREFIXES = ["BAGS.Weapon"]

  static defineSchema() {
    return {
      ...super.defineSchema(),
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
