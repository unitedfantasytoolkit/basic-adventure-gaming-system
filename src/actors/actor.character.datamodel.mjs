/**
 * @file The data model for Actors of type Character.
 */
import { ABILITY_SCORES } from "../config/constants.mjs"
import mapToNumberField from "../utils/map-to-number-field.mjs"
import BaseActorDataMixin from "./actor.datamodel.mjs"
import {
  baseFactory,
  bannerFactory,
  biographicalDetailsFactory,
  hpFactory,
  modifiersFactory,
  retainerFactory,
} from "./actor.fields.mjs"

// import OseDataModelCharacterAC from "./data-model-classes/data-model-character-ac";
// import OseDataModelCharacterMove from "./data-model-classes/data-model-character-move";
// import OseDataModelCharacterScores from "./data-model-classes/data-model-character-scores";
// import OseDataModelCharacterSpells from "./data-model-classes/data-model-character-spells";

const { StringField, NumberField, SchemaField } = foundry.data.fields
const abilityScoreFields = ABILITY_SCORES.entries().reduce(mapToNumberField, {})

const buildSchema = () => ({
  base: baseFactory({
    abilityScores: new SchemaField(abilityScoreFields),
  }),
  hp: hpFactory(),
  banner: bannerFactory(),
  retainer: retainerFactory(),
  modifiers: modifiersFactory({
    // ...parentSchema.modifiers.fields,
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
  }),
  biographicalDetails: biographicalDetailsFactory({
    title: new StringField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
  }),
})

export default class BAGSCharacterDataModel extends BaseActorDataMixin(
  buildSchema()
) {
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
      const value = this.base.abilityScores[key]

      return {
        ...obj,
        [key]: {
          value,
          ...ABILITY_SCORES.get(key).modifiers.get(value),
        },
      }
    }, {})
  }
}