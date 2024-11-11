/**
 * @file The data model for Actors of type Monster
 */
// Encumbrance schemes
// import OseDataModelCharacterEncumbranceDisabled from "./data-model-classes/data-model-character-encumbrance-disabled";
// import OseDataModelCharacterSpells from "./data-model-classes/data-model-character-spells";
// import OseDataModelCharacterMove from "./data-model-classes/data-model-character-move";

import {
  DEFAULT_BASE_SPEED,
  DEFAULT_MONSTER_HIT_DIE_SIZE,
} from "../../config/constants.mjs"

const {
  StringField,
  ArrayField,
  NumberField,
  BooleanField,
  ObjectField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
} = foundry.data.fields

export default class OseDataModelMonster extends foundry.abstract
  .TypeDataModel {
  prepareDerivedData() {
    // this.encumbrance = new OseDataModelCharacterEncumbranceDisabled();
    // this.spells = new OseDataModelCharacterSpells(this.spells, this.#spellList);
    // this.movement = new OseDataModelCharacterMove(
    //   this.encumbrance,
    //   this.config.movementAuto = false,
    //   this.movement.base
    //   );
  }

  /**
   * @inheritdoc
   */
  static migrateData(source) {
    // this.#migrateMonsterLanguages(source);
    // return super.migrateData(source);
  }

  /**
   * Use an empty array for system.languages.value
   * in order to suppress Polyglot errors.
   * @param {OseDataModelMonster} source - Source data to migrate
   */
  static #migrateMonsterLanguages(source) {
    // const languages = source.languages ?? {};
    // // If languages.value isn't an iterable, use an empty array
    // if (typeof languages?.value?.[Symbol.iterator] !== "function") {
    //   languages.value = [];
    // }
  }

  // @todo define schema options; stuff like min/max values and so on.
  static defineSchema() {
    return {
      base: new SchemaField({
        speed: new NumberField({
          min: 0,
          nullable: false,
          initial: 120,
          label: "",
          hint: "",
        }),
        /**
         * Encompasses ascending AC attack bonus and descending AC THAC0
         */
        attackRollOffset: new NumberField({
          min: 0,
          nullable: false,
          initial: 0,
          label: "",
          hint: "",
        }),
        /**
         * Encompasses ascending and descending AC by being an offset from
         * the settings-defined THAC0 base *or* 0
         */
        acOffset: new NumberField({
          initial: 0,
          nullable: false,
          label: "",
          hint: "",
        }),
      }),
      modifiers: new SchemaField({
        xp: new SchemaField({
          share: new NumberField({
            min: 0,
            nullable: false,
            initial: 0,
            label: "",
            hint: "",
          }),
          bonus: new NumberField({
            min: 0,
            nullable: false,
            initial: 0,
            label: "",
            hint: "",
          }),
        }),
        melee: new SchemaField({
          attack: new NumberField({
            initial: 0,
            nullable: false,
            label: "",
            hint: "",
          }),
          damage: new NumberField({
            initial: 0,
            nullable: false,
            label: "",
            hint: "",
          }),
        }),
        missile: new SchemaField({
          attack: new NumberField({
            initial: 0,
            nullable: false,
            label: "",
            hint: "",
          }),
          damage: new NumberField({
            initial: 0,
            nullable: false,
            label: "",
            hint: "",
          }),
        }),
        initiative: new NumberField({
          initial: 0,
          nullable: false,
          label: "",
          hint: "",
        }),
        loyalty: new NumberField({
          min: 0,
          nullable: false,
          initial: 7,
          label: "",
          hint: "",
        }),
      }),
      retainer: new SchemaField({
        isRetainer: new BooleanField({
          initial: false,
          nullable: false,
          label: "",
          hint: "",
        }),
        wage: new SchemaField({
          currency: new DocumentUUIDField({
            type: "item",
            // initial: '', // @todo use gold item OR user-configured item here
            // blank: false,
            label: "",
            hint: "",
          }),
          quantity: new NumberField({
            min: 0,
            initial: 0,
            blank: false,
            label: "",
            hint: "",
          }),
        }),
      }),
      hp: new SchemaField({
        value: new NumberField({
          initial: 4,
          blank: false,
          label: "",
          hint: "",
        }),
        max: new NumberField({
          initial: 4,
          blank: false,
          min: 0,
          label: "",
          hint: "",
        }),
        temporary: new NumberField({
          initial: 0,
          blank: false,
          min: 0,
          label: "",
          hint: "",
        }),
        hitDice: new SchemaField({
          count: new NumberField({
            initial: 1,
            blank: false,
            min: 0,
            label: "",
            hint: "",
          }),
          size: new NumberField({
            initial: DEFAULT_MONSTER_HIT_DIE_SIZE,
            blank: false,
            min: 0,
            label: "",
            hint: "",
          }),
          modifier: new NumberField({
            initial: 0,
            blank: false,
            min: 0,
            label: "",
            hint: "",
          }),
        }),
      }),
      biographicalDetails: new SchemaField({
        alignment: new StringField({
          nullable: false,
          initial: "",
          label: "",
          hint: "",
        }),
        title: new StringField({
          nullable: false,
          initial: "",
          label: "",
          hint: "",
        }),
        identity: new StringField({
          nullable: false,
          initial: "",
          label: "",
          hint: "",
        }),
        description: new HTMLField({
          nullable: false,
          initial: "",
          label: "",
          hint: "",
        }),
      }),
    }
    return {
      // spells: new ObjectField(),
      // ac: new ObjectField(),
      // aac: new ObjectField(),
      // encumbrance: new SchemaField({
      //   value: new NumberField({ integer: false }),
      //   max: new NumberField({ integer: false }),
      // }),
      // movement: new ObjectField(),
      // config: new ObjectField(),
      // initiative: new ObjectField(),
      // hp: new SchemaField({
      //   hd: new StringField(),
      //   value: new NumberField({ integer: true }),
      //   max: new NumberField({ integer: true }),
      // }),
      // thac0: new ObjectField(),
      // languages: new ObjectField(),
      // saves: new SchemaField({
      //   breath: new SchemaField({ value: new NumberField({ integer: true }) }),
      //   death: new SchemaField({ value: new NumberField({ integer: true }) }),
      //   paralysis: new SchemaField({
      //     value: new NumberField({ integer: true }),
      //   }),
      //   spell: new SchemaField({ value: new NumberField({ integer: true }) }),
      //   wand: new SchemaField({ value: new NumberField({ integer: true }) }),
      // }),
      // retainer: new SchemaField({
      //   enabled: new BooleanField(),
      //   loyalty: new NumberField({ integer: true }),
      //   wage: new StringField(),
      // }),
    }
  }

  // @todo This only needs to be public until
  //       we can ditch sharing out AC/AAC.

  // get usesAscendingAC() {
  //   return game.settings.get(game.system.id, "ascendingAC");
  // }

  // get isNew() {
  //   return !Object.values(this.saves).reduce(
  //     (prev, curr) => prev + (parseInt(curr?.value, 10) || 0),
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
  //   ).sort((a, b) => a.name.localeCompare(b.name));
  // }

  // get items() {
  //   return getItemsOfActorOfType(
  //     this.parent,
  //     "item",
  //     ({ system: { treasure, containerId } }) => !treasure && !containerId
  //   ).sort((a, b) => a.name.localeCompare(b.name));
  // }

  // get weapons() {
  //   return getItemsOfActorOfType(
  //     this.parent,
  //     "weapon",
  //     ({ system: { containerId } }) => !containerId
  //   ).sort((a, b) => a.name.localeCompare(b.name));
  // }

  // get armor() {
  //   return getItemsOfActorOfType(
  //     this.parent,
  //     "armor",
  //     ({ system: { containerId } }) => !containerId
  //   ).sort((a, b) => a.name.localeCompare(b.name));
  // }

  // get abilities() {
  //   return getItemsOfActorOfType(
  //     this.parent,
  //     "ability",
  //     ({ system: { containerId } }) => !containerId
  //   ).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  // }

  // get attackPatterns() {
  //   return [...this.weapons, ...this.abilities]
  //     .sort((a, b) => {
  //       if (
  //         a.system.pattern !== "transparent" &&
  //         b.system.pattern === "transparent"
  //       )
  //         return -1;
  //       return b.type.localeCompare(a.type) || a.name.localeCompare(b.name);
  //     })
  //     .reduce((prev, curr) => {
  //       const updated = { ...prev };
  //       const { pattern } = curr.system;
  //       if (!updated[pattern]) updated[pattern] = [];
  //       return { ...updated, [pattern]: [...updated[pattern], curr] };
  //     }, {});
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
  //         (item) => !(item.type !== "weapon" || !item.system.slow)
  //       );
  // }

  // get init() {
  //   const group = game.settings.get(game.system.id, "initiative") !== "group";

  //   return group ? this.initiative.mod : 0;
  // }
}
