/**
 * @file The data model for Actors of type Monster
 */

import BaseActorDataMixin from "./actor.datamodel.mjs"
import {
  bannerFactory,
  baseFactory,
  biographicalDetailsFactory,
  hpFactory,
  modifiersFactory,
  retainerFactory,
} from "./actor.fields.mjs"

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

const buildSchema = () => {
  const savingThrowSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
  )

  const saves = savingThrowSettings?.savingThrows || {}
  const worstPossibleSave = savingThrowSettings?.worstPossible || 19

  console.info(saves)
  const savingThrowFields = Object.keys(saves).reduce(
    (obj, key) => ({
      ...obj,
      [key]: new NumberField({
        min: 0,
        nullable: false,
        blank: false,
        initial: worstPossibleSave,
        label: saves[key].label,
      }),
    }),
    {},
  )

  return {
    base: baseFactory({
      savingThrows: new SchemaField(savingThrowFields),
      attackRollOffset: new NumberField({ initial: 0 }),
    }),
    xp: new NumberField({
      integer: true,
      min: 0,
      initial: 0,
    }),
    hp: hpFactory({
      hitDice: new SchemaField({
        usesHitDice: new BooleanField({ initial: true }),
        count: new NumberField({
          integer: true,
          positive: true,
          min: 1,
          initial: 1,
        }),
        size: new NumberField({
          min: 4,
          choices: [4, 6, 8, 10, 12].reduce(
            (obj, key) => ({
              ...obj,
              [key]: `d${key}`,
            }),
            [],
          ),
          initial: 8,
          integer: true,
        }),
        modifier: new NumberField({ initial: 0 }),
      }),
    }),
    banner: bannerFactory(),
    retainer: retainerFactory(),
    modifiers: modifiersFactory({
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
      tactics: new HTMLField(),
      lair: new HTMLField(),
      intelligence: new StringField(),
    }),
    morale: new SchemaField({
      value: new NumberField({
        nullable: false,
        initial: 7,
        label: "",
        hint: "",
      }),
      isWorthPanickingOverDying: new BooleanField({
        initial: false,
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

export default class BAGSMonsterDataModel extends BaseActorDataMixin(
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

  get savingThrows() {
    return Object.entries(this.base.savingThrows)
      .map(([key, val]) => [key, val + (this.modifiers.savingThrows[key] || 0)])
      .reduce(
        (obj, [key, val]) => ({
          ...obj,
          [key]: val,
        }),
        {},
      )
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

    const armorClassOffset = descending
      ? baseAC - this.base.armorClassOffset
      : baseAC + this.base.armorClassOffset

    const baseArmorClass = this.#getBaseArmorClass(armorClassOffset)
    const armorBonuses = this.#calculateArmorBonuses()

    return descending
      ? baseArmorClass - armorBonuses
      : baseArmorClass + armorBonuses
  }

  #getBaseArmorClass(fallbackAC) {
    const wornArmor = this.parent.items.documentsByType.armor.find(
      (armor) => !armor.system.shouldTreatAsBonus,
    )

    return wornArmor?.system?.armorClass ?? fallbackAC
  }

  #calculateArmorBonuses() {
    return this.parent.items.documentsByType.armor
      .filter((armor) => armor.system.shouldTreatAsBonus)
      .reduce((total, armor) => total + armor.system.armorClass, 0)
  }

  // === Attack Bonuses ========================================================
  get attackRollOffset() {
    const monsterSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.BASE_MONSTER_STATS,
    )
    return (
      monsterSettings.stats.get(this.hp.hitDice.count)?.attackRollOffset || 0
    )
  }

  get thac0() {
    const { baseTHAC0, descending } =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.COMBAT,
      )
    if (!descending) return null

    return baseTHAC0 - this.attackRollOffset
  }

  get baseAttackBonus() {
    const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )
    // Rollup keeps overwriting combatSettings.baseAttackBonus when we try to
    // get it via destructuring.
    const bonus = combatSettings.baseAttackBonus
    const { descending } = combatSettings

    if (descending) return null

    return bonus + this.attackRollOffset
  }

  /**
   * @todo account for class basic attack bonus, if the system uses ascending AC
   */
  get meleeAttackBonus() {
    return cumulativeModifiers(
      this.baseAttackBonus,
      this.modifiers.melee.attack,
    )
  }

  get meleeDamageBonus() {
    return cumulativeModifiers(this.modifiers.melee.damage)
  }

  /**
   * @todo account for class basic attack bonus, if the system uses ascending AC
   */
  get missileAttackBonus() {
    return cumulativeModifiers(
      this.baseAttackBonus,
      this.modifiers.missile.attack,
    )
  }

  get missileDamageBonus() {
    return cumulativeModifiers(this.modifiers.missile.damage)
  }
}
