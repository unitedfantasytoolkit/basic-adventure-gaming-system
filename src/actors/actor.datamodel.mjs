/**
 * @file A mixin that creates a data model that represents living creatures.
 */

import { spellLevelForClasses } from "../utils/spell-level-for-class.mjs"

const { StringField, ArrayField } = foundry.data.fields

const BaseActorDataMixin = (schema) =>
  class BaseActorDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
      return {
        ...schema(),
        preparedSpells: new ArrayField(new StringField(), { initial: [] }),
      }
    }

    /**
     * Spellcasting
     */
    get spellList() {
      return this.parent.items.documentsByType.spell
    }

    /**
     * The class Items this creature has.
     * @returns {Item[]} The classes, empty for a creature with none
     */
    get classItems() {
      return this.parent.items.documentsByType.class || []
    }

    /**
     * What level a spell counts as *for this creature*.
     *
     * A spell can sit at different levels on different classes' lists, so its
     * level depends on who's casting it. A spell none of this creature's
     * classes lists falls back to the level printed on the spell itself.
     * @param {Item} spell - The spell Item to work the level out for
     * @returns {number} The spell's level for this creature
     */
    spellLevelFor(spell) {
      return spellLevelForClasses(this.classItems, spell)
    }

    get availableSpellsByLevel() {
      const spellMap = new Map()

      this.spellList.forEach((spell) => {
        const spellLevel = this.spellLevelFor(spell)
        if (!spellMap.has(spellLevel)) spellMap.set(spellLevel, [])

        spellMap.get(spellLevel).push(spell)
      })

      return spellMap
    }

    get preparedSpellsByLevel() {
      const spellMap = new Map()

      this.preparedSpells.forEach((spellId) => {
        const spell = this.parent.items.get(spellId)
        if (!spell) return // TODO: we should remove bad spell IDs.
        const spellLevel = this.spellLevelFor(spell)
        if (!spellMap.has(spellLevel)) spellMap.set(spellLevel, [])

        spellMap.get(spellLevel).push(spell)
      })

      return spellMap
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
