import abilityScores from "../data/bx.ability-scores.mjs"
import savingThrows from "../data/bx.saving-throws.mjs"
import characterActions from "../data/bx.actions.character.mjs"
import bxBasicEncumbrance from "../data/bx.encumbrance.basic.mjs"
import bxDetailedEncumbrance from "../data/bx.encumbrance.detailed.mjs"
import bxMonsterData from "../data/bx.monster-data.mjs"
import rollDice from "../utils/roll-dice.mjs"

import {
  createMeleeAttackAction,
  createRangedAttackAction,
} from "../utils/create-attack-actions.mjs"

/**
 * @typedef {import("../config/system-registry.mjs").SystemRegistry} SystemRegistry
 */
/**
 * @typedef {import("../config/system-registry.mjs").SystemComponent} SystemComponent
 */

/**
 * Register rules modules for the Basic/Expert game.
 * @param {SystemRegistry} registry - A registry of rules modules.
 */
const registerBX = (registry) => {
  registry.register(registry.categories.ABILITY_SCORES, {
    id: "bx",
    name: "Basic/Expert",
    default: true,
    abilityScores,
    rollFormula: "3d6",
  })

  registry.register(registry.categories.SAVING_THROWS, {
    id: "bx",
    name: "Basic/Expert",
    default: true,
    savingThrows,
    worstPossible: 19,
    async resolve(actor, saveName, options) {
      const classItem = actor.items.find((i) => i.type === "class")
      if (!classItem) {
        throw new Error(`${actor.name} has no class to determine saves from`)
      }

      const target = classItem.system.currentLevelDetails.saves[saveName]
      if (target === undefined) {
        throw new Error(
          `Could not find save ${saveName} for ${actor.name}'s class`,
        )
      }

      const roll = await rollDice(actor, options.rollFormula || "1d20", {
        modifier: options.modifier,
      })

      return {
        success: roll.total >= target,
        roll,
        target,
        save: saveName,
      }
    },
  })

  registry.register(registry.categories.COMBAT, {
    id: "bx-descending",
    name: "BX, Descending AC",
    default: true,
    baseTHAC0: 19,
    baseAC: 10,
    descending: true,
    async resolveAttackRoll(actor, target, options) {
      try {
        const thac0 =
          typeof actor.system.thac0 === "number"
            ? actor.system.thac0
            : this.baseTHAC0
        const targetAC =
          typeof target?.system?.armorClass === "number"
            ? target.system.armorClass
            : this.baseAC
        // Calculate the target number needed on d20
        const targetNumber = thac0 - targetAC

        let modifier = options?.modifier || 0

        switch (options.attackType) {
          case "missile":
            modifier += actor?.system?.missileAttackBonus || 0
            break
          case "melee":
            modifier += actor?.system?.meleeAttackBonus || 0
            break
          default:
            break
        }

        // Roll the attack
        const roll = await rollDice(actor, "1d20", {
          modifier,
          rollType: options.rollType,
        })

        // Calculate the effective AC hit
        const acHit = thac0 - roll.total

        // Determine if the attack hits
        const isHit = roll.total >= targetNumber

        // Check for natural 1s and 20s
        const isCriticalHit = roll.total === 20
        const isCriticalMiss = roll.total === 1

        return {
          success: isHit || isCriticalHit,
          roll,
          acHit,
          isCriticalHit,
          isCriticalMiss,
        }
      } catch (error) {
        console.error("Error resolving attack:", error)
        throw error
      }
    },
  })

  registry.register(registry.categories.COMBAT, {
    id: "bx-ascending",
    name: "BX, Ascending AC",
    baseAttackBonus: 0,
    baseAC: 9,
    descending: false,
    async resolveAttackRoll(actor, target, options) {
      try {
        // Calculate total modifier (attack bonus + situational modifier)
        let modifier = 0
        modifier += options.modifier || 0

        const targetAC =
          typeof target?.system?.armorClass === "number"
            ? target.system.armorClass
            : this.baseAC

        switch (options.attackType) {
          case "missile":
            modifier += actor?.system?.missileAttackBonus || 0
            break
          case "melee":
            modifier += actor?.system?.meleeAttackBonus || 0
            break
          default:
            modifier += actor?.system?.baseAttackBonus || 0
            break
        }

        // Roll the attack
        const roll = await rollDice(actor, "1d20", {
          modifier,
          rollType: options.rollType,
        })

        // Determine if the attack hits (total >= AC)
        const isHit = roll.total >= targetAC

        // Check for natural 1s and 20s (before modifiers)
        const isCriticalHit = roll.terms[0].total === 20
        const isCriticalMiss = roll.terms[0].total === 1

        return {
          success: isHit || isCriticalHit, // Hit on meeting AC or natural 20
          roll,
          acHit: roll.total,
          isCriticalHit,
          isCriticalMiss,
        }
      } catch (error) {
        ui.notifications.error("Error resolving attack:", error)
        throw error
      }
    },
  })

  registry.register(registry.categories.INITIATIVE, {
    id: "bx-group",
    name: "BX, Group",
    default: true,
    formula: "1d6",
  })

  registry.register(registry.categories.INITIATIVE, {
    id: "bx-individual",
    name: "BX, Individual",
    formula: "1d6+@initiative",
  })

  registry.register(registry.categories.ENCUMBRANCE, {
    id: "bx-basic",
    name: "BX, Basic",
    default: true,
    ...bxBasicEncumbrance,
  })

  registry.register(registry.categories.ENCUMBRANCE, {
    id: "bx-detailed",
    name: "BX, Detailed",
    ...bxDetailedEncumbrance,
  })

  registry.register(registry.categories.CHARACTER_ACTIONS, {
    id: "bx",
    name: "Basic/Expert",
    default: true,
    actions: characterActions,
  })

  registry.register(registry.categories.BASE_MONSTER_STATS, {
    id: "bx",
    name: "Basic/Expert",
    default: true,
    stats: bxMonsterData,
    usesBonusXPFromHP: false,
    baseMoveSpeed: 120,
    baseHDSize: 8,
    buildABear(
      name,
      hdCount = 1,
      { damage: clawDamage, label: clawLabel } = {
        damage: "1d4",
        label: "BAGS.BX.Monsters.BuildABear.Claw.Label",
      },
      { damage: biteDamage, label: biteLabel } = {
        damage: "1d6",
        label: "BAGS.BX.Monsters.BuildABear.Bite.Label",
      },
    ) {
      let adjustedHDCount = hdCount
      if (adjustedHDCount >= this.stats.size)
        adjustedHDCount = this.stats.size - 1
      if (adjustedHDCount < 0) adjustedHDCount = 0

      const { savingThrows, attackRollOffset, xp } =
        this.stats.get(adjustedHDCount)
      const averageHP = (this.baseHDSize * hdCount) / 2

      const actionClaw = createMeleeAttackAction(clawLabel, clawDamage)
      const actionBite = createMeleeAttackAction(biteLabel, biteDamage)

      return {
        name,
        type: "monster",
        img: "icons/creatures/claws/claw-bear-paw-swipe-red.webp",
        system: {
          base: {
            savingThrows,
            attackRollOffset,
            speed: this.baseMoveSpeed,
          },
          xp: xp.base,
          hp: {
            hitDice: {
              usesHitDice: true,
              size: this.baseHDSize,
              count: hdCount,
            },
            value: averageHP,
            max: averageHP,
          },
          actions: [actionClaw, actionBite],
        },
      }
    },
  })
}

Hooks.once("BAGS.RegisterSystems", registerBX)
