/**
 * @file A mixin that creates a data model that represents living creatures.
 */

const BaseActorDataMixin = (schema) =>
  class BaseActorDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
      return schema
    }

    // // @todo This only needs to be public until
    // //       we can ditch sharing out AC/AAC.
    // // eslint-disable-next-line class-methods-use-this
    // get #usesAscendingAC() {
    //   return game.settings.get(game.system.id, "useAscendingAC")
    // }

    // get meleeMod() {
    //   const ascendingAcMod = this.usesAscendingAC ? this.thac0.bba || 0 : 0;
    //   return (
    //     (this.scores.str?.mod || 0) +
    //     (this.thac0?.mod?.melee || 0) +
    //     ascendingAcMod
    //   );
    // }

    // get rangedMod() {
    //   const ascendingAcMod = this.usesAscendingAC ? this.thac0.bba || 0 : 0;
    //   return (
    //     (this.scores.dex?.mod || 0) +
    //     (this.thac0?.mod?.missile || 0) +
    //     ascendingAcMod
    //   );
    // }

    // get isNew() {
    //   const { str, int, wis, dex, con, cha } = this.scores;
    //   return ![str, int, wis, dex, con, cha].reduce(
    //     (acc, el) => acc + el.value,
    //     0
    //   );
    // }

    // get containers() {
    //   return getItemsOfActorOfType(
    //     this.parent,
    //     "container",
    //     ({ system: { containerId } }) => !containerId
    //   );
    // }

    // get treasures() {
    //   return getItemsOfActorOfType(
    //     this.parent,
    //     "item",
    //     ({ system: { treasure, containerId } }) => treasure && !containerId
    //   );
    // }

    // get carriedTreasure() {
    //   const total = this.treasures.reduce(
    //     (acc, { system: { quantity, cost } }) => acc + quantity.value * cost,
    //     0
    //   );
    //   return Math.round(total * 100) / 100;
    // }

    // get items() {
    //   return getItemsOfActorOfType(
    //     this.parent,
    //     "item",
    //     ({ system: { treasure, containerId } }) => !treasure && !containerId
    //   );
    // }

    // get weapons() {
    //   return getItemsOfActorOfType(
    //     this.parent,
    //     "weapon",
    //     ({ system: { containerId } }) => !containerId
    //   );
    // }

    // get armor() {
    //   return getItemsOfActorOfType(
    //     this.parent,
    //     "armor",
    //     ({ system: { containerId } }) => !containerId
    //   );
    // }

    // get abilities() {
    //   return getItemsOfActorOfType(
    //     this.parent,
    //     "ability",
    //     ({ system: { containerId } }) => !containerId
    //   ).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    // }

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
