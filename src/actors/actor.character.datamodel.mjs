/**
 * @file The data model for Actors of type Character.
 */
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

const buildSchema = () => {
  const abilityScoreSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
  )
  const abilityScores = abilityScoreSettings?.abilityScores || new Map()
  const abilityScoreFields = abilityScores
    .entries()
    .reduce(mapToNumberField, {})

  return {
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
      encumbrance: new NumberField({
        nullable: false,
        initial: 0,
        label: "",
        hint: "",
      }),
      speed: new NumberField({
        nullable: false,
        initial: 0,
        label: "",
        hint: "",
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
  }
}

const cumulativeModifiers = (...modifiers) => {
  let total
  try {
    total = modifiers.reduce((acc, mod) => acc + mod, 0)
    if (Number.isNaN(total)) throw new TypeError("Modifiers should be numeric")
    if (!total) return 0
  } catch {
    total = 0
  }
  return total
}

export default class BAGSCharacterDataModel extends BaseActorDataMixin(
  buildSchema,
) {
  prepareDerivedData() {}

  get encumbrance() {
    const encumbranceSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ENCUMBRANCE,
      )

    const value = encumbranceSettings.calculateEncumbrance(this)
    const thresholds = encumbranceSettings.getEncumbranceThresholds(this)

    return {
      value,
      thresholds,
    }
  }

  get speed() {
    const encumbranceSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ENCUMBRANCE,
      )

    return encumbranceSettings.getSpeedCategories(this)
  }

  get abilityScores() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )
    const abilityScores = abilityScoreSettings?.abilityScores || new Map()

    return Object.keys(this.base.abilityScores).reduce((obj, key) => {
      const value = this.base.abilityScores[key]

      return {
        ...obj,
        [key]: {
          value,
          ...abilityScores.get(key).modifiers.get(value),
        },
      }
    }, {})
  }

  get canRollAbilityScores() {
    return !Object.values(this.base.abilityScores).reduce(
      (acc, score) => acc + (typeof score === "number" ? score : 0),
      0,
    )
  }

  get savingThrows() {
    const savingThrowSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
      )
    const saves = savingThrowSettings?.savingThrows || {}
    const worstPossibleSave = savingThrowSettings?.worstPossible || 19

    const basePreparedSaves =
      this.parent.itemTypes.class[0]?.system.currentLevelDetails.saves ||
      Object.keys(saves).reduce(
        (obj, key) => ({
          ...obj,
          [key]: worstPossibleSave,
        }),
        {},
      )

    return Object.entries(basePreparedSaves)
      .map(([key, val]) => [key, val + (this.modifiers.savingThrows[key] || 0)])
      .reduce(
        (obj, [key, val]) => ({
          ...obj,
          [key]: val,
        }),
        {},
      )
  }

  /**
   * @todo Should equipped weapon actions appear here?
   */
  get actions() {
    const actionSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.CHARACTER_ACTIONS,
    )

    return actionSettings.actions
  }

  // === Armor Class ===========================================================

  /**
   * @todo Should armor be allowed to fully/partially deny dex bonus to AC?
   */
  get armorClass() {
    const { descending, baseAC } =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.COMBAT,
      )

    const baseArmorClass = this.#getBaseArmorClass(baseAC)
    const armorBonuses = this.#calculateArmorBonuses()
    const dexBonus = this.abilityScores?.dex?.ac ?? 0

    const totalModifier = armorBonuses + dexBonus

    return descending
      ? baseArmorClass - totalModifier
      : baseArmorClass + totalModifier
  }

  #getBaseArmorClass(fallbackAC) {
    const wornArmor = this.parent.items.documentsByType.armor.find(
      (armor) => armor.system.isEquipped && !armor.system.shouldTreatAsBonus,
    )

    return wornArmor?.system?.armorClass ?? fallbackAC
  }

  #calculateArmorBonuses() {
    return this.parent.items.documentsByType.armor
      .filter(
        (armor) => armor.system.isEquipped && armor.system.shouldTreatAsBonus,
      )
      .reduce((total, armor) => total + armor.system.armorClass, 0)
  }

  // === Attack Bonuses ========================================================

  get thac0() {
    return (
      this.parent.itemTypes.class[0]?.system.currentLevelDetails.thac0 || 19
    )
  }

  get baseAttackBonus() {
    const { descending } = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )
    if (descending) return 0

    return (
      this.parent.itemTypes.class[0]?.system.currentLevelDetails.attackBonus ||
      0
    )
  }

  /**
   * @todo account for class basic attack bonus, if the system uses ascending AC
   */
  get meleeAttackBonus() {
    return cumulativeModifiers(
      this.baseAttackBonus,
      this.abilityScores?.str?.meleeAttack || 0,
      this.modifiers.melee.attack,
    )
  }

  get meleeDamageBonus() {
    return cumulativeModifiers(
      this.abilityScores?.str?.meleeDamage || 0,
      this.modifiers.melee.damage,
    )
  }

  /**
   * @todo account for class basic attack bonus, if the system uses ascending AC
   */
  get missileAttackBonus() {
    return cumulativeModifiers(
      this.baseAttackBonus,
      this.abilityScores?.dex?.missileAttack,
      this.modifiers.missile.attack,
    )
  }

  get missileDamageBonus() {
    return cumulativeModifiers(
      this.abilityScores?.dex?.missileDamage,
      this.modifiers.missile.damage,
    )
  }
}
