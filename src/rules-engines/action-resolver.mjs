/**
 * @file The Action Resolver engine -- a class that accepts an Action and the
 * context that it's used within, waits for it to be processed, then returns
 * the result.
 */

import { FoundryDocumentAdapter } from "./foundry-document-adapter.mjs"

/**
 * @typedef {import('../common/actions.fields.mjs').Action} Action
 */

export default class ActionResolver {
  /** @type {Action} */
  action

  actor

  document

  targets

  #resolutions = new Map()

  #adapter

  static KEY_WITH_NO_TARGETS = "untargeted"

  /**
   * Constructs an ActionResolver.
   * @param {Action} action - The Action being performed.
   * @param {unknown} document - The Actions's source document.
   * @param {unknown} actor - The Action's owner, if any.
   * @param {unknown[]} targets - The Actors that are the target of the Action
   * @param {FoundryDocumentAdapter} adapter - The Foundry document adapter (
   * for testing)
   */
  constructor(action, document, actor, targets = [], adapter = null) {
    if (!action)
      throw new TypeError("An action resolver must have an action to resolve.")

    this.actor = actor
    this.document = document
    this.action = action
    this.#adapter = adapter || new FoundryDocumentAdapter()

    this.targets = this.#adapter.normalizeTargets(targets)
  }

  get result() {
    const resultObj = Object.fromEntries(this.#resolutions)
    return this.#resolutions
      .keys()
      .reduce(
        (arr, key) => [...arr, { ...this.#resolutions.get(key), target: key }],
        [],
      )
    // return resultObj
  }

  /**
   * Resolves the action.
   * @returns {Promise<unknown>} The result of the action resolution.
   */
  async resolve() {
    try {
      // Step 1: Validate the action
      this.#validateAction()
      // Step 2: Consume resources
      await this.#consumeResources()
      // Step 3: Perform attempt rolls and apply effects
      if (this.targets.length)
        await Promise.all(
          this.targets.map((target) => this.#attemptAction(target)),
        )
      else await this.#attemptAction()

      await this.#report()
    } catch (e) {
      this.#adapter.notifyError(e.message)
      return false
    }

    return this.result
  }

  async #attemptAction(target) {
    const targetId = target?.actor?.uuid || ActionResolver.KEY_WITH_NO_TARGETS

    const attempt = await this.#performAttempt(target)

    const effects =
      attempt.success && this.action.flags.usesEffect
        ? await this.#applyEffects(target)
        : []

    this.#resolutions.set(targetId, {
      attempt,
      effects,
    })
  }

  /**
   * Validates level requirements
   * @param {object} action - The action configuration
   * @param {object} actorData - Plain object with actor data
   * @returns {{valid: boolean, errors: string[]}}
   */
  #validateLevel(action, actorData) {
    const errors = []

    if (!actorData) {
      return { valid: true, errors }
    }

    const level = actorData.system?.details?.level

    if (level === undefined || level === null) {
      return { valid: true, errors }
    }

    if (action.level?.min !== undefined && level < action.level.min) {
      errors.push(
        `${actorData.name || "Actor"} does not meet the minimum level for ${action.name || "this action"} (requires level ${action.level.min}, is level ${level})`,
      )
    }

    if (action.level?.max !== undefined && level > action.level.max) {
      errors.push(
        `${actorData.name || "Actor"} exceeds the maximum level for ${action.name || "this action"} (max level ${action.level.max}, is level ${level})`,
      )
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Validates action uses
   * @param {object} action - The action configuration
   * @returns {{valid: boolean, errors: string[]}}
   */
  #validateUses(action) {
    const errors = []

    if (action.uses?.max > 0 && action.uses.value <= 0) {
      errors.push(
        `No uses remaining for ${action.name || "this action"} (0 of ${action.uses.max})`,
      )
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Validates that the action can be performed.
   * @returns {boolean} True if the action is valid, false otherwise.
   */
  #validateAction() {
    const actorData = this.actor
      ? {
          name: this.actor.name,
          system: this.actor.system,
        }
      : null

    const levelValidation = this.#validateLevel(this.action, actorData)
    const usesValidation = this.#validateUses(this.action)

    const validation = {
      valid: levelValidation.valid && usesValidation.valid,
      errors: [...levelValidation.errors, ...usesValidation.errors],
    }

    if (!validation.valid) {
      throw new Error(validation.errors.join("; "))
    }

    return true
  }

  /**
   * Compares a roll result against a target
   * @param {number} roll - The roll result
   * @param {string} operator - Comparison operator (>=, <=, ==, etc)
   * @param {number} target - Target number
   * @returns {boolean} Whether the comparison succeeds
   */
  #compareRoll(roll, operator, target) {
    switch (operator) {
      case "=":
      case "==":
        return roll === target
      case ">=":
        return roll >= target
      case "<=":
        return roll <= target
      case ">":
        return roll > target
      case "<":
        return roll < target
      default:
        return false
    }
  }

  /**
   * Builds damage formula with modifiers
   * @param {string} baseFormula - Base dice formula (e.g., "1d8")
   * @param {object} modifiers - Modifier values
   * @param {string} attackType - Type of attack (melee, missile, none)
   * @returns {string} Modified formula
   */
  #buildDamageFormula(baseFormula, modifiers = {}, attackType = "none") {
    let formula = baseFormula

    switch (attackType) {
      case "melee":
        if (modifiers.meleeDamageBonus) {
          formula = `${formula}+${modifiers.meleeDamageBonus}`
        }
        break
      case "missile":
        if (modifiers.missileDamageBonus) {
          formula = `${formula}+${modifiers.missileDamageBonus}`
        }
        break
      default:
        break
    }

    return formula
  }

