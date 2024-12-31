/**
 * @file The Action Resolver engine -- a class that accepts an Action and the
 * context that it's used within, waits for it to be processed, then returns
 * the result.
 * @todo Given an action, validate that the action can be performed.
 * @todo Given an action, consume resources for the action.
 * @todo Given an action, perform the action against multiple targets with a
 * minimum/maximum number of targets.
 */

import rollDice from "../utils/roll-dice.mjs"

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

  static KEY_WITH_NO_TARGETS = "untargeted"

  /**
   * Constructs an ActionResolver.
   * @param {Action} action - The Action being performed.
   * @param {unknown} document - The Actions's source document.
   * @param {unknown} actor - The Action's owner, if any.
   * @param {unknown[]} targets - The Actors that are the target of the Action
   */
  constructor(action, document, actor, targets = []) {
    if (!action)
      throw new TypeError("An action resolver must have an action to resolve.")

    this.actor = actor
    this.document = document
    this.action = action
    if (targets) this.targets = targets instanceof Array ? targets : [targets]
    else this.targets = []
  }

  get result() {
    return Object.fromEntries(this.#resolutions)
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
        this.targets.forEach((target) => this.#attemptAction(target))
      else await this.#attemptAction()

      await this.#report()
    } catch (e) {
      ui.notifications.error(e.message)
      return false
    }

    return this.result
  }

  async #attemptAction(target) {
    const targetId = target?.uuid || ActionResolver.KEY_WITH_NO_TARGETS

    const attempt = await this.#performAttempt(target)
    const attemptWasSuccessful = !!attempt?.total || attempt

    const effects =
      attemptWasSuccessful && this.action.flags.usesEffect
        ? await this.#applyEffects(target)
        : []

    this.#resolutions.set(targetId, {
      attempt,
      effects,
    })
  }

  /**
   * Validates that the action can be performed.
   * @returns {boolean} True if the action is valid, false otherwise.
   * @todo Add resource validation for item consumption -- including if zero of
   * the item is consumed (see also non-consumed spell reagents)
   * @todo Add resource validation for HP consumption
   * @todo Add resource validation for spell slot consumption
   * @todo Is it appropriate to validate level here?
   */
  #validateAction() {
    const { actor, action } = this

    if (actor) {
      // #1: Does the Actor meet the Action's min/max level requirements?
      if (action.level.min !== undefined)
        if (actor.system.details?.level < action.level.min)
          throw new Error(
            `${actor.name} does not meet the minimum level for ${action.name}`,
          )

      if (action.level.min !== undefined)
        if (actor.system.details?.level > action.level.max)
          throw new Error(
            `${actor.name} exceeds the maximum level for ${action.name}`,
          )
    }

    // #2: If the Action consumes its own charges, are there any left to use?
    if (action.uses.max)
      if (action.uses.value <= 0)
        throw new Error(`${actor.name} is out of uses of ${action.name}`)

    /** @todo What other validation do we need? */

    return true
  }

  /**
   * Consumes the necessary resources for the action.
   * @returns {Promise<boolean>} True if resources were successfully consumed,
   * false otherwise.
   */
  // eslint-disable-next-line class-methods-use-this
  async #consumeResources() {
    return true
  }

  /**
   * Performs the attempt roll against a single target.
   * @param {Actor|null} targetActor - The target of the action, or null.
   * @returns {Promise<boolean>} True if the attempt was successful,
   * false otherwise.
   */
  async #performAttempt(targetActor) {
    // Case #0: action doesn't have an attempt roll.
    if (!this.action.flags.usesAttempt) return true

    if (this.action.attempt.isLikeAttack)
      return this.#performAttemptAsAttack(targetActor)

    // Case #1: Action is like an attack. It's a d20 roll plus modifier against
    // a target.
    const { formula, operator, target } = this.action.attempt.roll

    // Case #3: Action is not like an attack; it has a static value that it
    // rolls against.
    return rollDice(this.actor, formula, {
      operator,
      target,
    })
  }

  async #performAttemptAsAttack(targetActor) {
    let attackModifier = ""
    switch (this.action.attempt.attackType) {
      case "missile":
        attackModifier = "@system.missileAttackMod"
        break
      case "melee":
        attackModifier = "@system.meleeAttackMod"
        break
      default:
        attackModifier = "@system.baseAttackBonus"
    }
    const formulaToRoll = `1d20+${attackModifier}`
    if (!targetActor)
      // Case #1: Action is like an attack, but no target is provided. Attempt
      // an attack with no target.
      return rollDice(this.actor, formulaToRoll)

    // Case #2: Action is like an attack, and is used against a target
    // TODO: Case for "Is an attack, has a target." This case should compare
    // user's attack vs. target's AC, and succeed if the roll meets or
    // exceeds AC (if using descending AC) or the whole THAC0 calculation.
    return null
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

        if (wasResisted) {
          return {
            type: effect.type,
            resisted: true,
            value: 0,
            message: `${target.name} resisted the ${effect.note || "effect"}`,
          }
        }

        // Step 2: Process effect based on type
        switch (effect.type) {
          case "attack":
          case "healing":
            return this.#processNumericEffect(effect, target)

          case "effect":
            return this.#processActiveEffect(effect, target)

          case "macro":
            return this.#processMacroEffect(effect, target)

          case "table":
            return this.#processTableEffect(effect, target)

          case "misc":
            return {
              type: "misc",
              message: effect.description,
            }

          default:
            ui.notifications.warn(`Unknown effect type: ${effect.type}`)
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
        // Map save type if cross-system content
        // const saveToUse = await this.mapSavingThrow(savingThrow, target)
        const saveToUse = "death"
        const save = await target.rollSave(saveToUse)

        // Add magic save bonus if effect is magical
        const magicMod = effect.flags.isMagical
          ? target.system.modifiers.magicSave || 0
          : 0

        return save.total + magicMod >= target.system.saves[saveToUse]
      }

      case "abilityScore": {
        const result = await rollDice(target, roll.formula)
        const score = target.system.abilities[roll.abilityScore].value
        return this.compareRoll(result.total, roll.operator, score)
      }

      case "number": {
        const result = await rollDice(target, roll.formula)
        return this.compareRoll(result.total, roll.operator, staticTarget)
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
    const roll = await rollDice(this.actor, effect.formula)
    const value = roll.total

    if (!target) {
      return {
        type: effect.type,
        value,
        roll,
        message: `${effect.type === "attack" ? "Damage" : "Healing"}: ${value}`,
      }
    }

    // Apply to target
    const currentHP = target.system.hp.value
    const newHP =
      effect.type === "attack"
        ? Math.max(0, currentHP - value)
        : Math.min(target.system.hp.max, currentHP + value)

    await target.update({
      "system.hp.value": newHP,
    })

    return {
      type: effect.type,
      target: target.uuid,
      value,
      roll,
      message: `${target.name} ${effect.type === "attack" ? "takes" : "heals"} ${value} points`,
    }
  }

  /**
   * Processes condition/status effects
   * @param {object} effect - The effect to process
   * @param {Actor} target - The target of the effect
   * @returns {Promise<object>} The result of processing the effect
   */
  // eslint-disable-next-line class-methods-use-this
  async #processActiveEffect(effect, target) {
    if (!target) return null

    const effectData = {
      label: effect.note || "New Effect",
      icon: effect.icon,
      duration: effect.duration,
      flags: {
        core: {
          statusId: effect.condition,
        },
      },
    }

    const createdEffect = await ActiveEffect.create(effectData, {
      parent: target,
    })

    return {
      type: "effect",
      target: target.uuid,
      effectId: createdEffect.id,
      message: `Applied ${effect.note || "effect"} to ${target.name}`,
    }
  }

  /**
   * Processes macro effects
   * @param {object} effect - The effect to process
   * @param {Actor} target - The target of the effect
   * @returns {Promise<object>} The result of processing the effect
   */
  async #processMacroEffect(effect, target) {
    if (effect.macro.fromDocument) {
      const macro = await fromUuid(effect.macro.fromDocument)
      await macro?.execute({ actor: this.actor, target, action: this.action })
    } else if (effect.macro.fromEditor) {
      // We ignore here because, how else do we make a fake macro?
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        "actor",
        "target",
        "action",
        effect.macro.fromEditor,
      )
      await fn(this.actor, target, this.action)
    }

    return {
      type: "macro",
      message: "Executed macro effect",
    }
  }

  /**
   * Processes roll table effects
   * @param {object} effect - The effect to process
   * @returns {Promise<object>} The result of processing the effect
   */
  // eslint-disable-next-line class-methods-use-this
  async #processTableEffect(effect) {
    const table = await fromUuid(effect.rollTable.document)
    if (!table) return null

    const roll = await table.roll()
    const result = roll.results[0]

    return {
      type: "table",
      roll,
      result: result.text,
      message: `Rolled on ${table.name}: ${result.text}`,
    }
  }

  /**
   * Utility to compare roll results
   * @param {number} roll - The roll result
   * @param {string} operator - The comparison operator
   * @param {number} target - The target number
   * @returns {boolean} Whether the comparison succeeds
   */
  // eslint-disable-next-line class-methods-use-this
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

  async #report() {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      type: "action",
      system: {
        actor: this.actor?.uuid || undefined,
        item: this.document?.uuid || undefined,
        action: this.action.id,
        outcome: this.result,
      },
    })
  }
}
