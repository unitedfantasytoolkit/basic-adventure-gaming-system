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

const cumulativeModifiers = (...modifiers) => {
  let total
  try {
    total = modifiers.reduce(total, (mod) => total + mod, 0)
    if (Number.isNaN(total)) throw new TypeError("Modifiers should be numeric")
    if (!total) return 0
    if (total > 0) return total
  } catch {
    total = 0
  }
  return total
}

export default class BAGSCharacterDataModel extends BaseActorDataMixin(
  buildSchema(),
) {
  prepareDerivedData() {}

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

  get savingThrows() {
    return this.parent.itemTypes.class[0].system.currentLevelDetails.saves
  }

  // === Attack Bonuses

  get thac0() {
    return this.parent.itemTypes.class[0].system.currentLevelDetails.thac0
  }

  get baseAttackBonus() {
    return this.parent.itemTypes.class[0].system.currentLevelDetails.attackBonus
  }

  /**
   * @todo account for class basic attack bonus, if the system uses ascending AC
   */
  get meleeAttackMod() {
    return cumulativeModifiers(
      this.abilityScores?.str?.meleeAttack,
      this.modifiers.melee.attack,
    )
  }

  get meleeDamageMod() {
    return cumulativeModifiers(
      this.abilityScores?.str?.meleeDamage,
      this.modifiers.melee.damage,
    )
  }

  get combatModStrings() {
    const toNiceString = (val) => {
      let total = val
      try {
        if (!total) return "—"
        if (total > 0) return `+${total}`
      } catch {
        total = "—"
      }
      return total
    }

    return {
      melee: {
        attack: toNiceString(this.meleeAttackMod),
        damage: toNiceString(this.meleeDamageMod),
      },
      missile: {
        attack: toNiceString(this.missileAttackMod),
        damage: toNiceString(this.missileDamageMod),
      },
    }
  }

  /**
   * @todo account for class basic attack bonus, if the system uses ascending AC
   */
  get missileAttackMod() {
    return cumulativeModifiers(
      this.abilityScores?.dex?.missileAttack,
      this.modifiers.missile.attack,
    )
  }

  get missileDamageMod() {
    return cumulativeModifiers(
      this.abilityScores?.dex?.missileDamage,
      this.modifiers.missile.damage,
    )
  }
}