  /**
   * Formats a numeric effect message
   * @param {string} effectType - 'attack' or 'healing'
   * @param {number} value - The numeric value
   * @param {object|null} target - The target with name property, or null
   * @returns {string} The formatted message
   */
  #formatEffectMessage(effectType, value, target) {
    if (!target) {
      return `${effectType === "attack" ? "Damage" : "Healing"}: ${value}`
    }

    const verb = effectType === "attack" ? "takes" : "heals"
    return `${target.name} ${verb} ${value} points`
  }

  /**
   * Consumes the necessary resources for the action.
   * @returns {Promise<boolean>} True if resources were successfully consumed,
   * false otherwise.
   */
  async #consumeResources() {
    if (!this.action.flags.usesConsumption) return true

    const { type, item, spellSlots } = this.action.consumption

    switch (type) {
      case "selfQuantity":
        if (this.document?.system?.quantity > 0) {
          await this.#adapter.updateDocument(this.document, {
            "system.quantity": this.document.system.quantity - 1,
          })
        }
        break

      case "selfUses":
        if (this.document?.system?.uses?.value > 0) {
          await this.#adapter.updateDocument(this.document, {
            "system.uses.value": this.document.system.uses.value - 1,
          })
        }
        break

      case "itemQuantity": {
        const targetItem = await this.#adapter.resolveUuid(item.item)
        if (targetItem?.system?.quantity >= item.quantity) {
          await this.#adapter.updateDocument(targetItem, {
            "system.quantity": targetItem.system.quantity - item.quantity,
          })
        } else {
          throw new Error(
            `Insufficient quantity of ${targetItem?.name || "item"}`,
          )
        }
        break
      }

      case "itemUses": {
        const targetItem = await this.#adapter.resolveUuid(item.item)
        if (targetItem?.system?.uses?.value >= item.quantity) {
          await this.#adapter.updateDocument(targetItem, {
            "system.uses.value": targetItem.system.uses.value - item.quantity,
          })
        } else {
          throw new Error(`Insufficient uses of ${targetItem?.name || "item"}`)
        }
        break
      }

      case "hp":
        if (this.actor?.system?.hp?.value >= item.quantity) {
          await this.#adapter.updateDocument(this.actor, {
            "system.hp.value": this.actor.system.hp.value - item.quantity,
          })
        } else {
          throw new Error("Insufficient HP to use this action")
        }
        break

      case "spellslot": {
        const classItem = await this.#adapter.resolveUuid(spellSlots.class)
        if (!classItem) {
          throw new Error("Spell slot class not found")
        }

        const slotPath = `system.spellSlots.${spellSlots.level - 1}`
        const currentSlots = this.#adapter.getProperty(
          this.actor,
          `${slotPath}.value`,
        )

        if (currentSlots > 0) {
          await this.#adapter.updateDocument(this.actor, {
            [`${slotPath}.value`]: currentSlots - 1,
          })
        } else {
          throw new Error(`No level ${spellSlots.level} spell slots remaining`)
        }
        break
      }

      case "actionUse":
        if (this.action.uses.value > 0) {
          // Note: This updates the action within the parent document
          const { actions } = this.document.system
          const actionIndex = actions.findIndex((a) => a.id === this.action.id)
          if (actionIndex >= 0) {
            await this.#adapter.updateDocument(this.document, {
              [`system.actions.${actionIndex}.uses.value`]:
                this.action.uses.value - 1,
            })
          }
        } else {
          throw new Error("No uses of this action remaining")
        }
        break

      default:
        break
    }

    return true
  }

  /**
   * Performs the attempt roll against a single target.
   * @param {Actor|null} targetActor - The target of the action, or null.
   * @todo Case #2 is kinda hideous. It'd be better if we could use `cs>=`.
   * @returns {Promise<boolean>} True if the attempt was successful,
   * false otherwise.
   */
  async #performAttempt(targetActor) {
    // Case #0: action doesn't have an attempt roll.
    if (!this.action.flags.usesAttempt) return { success: true }

    // Case #1: Action is like an attack. It's a d20 roll plus modifier against
    // a target.
    if (this.action.attempt.flags.isLikeAttack)
      return this.#performAttemptAsAttack(targetActor)

    // Case #2: Action is not like an attack; it has a static value that it
    // rolls against.
    const { formula, operator, target } = this.action.attempt.roll
    const roll = await this.#adapter.rollDice(this.actor, formula)

    const parsedTarget =
      typeof target === "string" && target.startsWith("@")
        ? this.#adapter.getProperty(this.actor.system, target.replace("@", ""))
        : target

    return {
      roll,
      target: parsedTarget ?? 1,
      success: this.#compareRoll(roll.total, operator, parsedTarget ?? 1),
    }
  }

  async #performAttemptAsAttack(target) {
    const combatSettings = this.#adapter.getCombatSystem()

    const weaponBonus = this.action.attempt.attack.bonus || 0

    const result = await combatSettings.resolveAttackRoll(
      this.actor,
      target?.actor,
      {
        attackType: this.action.attempt.attack.type,
        modifier: weaponBonus,
      },
    )

    // Build tooltip data for showing roll breakdown
    // Note: The combat system adds actor bonuses to the weapon bonus,
    // so we need to match that here for the tooltip
    const modifiers = []

    // Add weapon/action bonus first
    if (weaponBonus) {
      modifiers.push({ label: "Weapon", value: weaponBonus })
    }

    // Add actor's attack bonus based on attack type
    if (this.action.attempt.attack.type === "melee") {
      const meleeBonus = this.actor?.system?.meleeAttackBonus || 0
      if (meleeBonus) modifiers.push({ label: "Melee", value: meleeBonus })
    } else if (this.action.attempt.attack.type === "missile") {
      const missileBonus = this.actor?.system?.missileAttackBonus || 0
      if (missileBonus)
        modifiers.push({ label: "Missile", value: missileBonus })
    }

    result.tooltipData = {
      roll: result.roll,
      modifiers,
      type: "attack",
    }

    return result
  }

  /**
   * Applies the effects of the action to a single target.
   * @param {Actor|null} target - The target to apply effects to, or null for
   * untargeted effects
   * @returns {Promise<Array>} Results of applying each effect
   */
  async #applyEffects(target) {
    if (!this.action.flags.usesEffect) return []

    return Promise.all(
      this.action.effects.map(async (effect) => {
        // Step 1: Check if target can resist the effect
        const wasResisted = effect.flags.canBeResisted
          ? await this.#processResistance(effect, target)
          : false

        // Step 2: Process effect based on type
        switch (effect.type) {
          case "attack":
          case "healing":
            return this.#processNumericEffect(effect, target, wasResisted)

          case "effect":
            return this.#processActiveEffect(effect, target, wasResisted)

          case "macro":
            return this.#processMacroEffect(effect, target, wasResisted)

          case "script":
            return this.#processScriptEffect(effect, target, wasResisted)

          case "table":
            return this.#processTableEffect(effect, target, wasResisted)

          case "misc":
            return {
              type: "misc",
              message: effect.description,
            }

          default:
            this.#adapter.notifyWarning(`Unknown effect type: ${effect.type}`)
            return null
        }
      }),
    )
  }

  /**
   * Handles resistance checks for effects
   * @param {object} effect - The effect being processed
   * @param {Actor} target - The target attempting to resist
   * @returns {Promise<boolean>} Whether the effect was resisted
   */
  async #processResistance(effect, target) {
    if (!target || !effect.resistance) return false

    const { type, savingThrow, roll, staticTarget } = effect.resistance

    switch (type) {
      case "savingThrow": {
        const saveSettings = this.#adapter.getSavingThrowSystem()

        const result = await saveSettings.resolve(target.actor, savingThrow, {
          rollFormula: effect.resistance.roll?.formula || "1d20",
          modifier: effect.resistance.targetRollModifier || 0,
        })

        return result.success
      }

      case "abilityScore": {
        const result = await this.#adapter.rollDice(target, roll.formula)
        const score = target.system.abilities[roll.abilityScore].value
        return this.#compareRoll(result.total, roll.operator, score)
      }

      case "number": {
        const result = await this.#adapter.rollDice(target, roll.formula)
        return this.#compareRoll(result.total, roll.operator, staticTarget)
      }

      default:
        return false
    }
  }

  /**
   * Processes numeric effects (damage/healing)
   * @param {object} effect - The effect to process
   * @param {Actor} target - The target of the effect
   * @returns {Promise<object>} The result of processing the effect
   */
  async #processNumericEffect(effect, target) {
    const attackType = effect.flags.isLikeAttack
      ? this.action.attempt.attack.type
      : "none"

    const modifiers = []
    const meleeDamageBonus = this.actor?.system?.meleeDamageBonus || 0
    const missileDamageBonus = this.actor?.system?.missileDamageBonus || 0

    if (attackType === "melee" && meleeDamageBonus) {
      modifiers.push({ label: "Melee Damage", value: meleeDamageBonus })
    } else if (attackType === "missile" && missileDamageBonus) {
      modifiers.push({ label: "Missile Damage", value: missileDamageBonus })
    }

    const formula = this.#buildDamageFormula(
      effect.formula,
      {
        meleeDamageBonus,
        missileDamageBonus,
      },
      attackType,
    )

    const roll = await this.#adapter.rollDice(this.actor, formula)
    const value = roll.total

    return {
      type: effect.type,
      target: target?.uuid,
      value,
      roll,
      tooltipData: {
        roll,
        modifiers,
        type: effect.type,
      },
      message: this.#formatEffectMessage(effect.type, value, target),
    }
  }

  /**
   * Processes condition/status effects
   * @param {object} effect - The effect to process
   * @param {Actor} target - The target of the effect
   * @returns {Promise<object>} The result of processing the effect
   */
  async #processActiveEffect(effect, target) {
    if (!target) return null

    const effectData = {
      label: effect.note || effect.condition?.name || "New Effect",
      icon: effect.condition?.img || effect.icon,
      description: effect.condition?.description,
      duration: effect.condition?.duration || effect.duration,
      changes: effect.condition?.changes || [],
      flags: {
        core: {
          statusId: effect.condition?.name,
        },
      },
    }

    const createdEffect = await this.#adapter.createActiveEffect(effectData, {
      parent: target,
    })

    return {
      type: "effect",
      target: target.uuid,
      effectId: createdEffect.id,
      message: `Applied ${effect.note || effect.condition?.name || "effect"} to ${target.name}`,
    }
  }

  /**
   * Processes macro effects
   * @param {object} effect - The effect to process
   * @param {Actor} target - The target of the effect
   * @returns {Promise<object>} The result of processing the effect
   */
  async #processMacroEffect(effect, target) {
    const macro = await this.#adapter.resolveUuid(effect.macro)
    await this.#adapter.executeMacro(macro, {
      actor: this.actor,
      target,
      action: this.action,
    })
    return {
      type: "macro",
      message: "Executed macro effect",
    }
  }

  /**
   * Processes embedded script effects
   * @param {object} effect - The effect to process
   * @param {Actor} target - The target of the effect
   * @returns {Promise<object>} The result of processing the effect
   */
  async #processScriptEffect(effect, target) {
    // We ignore here because, how else do we make a fake macro?
    // eslint-disable-next-line no-new-func
    const fn = new Function("actor", "target", "action", effect.script)
    await fn(this.actor, target, this.action)

    return {
      type: "script",
      message: "Executed script effect",
    }
  }

  /**
   * Processes roll table effects
   * @param {object} effect - The effect to process
   * @returns {Promise<object>} The result of processing the effect
   */
  async #processTableEffect(effect) {
    const table = await this.#adapter.resolveUuid(effect.rollTable.document)
    if (!table) return null

    const roll = await this.#adapter.rollTable(table)
    const result = roll.results[0]

    return {
      type: "table",
      roll,
      result: result.text,
      message: `Rolled on ${table.name}: ${result.text}`,
    }
  }

  async #report() {
    const messageData = {
      speaker: this.#adapter.getSpeaker({ actor: this.actor }),
      type: "action",
      system: {
        actor: this.actor?.uuid || undefined,
        item: this.document?.uuid || undefined,
        action: this.action.id,
        outcome: this.result,
      },
    }

    // Determine roll mode from action configuration
    let rollMode = null
    if (this.action.flags.usesAttempt && this.action.attempt.roll?.type) {
      rollMode = this.action.attempt.roll.type
    }

    // isBlind flag overrides to force blind roll mode
    if (this.action.flags.isBlind) {
      rollMode = "blind"
    }

    // Apply roll mode properties via adapter
    if (rollMode) {
      this.#adapter.applyRollMode(messageData, rollMode)
    }

    await this.#adapter.createChatMessage(messageData)
  }
}
