import { ABILITY_TYPES } from "../config/constants.mjs"
import { actionsFactory } from "../common/action.fields.mjs"
import BaseItemDataModel from "./item.datamodel.mjs"

const { StringField, DocumentUUIDField } = foundry.data.fields

export default class BAGSAbilityDataModel extends BaseItemDataModel {
  static LOCALIZATION_PREFIXES = ["BAGS.Ability"]

  static defineSchema() {
    return {
      ...super.defineSchema(),
      type: new StringField({
        choices: ABILITY_TYPES,
      }),
      sourceUUID: new DocumentUUIDField({ type: "Item" }),
      actions: actionsFactory(),
    }
  }

  get source() {
    return fromUuidSync(this.sourceUuid)
  }
}
