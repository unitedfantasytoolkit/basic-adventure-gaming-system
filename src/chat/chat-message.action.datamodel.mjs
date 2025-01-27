import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const { DocumentUUIDField, StringField, ArrayField, SchemaField, ObjectField } =
  foundry.data.fields

export default class BAGSChatActionDataModel extends foundry.abstract
  .TypeDataModel {
  static defineSchema() {
    return {
      actor: new DocumentUUIDField({
        type: "Actor",
      }),
      item: new DocumentUUIDField({
        type: "Item",
      }),
      action: new StringField(),
      outcome: new ArrayField(new ObjectField()),
    }
  }

  template = `${SYSTEM_TEMPLATE_PATH}/chat-cards/action-outcome.hbs`
}
