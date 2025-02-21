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
    const defaultAttack = foundry.utils.mergeObject(tempObj.getInitialValue(), {
      name: game.i18n.localize("BAGS.Items.Weapon.Actions.DefaultName"),
      id: foundry.utils.randomID(),
      img: BAGSItemWeaponDataModel.DEFAULT_ACTION_IMG,
      attempt: {
        flags: {
          isLikeAttack: true,
        },
      },
      effects: [
        foundry.utils.mergeObject(
          tempObj.fields.effects.element.getInitialValue(),
          {
            type: "attack",
            id: foundry.utils.randomID(),
            flags: {
              isLikeAttack: true,
            },
          },
        ),
      ],
      flags: {
        usesAttempt: true,
        usesEffect: true,
      },
    })

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
      isSlow: new BooleanField({
        initial: false,
        label: "BAGS.Items.Weapon.Fields.IsSlow.Label",
        hint: "BAGS.Items.Weapon.Fields.IsSlow.Hint",
      }),
    }
  }
}
