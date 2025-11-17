import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const { DocumentUUIDField, StringField, NumberField, ArrayField, ObjectField } =
  foundry.data.fields

export default class BAGSChatLevelUpDataModel extends foundry.abstract
  .TypeDataModel {
  static defineSchema() {
    return {
      classItem: new DocumentUUIDField({
        type: "Item",
      }),
      actor: new DocumentUUIDField({
        type: "Actor",
      }),
      className: new StringField(),
      characterName: new StringField(),
      characterImage: new StringField(),
      oldLevel: new NumberField({ integer: true, min: 1 }),
      newLevel: new NumberField({ integer: true, min: 1 }),
      note: new StringField({ blank: true }),
      hpRoll: new ObjectField(),
      hitDieSize: new NumberField({ integer: true }),
      conMod: new NumberField({ integer: true, nullable: true }),
      improvements: new ArrayField(new StringField()),
    }
  }

  template = `${SYSTEM_TEMPLATE_PATH}/chat-cards/level-up.hbs`
}
