/**
 * @file The data model for Actors of type Character.
 */
import {
  ABILITY_SCORES,
  DEFAULT_GOLD_ITEM_UUID,
} from "../../config/constants.mjs";
import mapToNumberField from "../../utils/map-to-number-field.mjs";

// import OseDataModelCharacterAC from "./data-model-classes/data-model-character-ac";
// import OseDataModelCharacterMove from "./data-model-classes/data-model-character-move";
// import OseDataModelCharacterScores from "./data-model-classes/data-model-character-scores";
// import OseDataModelCharacterSpells from "./data-model-classes/data-model-character-spells";

const {
  StringField,
  ArrayField,
  NumberField,
  BooleanField,
  ObjectField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
  FilePathField,
} = foundry.data.fields;

const saveOptions = { min: 0, nullable: false, blank: false, initial: 0 };

export default class BAGSCharacterDataModel extends foundry.abstract
  .TypeDataModel {
  prepareDerivedData() {
    // eslint-disable-next-line new-cap
    // this.encumbrance = new CONFIG.OSE.encumbrance(
    //   this.encumbrance.max,
    //   [...this.parent.items],
    //   {
    //     significantTreasure: game.settings.get(
    //       game.system.id,
    //       "significantTreasure"
    //     ),
    //     scores: this.scores,
    //   }
    // );
    // this.movement = new OseDataModelCharacterMove(
    //   this.encumbrance,
    //   this.config.movementAuto,
    //   this.movement.base
    // );
    // // @todo Once we create the new character sheet,
    // //       we shouldn't need to list both AC schemes
    // this.ac = new OseDataModelCharacterAC(
    //   false,
    //   [
    //     ...getItemsOfActorOfType(
    //       this.parent,
    //       "armor",
    //       (a) => a.system.equipped
    //     ),
    //   ],
    //   this.scores.dex.mod,
    //   this.ac.mod
    // );
    // this.aac = new OseDataModelCharacterAC(
    //   true,
    //   getItemsOfActorOfType(this.parent, "armor", (a) => a.system.equipped),
    //   this.scores.dex.mod,
    //   this.aac.mod
    // );
    // this.spells = new OseDataModelCharacterSpells(this.spells, this.#spellList);
  }

  get abilityScores() {
    return Object.keys(this.base.abilityScores).reduce((obj, key) => {
      const value = this.base.abilityScores[key];

      return {
        ...obj,
        [key]: {
          value,
          ...ABILITY_SCORES.get(key).modifiers.get(value),
        },
      };
    }, {});
  }

  static defineSchema() {
    const abilityScoreFields = ABILITY_SCORES.entries().reduce(
      mapToNumberField,
      {},
    );

    return {
      base: new SchemaField({
        abilityScores: new SchemaField(abilityScoreFields),
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
            type: "Item",
            initial: DEFAULT_GOLD_ITEM_UUID,
            blank: false,
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
      banner: new FilePathField({
        required: false,
        categories: ["IMAGE"],
        initial: "https://placehold.co/600x400/274240/d6cbb3.png",
      }),
    };
  }

  // // @todo This only needs to be public until
  // //       we can ditch sharing out AC/AAC.
  // // eslint-disable-next-line class-methods-use-this
  get #usesAscendingAC() {
    return game.settings.get(game.system.id, "useAscendingAC");
  }

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
