/**
 * @file A mixin that creates a data model that represents living creatures.
 */

const { StringField, ArrayField } = foundry.data.fields

const BaseActorDataMixin = (schema) =>
  class BaseActorDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
      return {
        ...schema(),
        preparedSpells: new ArrayField(new StringField(), { initial: [] }),
      }
    }

    get spellList() {
      const { spells } = this.parent.items.documentsByType

      return spells
    }

    // get #spellList() {
    //   return getItemsOfActorOfType(
    //     this.parent,
    //     "spell",
    //     ({ system: { containerId } }) => !containerId
    //   );
    // }

    // get isSlow() {
    //   return this.weapons.length === 0
    //     ? false
    //     : this.weapons.every(
    //         (item) =>
    //           !(
    //             item.type !== "weapon" ||
    //             !item.system.slow ||
    //             !item.system.equipped
    //           )
    //       );
    // }

    // // @todo How to test this?
    // get init() {
    //   const group = game.settings.get(game.system.id, "initiative") !== "group";

    //   return group
    //     ? (this.initiative.value || 0) +
    //         (this.initiative.mod || 0) +
    //         this.scores.dex.init
    //     : 0;
    // }
  }

export default BaseActorDataMixin
