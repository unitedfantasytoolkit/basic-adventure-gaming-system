import { ABILITY_TYPES } from "../config/constants.mjs"
import { actionsFactory } from "../common/action.fields.mjs"

const { StringField, DocumentUUIDField, HTMLField, FilePathField } =
  foundry.data.fields

export default class BAGSAbilityDataModel extends foundry.abstract
  .TypeDataModel {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      tabs: [{ navSelector: ".tabs", contentSelector: "form", initial: "xp" }],
    })
  }

  static LOCALIZATION_PREFIXES = ["BAGS.Ability"]

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
