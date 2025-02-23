import { actionsFactory } from "../common/action.fields.mjs"
import BaseItemDataModel from "./item.datamodel.mjs"

const { DocumentUUIDField, NumberField } = foundry.data.fields

export default class BAGSSpellDataModel extends BaseItemDataModel {
  static LOCALIZATION_PREFIXES = ["BAGS.Items.Spells"]

  static defineSchema() {
    return {
      ...super.defineSchema(),
      level: new NumberField({ min: 0, initial: 1 }),
      classUUID: new DocumentUUIDField({ type: "Item" }),
      actions: actionsFactory(),
    }
  }

  get castingClass() {
    return fromUuidSync(this.classUUID)
  }

  cast() {}
}
