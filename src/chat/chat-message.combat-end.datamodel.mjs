/**
 * @file The data behind the card that closes a fight.
 *
 * Deliberately thin. This card is punctuation rather than a record -- it says
 * the fight is over and how long it took, and its job in the log is to give the
 * eye somewhere to stop when scrolling back through a session.
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const { NumberField, StringField } = foundry.data.fields

/**
 * @typedef {object} CombatEndSystemData
 * @property {string} combatId - The encounter that ended.
 * @property {string} name - What it was called, if anything.
 * @property {number} rounds - How many rounds it lasted.
 */

/**
 * The data model for a combat's closing card.
 */
export default class BAGSChatCombatEndDataModel extends foundry.abstract
  .TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      combatId: new StringField({ required: true, blank: true, initial: "" }),
      /**
       * Copied rather than looked up: the encounter is deleted the moment this
       * card is posted, so there is nothing left to ask.
       */
      name: new StringField({ required: true, blank: true, initial: "" }),
      rounds: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0,
      }),
    }
  }

  template = `${SYSTEM_TEMPLATE_PATH}/chat-cards/combat-end.hbs`
}
