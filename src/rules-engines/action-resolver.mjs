/**
 * @file The Action Resolver engine -- a class that accepts an Action and the
 * context that it's used within, waits for it to be processed, then returns
 * the result.
 * @todo Given an action, validate that the action can be performed.
 * @todo Given an action, consume resources for the action.
 * @todo Given an action, perform the action without a target.
 * @todo Given an action, perform the action with one target.
 * @todo Given an action, perform the action with multiple targets.
 * @todo Given an action, perform the action against multiple targets with a
 * minimum/maximum number of targets.
 */

import rollDice from "../utils/roll-dice.mjs"

/**
 * @typedef {import('../common/actions.fields.mjs').Action} Action
 */

/**
 * @typedef ActionResult
 * The reported outcome of an ActionResolver.
 * @property {boolean} success - Was this Action successfully used?
 * @property {Roll|null} attempt - The Roll object associated with attempting
 * this action.
 * @property {unknown[]} effect - A list of target UUIDs and updates to apply
 * to them.
 */

export default class ActionResolver {
  /** @type {ActionResult} */
  #result = {
    success: false,
    attempt: null,
    effect: [],
  }

  /** @type {Action} */
  action

  actor

  document

  targets

  #attempts = []

  #effects = []

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
    this.targets = targets instanceof Array ? targets : [targets]
  }

  get result() {
    return {
      // success: this.#attempts.some(),
      success: true,
      targets: this.#attempts.map((attempt, idx) => {
        const effects = this.#effects?.[idx] || []
        return {
          attempt,
          effects,
        }
      }),
    }
  }

  /**
   * Resolves the action.
   * @returns {Promise<ActionResult>} The result of the action resolution.
   */
  async resolve() {
    try {
      // Step 1: Validate the action
      this.validateAction()
      // Step 2: Consume resources
      await this.consumeResources()
      // Step 3: Perform attempt rolls and apply effects
      if (this.targets.length) await this.attemptActionWithTargets()
      else await this.attemptActionWithoutTargets()
    } catch (e) {
      this.#result.success = false
      ui.notifications.error(e.message)
      return false
    }

    return this.result
  }

  async attemptActionWithTargets() {
    this.targets.forEach(async (target) => {
      const attemptSuccess = this.action.flags.usesAttempt
        ? await this.performAttempt(target)
        : true
      this.result.targetResults[target.id] = attemptSuccess

      if (attemptSuccess && this.action.flags.usesEffect)
        await this.applyEffects(target)
    })
  }

  async attemptActionWithoutTargets() {
    // No targets; action may affect self or environment
    const attempt = this.action.flags.usesAttempt
      ? await this.performAttempt()
      : true

    if (!attempt || !this.action.flags.usesEffect) return

    this.#attempts.push(attempt)

    await this.applyEffects(null)
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
  validateAction() {
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
  async consumeResources() {
    return true
  }

  /**
   * Performs the attempt roll against a single target.
   * @param {Actor|null} target - The target of the action, or null.
   * @param targetActor
   * @returns {Promise<boolean>} True if the attempt was successful,
   * false otherwise.
   */
  async performAttempt(targetActor) {
    // Case #0: action doesn't have an attempt roll.
    if (!this.action.flags.usesAttempt) return true

    const { actor, action } = this

    if (action.attempt.isLikeAttack) {
      let attackModifier = ""
      switch (action.attempt.attackType) {
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
        // Case #1: Action is like an attack, but no target is provided
        return rollDice(actor, formulaToRoll)

      // Case #2: Action is like an attack, and is used against a target
      // TODO: Case for "Is an attack, has a target." This case should compare
      // user's attack vs. target's AC, and succeed if the roll meets or
      // exceeds AC.
      return null
    }

    const { formula, operator, target } = action.attempt.roll

    // Case #3: Action is not like an attack; it has a static value that it
    // rolls against.
    return rollDice(actor, formula, {
      operator,
      target,
    })
  }

  /**
   * Applies the effects of the action to a single target.
   * @param {Target|null} target - The target to apply effects to, or null.
   */
  async applyEffects(target) {
    const results = this.action.effects.map((effect) => {
      // Step 1: target attempts to resist, if resistance is an option and
      // target is specified. If it's a saving throw and the effect is
      // magic-based, be sure to add in the character's spell save bonus.
      // Step 2: Split logic by effect type:
      // - Damage/healing, roll and report. One makes HP go up; the other down.
      // - Condition, construct and apply the Active Effect to the target.
      // - Macro, run the macro and report.
      // - Miscellaneous, report the description and continue.
      //
      // const didResist = (effect.flags.canBeResisted) ? await this.processTargetResistance(effect, target) : false
      // }
    })
    //   console.info(target, this.action)
    // const { actor, action, result } = this
    // if (!action.effects || action.effects.length === 0) {
    //   result.messages.push(`${action.name} has no effects to apply.`)
    //   return
    // }
    // action.effects.forEach(async (effect) => {
    //   // Evaluate effect formula
    //   let effectValue = 0
    //   if (effect.formula)
    //     try {
    //       const roll = new Roll(formula, actor.getRollData())
    //       await roll.evaluate({ async: true })
    //       effectValue = roll.total
    //       // Optionally display the roll to the chat if desired
    //       await roll.toMessage({
    //         speaker: ChatMessage.getSpeaker({ actor }),
    //         flavor: `${action.name} effect roll${target ? " on " + target.name : ""}`,
    //       })
    //     } catch (error) {
    //       result.messages.push(
    //         `Error evaluating effect formula: ${error.message}`
    //       )
    //       return
    //     }
    // Apply effect to the target or actor
    // if (target) {
    //   // Handle damage, healing, or other numerical effects
    //   if (effect.type === "damage" || effect.type === "healing")
    //     await this.applyNumericEffect(target, effect, effectValue)
    //   // Apply Active Effects if any specified
    //   if (effect.activeEffect) {
    //     await this.applyActiveEffect(target, effect.activeEffect)
    //     result.messages.push(
    //       `${target.name} is affected by ${effect.activeEffect.label || effect.activeEffect.name || "an effect"}.`
    //     )
    //   }
    // }
    // TODO: Implement logic for self-targeted effects
    // }
  }

  processTargetResistance(effect, target) {}

  async processMacroEffect(effect, target) {
    if (effect.type !== "macro") return
    if (!effect.macro.fromDocument && !effect.macro.fromEditor) return

    if (effect.macro.fromDocument) {
      return
    }

    const fn = foundry.utils.AsyncFunction(
      "actor",
      "target",
      "action",
      "effect",
      `{${effect.macro.fromEditor}`,
    )

    await fn(this.actor, target, this.action)
  }

  /**
   * Applies a numeric effect (damage or healing) to a target.
   * @param {Target} target - The target actor.
   * @param {object} effect - The effect object.
   * @param {number} value - The value calculated from the effect formula.
   */
  async applyNumericEffect(target, effect, value) {
    // if (effect.type === "damage") {
    //   const hp = target.system.attributes.hp
    //   const newHp = Math.max(hp.value - value, 0)
    //   await target.update({ "data.attributes.hp.value": newHp })
    //   this.result.messages.push(
    //     `${target.name} takes ${value} ${effect.flavorText || ""} damage from ${this.action.name}.`
    //   )
    // } else if (effect.type === "healing") {
    //   const hp = target.system.attributes.hp
    //   const newHp = Math.min(hp.value + value, hp.max)
    //   await target.update({ "data.attributes.hp.value": newHp })
    //   this.result.messages.push(
    //     `${target.name} heals ${value} ${effect.flavorText || ""} HP from ${this.action.name}.`
    //   )
    // } else {
    //   // Other effect types can be added here
    // }
  }

  /**
   * Applies an ActiveEffect to a target using Foundry's API.
   * @param {Target} target - The target actor.
   * @param {ActiveEffect} activeEffectData - The data for the ActiveEffect to apply.
   */
  async applyActiveEffect(target, activeEffectData) {
    //   try {
    //     // Create an ActiveEffect instance
    //     const effect = new ActiveEffect(activeEffectData, { parent: target })
    //     // Apply the effect to the target actor
    //     await target.createEmbeddedDocuments("ActiveEffect", [effect.data])
    //   } catch (error) {
    //     this.result.messages.push(
    //       `Failed to apply effect to ${target.name}: ${error.message}`
    //     )
    //   }
  }
}
