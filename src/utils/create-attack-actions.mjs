/**
 * @file Utils for creating new Attack actions.
 *
 * Note: these utils will create a *basic* attack -- d20 vs. AC, with damage
 * per a dice formula. Any further config should be done through the action
 * config UI.
 */

import { actionFactory } from "../common/action.fields.mjs"
const { mergeObject, randomID } = foundry.utils

const baseAction = mergeObject(actionFactory().getInitialValue(), {})

/**
 * Create a melee attack action.
 * @param {string} name - The action's name.
 * @param {string} damage - the formula for the attack's damage.
 * @param {number} bonusToHit - The bonus to apply to attack rolls.
 * @returns {object} The action that represents this attack.
 */
export const createMeleeAttackAction = (
  name = "Attack",
  damage = "1d6",
  bonusToHit = 0,
) =>
  mergeObject(baseAction, {
    name,
    id: randomID(),
    attempt: {
      attack: {
        type: "melee",
        bonus: bonusToHit,
      },
      flags: {
        isLikeAttack: true,
      },
    },
    effects: [
      {
        id: randomID(),
        formula: damage,
        flags: {
          isLikeAttack: true,
        },
      },
    ],
  })

/**
 * Create a melee attack action.
 * @todo Implement ammo tracking via an ammo tag.
 * @param {string} name - The action's name.
 * @param {string} damage - the formula for the attack's damage.
 * @param {number} bonusToHit - The bonus to apply to attack rolls.
 * @param {number[]} range - the short, medium, and long ranges of the weapon
 * @param {string} ammoTag - The tag to search the actor's inventory for when
 * consuming ammo. If left empty, the item will use its own quantity.
 * @returns {object} The action that represents this attack.
 */
export const createRangedAttackAction = (
  name = "Attack",
  damage = "1d6",
  bonusToHit = 0,
  [short, medium, long] = [20, 40, 60],
  ammoTag = "",
) =>
  mergeObject(baseAction, {
    name,
    id: randomID(),
    attempt: {
      attack: {
        type: "missile",
        bonus: bonusToHit,
      },
      flags: {
        isLikeAttack: true,
      },
    },
    range: {
      short,
      medium,
      long,
    },
    effects: [
      {
        id: randomID(),
        formula: damage,
        flags: {
          isLikeAttack: true,
        },
      },
    ],
  })
