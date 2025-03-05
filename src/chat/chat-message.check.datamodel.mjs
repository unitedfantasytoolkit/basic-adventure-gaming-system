import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const { DocumentUUIDField, StringField, ArrayField, SchemaField, ObjectField } =
  foundry.data.fields

export default class BAGSChatCheckDataModel extends foundry.abstract
  .TypeDataModel {
  static defineSchema() {
    return {}
  }

  template = `${SYSTEM_TEMPLATE_PATH}/chat-cards/check.hbs`

  get isSuccessful() {
    console.info(this.parent)
    return true
  }
}
