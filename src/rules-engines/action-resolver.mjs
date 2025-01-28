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

    if (!targets) this.targets = []
    else if (targets instanceof UserTargets)
      this.targets = Array.from(targets.entries())
    else if (!Array.isArray(targets)) this.targets = [targets]
    else this.targets = targets
    this.targets = this.targets.flat()
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
      ui.notifications.error(e.message)
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
   * @todo Case #2 is kinda hideous. It'd be better if we could use `cs>=`.
   * @returns {Promise<boolean>} True if the attempt was successful,
   * false otherwise.
   */
  async #performAttempt(targetActor) {
    // Case #0: action doesn't have an attempt roll.
    if (!this.action.flags.usesAttempt) return true

    // Case #1: Action is like an attack. It's a d20 roll plus modifier against
    // a target.
    if (this.action.attempt.flags.isLikeAttack)
      return this.#performAttemptAsAttack(targetActor)

    // Case #2: Action is not like an attack; it has a static value that it
    // rolls against.
    const { formula, operator, target } = this.action.attempt.roll
    const roll = await rollDice(this.actor, formula)

    let parsedTarget =
      typeof target === "string" && target.startsWith("@")
        ? foundry.utils.getProperty(this.actor.system, target.replace("@", ""))
        : target

    if (!parsedTarget) parsedTarget = 1

    return {
      roll,
      target: parsedTarget,
      success: this.#compareRoll(roll.total, operator, parsedTarget),
    }
  }

  async #performAttemptAsAttack(target) {
    const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )

    return combatSettings.resolveAttackRoll(this.actor, target?.actor, {
      attackType: this.action.attempt.attack.type,
    })
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

          case "script":
            return this.#processScriptEffect(effect, target)

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
        const saveSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
          CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
        )

        console.info(saveSettings)

        // const systemId = target.system.template
        // const context = {
        //   isMagical: effect.flags.isMagical,
        //   bxEquivalent: CONFIG.BAGS.SaveResolver.getBXEquivalent(
        //     systemId,
        //     savingThrow,
        //   ),
        // }
        //
        // const saveResult = await CONFIG.BAGS.SaveResolver.resolveSave(
        //   target,
        //   systemId,
        //   savingThrow,
        //   context,
        // )
        //
        // // Handle different return types
        // if (typeof saveResult === "number") {
        //   // Traditional save vs target number
        //   return saveResult >= effect.resistance.target
        // }
        //
        // if (typeof saveResult === "object" && "success" in saveResult) {
        //   // Systems that return explicit success/failure
        //   return saveResult.success
        // }

        return false
      }

      case "abilityScore": {
        const result = await rollDice(target, roll.formula)
        const score = target.system.abilities[roll.abilityScore].value
        return this.#compareRoll(result.total, roll.operator, score)
      }

      case "number": {
        const result = await rollDice(target, roll.formula)
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
    let { formula } = effect

    if (effect.flags.isLikeAttack) {
      switch (this.action.attempt.attack.type) {
        case "melee":
          formula = `${formula}+@meleeDamageBonus`
          break
        case "missile":
          formula = `${formula}+@missileDamageBonus`
          break
        default:
          break
      }
    }

    const roll = await rollDice(this.actor, formula)
    const value = roll.total

    if (!target) {
      return {
        type: effect.type,
        value,
        roll,
        message: `${effect.type === "attack" ? "Damage" : "Healing"}: ${value}`,
      }
    }

    // TODO:  Automatically apply damage to targets?

    // const currentHP = target.system.hp.value
    // const newHP =
    //   effect.type === "attack"
    //     ? Math.max(0, currentHP - value)
    //     : Math.min(target.system.hp.max, currentHP + value)
    //
    // await target.update({
    //   "system.hp.value": newHP,
    // })

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
    const macro = await fromUuid(effect.macro)
    await macro?.execute({ actor: this.actor, target, action: this.action })
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
    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      type: "action",
      system: {
        actor: this.actor?.uuid || undefined,
        item: this.document?.uuid || undefined,
        action: this.action.id,
        outcome: this.result,
      },
    })
    if (this.action.flags.isBlind)
      await message.applyRollMode(CONST.DICE_ROLL_MODES.BLIND)
  }
}
