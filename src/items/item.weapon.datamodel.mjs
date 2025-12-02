/**
 * @file The data model for weapons -- items that are used to deal damage.
 */

import PhysicalItemDataModel from "./item.physical.datamodel.mjs"
import { actionFactory } from "../common/action.fields.mjs"

const { BooleanField, NumberField } = foundry.data.fields

export default class BAGSItemWeaponDataModel extends PhysicalItemDataModel {
  static READ_VIEW_EDITABLE_FIELDS = ["quantity", "uses.value"]

  static DEFAULT_ACTION_IMG = "/icons/skills/melee/strike-slashes-orange.webp"

  static defineSchema() {
    const tempObj = actionFactory()
    const defaultAttackEffect = foundry.utils.mergeObject(
      tempObj.fields.effects.element.getInitialValue(),
      {
        type: "attack",
        id: foundry.utils.randomID(),
        flags: {
          isLikeAttack: true,
        },
      },
    )
    const defaultAttack = foundry.utils.mergeObject(tempObj.getInitialValue(), {
      name: game.i18n.localize("BAGS.Items.Weapon.Actions.DefaultName"),
      id: foundry.utils.randomID(),
      img: BAGSItemWeaponDataModel.DEFAULT_ACTION_IMG,
      attempt: {
        flags: {
          isLikeAttack: true,
        },
      },
      flags: {
        usesAttempt: true,
        usesEffect: true,
      },
    })
    defaultAttack.effects = [defaultAttackEffect]

    return {
      ...super.defineSchema(),
      attack: actionFactory(undefined, {
        initial: defaultAttack,
      }),
      weaponBonus: new NumberField({
        label: "BAGS.Items.Weapon.Fields.WeaponBonus.Label",
        hint: "BAGS.Items.Weapon.Fields.WeaponBonus.Hint",
        initial: 0,
      }),
      damageBonus: new NumberField({
        label: "BAGS.Items.Weapon.Fields.DamageBonus.Label",
        hint: "BAGS.Items.Weapon.Fields.DamageBonus.Hint",
        initial: 0,
      }),
      isMagical: new BooleanField({
        initial: false,
        label: "BAGS.Items.Weapon.Fields.IsMagical.Label",
        hint: "BAGS.Items.Weapon.Fields.IsMagical.Hint",
      }),
      usesDefaultAttack: new BooleanField({
        initial: true,
        label: "BAGS.Items.Weapon.Fields.UsesDefaultAttack.Label",
        hint: "BAGS.Items.Weapon.Fields.UsesDefaultAttack.Hint",
      }),
      isSlow: new BooleanField({
        initial: false,
        label: "BAGS.Items.Weapon.Fields.IsSlow.Label",
        hint: "BAGS.Items.Weapon.Fields.IsSlow.Hint",
      }),
    }
  }

  /**
   * Returns the complete list of actions for this weapon.
   * Includes the default attack action first (if enabled), followed by any
   * additional actions (e.g., alternate attack modes, special effects).
   * For the default attack, dynamically builds the damage effect from
   * the weapon's fields (damage dice, damage bonus, attack type).
   * @returns {Array} Array of action objects
   */
  get actionList() {
    const actions = []
    if (this.usesDefaultAttack && this.attack) {
      // Clone the attack to avoid mutating the stored data
      const attack = foundry.utils.deepClone(this.attack)

      // Get damage dice from the attack's stored effect, or use default
      const baseDice = attack.effects?.[0]?.formula || "1d6"
      const bonus = this.damageBonus || 0

      // Build the complete damage formula
      let damageFormula = baseDice
      if (bonus > 0) {
        damageFormula = `${baseDice}+${bonus}`
      } else if (bonus < 0) {
        damageFormula = `${baseDice}${bonus}`
      }

      // Build the damage effect dynamically
      const damageEffect = {
        id: foundry.utils.randomID(),
        name: "Damage",
        type: "attack",
        formula: damageFormula,
        flags: {
          isLikeAttack: true, // Uses actor's melee/missile damage bonus
          canBeResisted: false,
          isMagical: this.isMagical || false,
        },
        note: "",
        description: "",
      }

      // Replace the effects array with our dynamically built effect
      attack.effects = [damageEffect]

      actions.push(attack)
    }
    actions.push(...this.actions)
    return actions
  }
}
