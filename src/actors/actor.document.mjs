/**
 * @file The entity class for all Actors in the syste
 */

import {
  DEFAULT_ART_ACTOR_CHARACTER,
  DEFAULT_ART_ACTOR_MONSTER,
  DEFAULT_ART_ACTOR_VEHICLE,
} from "../config/constants.mjs"

import ActionResolver from "../rules-engines/action-resolver.mjs"
import {
  isActionAvailable,
  isActionExhausted,
} from "../utils/action-availability.mjs"
import SavingThrowRoll from "../dice/dice.saving-throw.mjs"
import AbilityScoreRoll from "../dice/dice.ability-score.mjs"

export default class BAGSActor extends Actor {
  static getDefaultArtwork(actorData) {
    let art = ""

    switch (actorData.type) {
      case "character":
        art = DEFAULT_ART_ACTOR_CHARACTER
        break
      case "vehicle":
        art = DEFAULT_ART_ACTOR_VEHICLE
        break
      case "monster":
      default:
        art = DEFAULT_ART_ACTOR_MONSTER
        break
    }

    return {
      img: art,
      texture: {
        src: art,
      },
    }
  }

  /**
   * Get all ActiveEffects that may apply to this Actor: the ones on the Actor
   * itself, plus the transferrable ones on the Items it owns.
   *
   * An effect on a physical item only counts while that item is equipped, which
   * is the one thing this adds over Foundry's own version -- a sword in your
   * pack shouldn't still be granting its bonus.
   * @yields {ActiveEffect}
   * @returns {Generator<ActiveEffect, void, void>}
   */
  *allApplicableEffects() {
    // eslint-disable-next-line no-restricted-syntax
    for (const effect of this.effects) {
      yield effect
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const item of this.items) {
      // eslint-disable-next-line no-restricted-syntax
      for (const effect of item.effects) {
        // eslint-disable-next-line no-continue
        if (item.isPhysical && !item.system.isEquipped) continue
        if (effect.transfer) yield effect
      }
    }
  }

  get appliedEffectsByAffectedKey() {
    const attributeModifications = new Map()

    this.appliedEffects.forEach((effect) => {
      if (!effect.changes?.length) return

      effect.changes.forEach((change) => {
        const { key, ...modification } = change

        if (!attributeModifications.has(key))
          attributeModifications.set(key, [])

        attributeModifications.get(key).push({
          name: effect.name,
          id: effect.id,
          img: effect.img,
          parent: effect.parent,
          modification,
          statuses: effect.statuses,
        })
      })
    })

    return attributeModifications
  }

  get appliedEffectsBySource() {
    const sources = new Map()

    this.appliedEffects.forEach((effect) => {
      const { uuid } = effect.parent
      if (!sources.has(uuid)) sources.set(uuid, [])
      sources.get(uuid).push(effect)
    })

    return Array.from(sources.entries()).map(([uuid, effects]) => ({
      parent: fromUuidSync(uuid),
      effects,
    }))
  }

  get temporaryAppliedEffects() {
    return this.appliedEffects.filter((e) => e.isTemporary)
  }

  get lastingAppliedEffects() {
    return this.appliedEffects.filter((e) => !e.isTemporary)
  }

  get actions() {
    const documentToActions = ({ id, uuid, name, img, ...i }) => ({
      id,
      uuid,
      name,
      img,
      actions: i.system?.actions || [],
    })

    const itemActions = Object.entries(this.items.documentsByType).reduce(
      (obj, [key, items]) => ({
        ...obj,
        [key]: items
          .filter((i) => i.system?.actions?.length)
          .map(documentToActions),
      }),
      {},
    )

    return {
      builtins: [documentToActions(this)],
      ...itemActions,
    }
  }

  get equipped() {
    const equipped = {
      weapon: [],
      armor: [],
      item: [],
    }
    this.items
      .filter((i) => i.system.isEquipped)
      .forEach((i) => equipped[i.type].push(i))
    return equipped
  }

  /**
   * The Item types that carry an actor's *innate* actions -- the things they can
   * do because of who they are rather than what they are holding.
   *
   * Spells are deliberately absent. They have a tab, a preparation step and a
   * manager of their own, and folding them in here would put a wizard's whole
   * spellbook in the same grid as their two class abilities.
   * @type {string[]}
   */
  static ABILITY_TYPES = ["ability", "identity", "class"]

  /**
   * The order gear appears in, most reached-for first.
   *
   * A weapon always has at least its attack, and it's the thing you want under
   * the cursor when a fight starts. Everything else follows.
   * @type {string[]}
   */
  static GEAR_ORDER = ["weapon", "armor", "item"]

  /**
   * Everything this actor can do right now, grouped by where it comes from.
   *
   * Both groups are flattened to one entry per action, because both are rendered
   * one control per action -- gear as a list where each row names its source,
   * abilities as a grid of tiles. Grouping gear under a header made sense while
   * every entry was a weapon with exactly one attack; it stopped making sense
   * once a shield with one action had to sit next to a halberd with three.
   *
   * Gear is filtered on `canUseActions` rather than on `isEquipped`, so a wand
   * marked usable while stowed stays usable while stowed. Both groups then drop
   * anything the actor isn't far enough along to use, so the tab offers nothing
   * that would be refused for good.
   *
   * Actions that are merely *spent* stay in, marked `exhausted`. A charge comes
   * back; a level requirement doesn't, and taking a spent control away would
   * hide the reason it's missing along with the thing itself.
   *
   * `itemId` is what the sheet puts in a control's dataset and hands back to
   * {@link resolveAction}, so it is empty for an action the actor owns outright
   * -- there's no Item to look the action up in.
   * @see {@link ../utils/action-availability.mjs}
   * @returns {{gear: UsableAction[], abilities: UsableAction[]}} The actor's
   * usable actions
   */
  get usableActions() {
    const canAct = this.items.filter((item) => item.system.actionList?.length)

    /**
     * @typedef {object} UsableAction
     * @property {Item|Actor} source - What the action belongs to
     * @property {string} itemId - The owning Item's id, or "" for the actor's own
     * @property {object} action - The action itself
     * @property {boolean} exhausted - Whether its uses are spent
     */

    /**
     * Expand one source to an entry per action it can currently use.
     * @param {Item|Actor} source - The document holding the actions
     * @param {object[]} actions - The actions to consider
     * @returns {UsableAction[]} One entry per usable action
     */
    const expand = (source, actions) =>
      actions
        .filter((action) =>
          isActionAvailable(action, source === this ? null : source, this),
        )
        .map((action) => ({
          source,
          itemId: source === this ? "" : source.id,
          action,
          exhausted: isActionExhausted(action),
        }))

    const gear = canAct
      .filter((item) => item.isPhysical && item.system.canUseActions)
      .sort(
        (a, b) =>
          BAGSActor.GEAR_ORDER.indexOf(a.type) -
          BAGSActor.GEAR_ORDER.indexOf(b.type),
      )

    const abilityItems = canAct.filter((item) =>
      BAGSActor.ABILITY_TYPES.includes(item.type),
    )

    return {
      gear: gear.flatMap((item) => expand(item, item.system.actionList)),
      abilities: [
        ...expand(this, this.innateActions),
        ...abilityItems.flatMap((item) => expand(item, item.system.actionList)),
      ],
    }
  }

  /**
   * The actions written on the actor itself, rather than on anything it carries.
   *
   * A monster's stat block keeps its attacks here -- a gaze, a breath weapon,
   * the thing that makes it that monster. A character's `system.actions` holds
   * something different: the exploration skills the *ruleset* supplies, which
   * every character has identically and which the sheet gives its own section.
   * Folding those into the abilities grid would list them twice, so they're left
   * out here.
   * @returns {object[]} The actor's own actions
   */
  get innateActions() {
    if (this.type === "character") return []

    return this.system.actions ?? []
  }

  get flattenedOverrides() {
    return foundry.utils.flattenObject(this.overrides)
  }

  async rollSavingThrow(
    saveType,
    formula = "1d20",
    modifier = 0,
    rollBelow = false,
    // Left unset on purpose: the roll falls back to whichever mode the user has
    // chosen for chat when it posts itself.
    rollMode = undefined,
  ) {
    return this.#rollUsingSpecialtyDice(
      SavingThrowRoll,
      formula,
      modifier,
      this.system.savingThrows[saveType],
      "saveType",
      saveType,
      rollBelow,
      rollMode,
    )
  }

  async rollAbilityScore(
    abilityName,
    formula = "1d20",
    modifier = 0,
    rollBelow = false,
    // Left unset on purpose: the roll falls back to whichever mode the user has
    // chosen for chat when it posts itself.
    rollMode = undefined,
  ) {
    return this.#rollUsingSpecialtyDice(
      AbilityScoreRoll,
      formula,
      modifier,
      this.system.abilityScores[abilityName],
      "abilityName",
      abilityName,
      rollBelow,
      rollMode,
    )
  }

  #rollUsingSpecialtyDice(
    DiceClass,
    formula,
    modifier,
    target,
    key,
    keyValue,
    rollBelow,
    rollMode,
  ) {
    let modifierString = ""

    if (modifier > 0) modifierString = `+${modifier}`
    else if (modifier < 0) modifierString = `${modifier}`

    const roll = new DiceClass(`${formula}${modifierString}`, this, {
      target,
      [key]: keyValue,
      rollBelow,
      rollMode,
    })

    return roll.roll()
  }

  getRollData() {
    return this.system
  }

  // === Action management =====================================================

  /**
   * Creates a new action for this item
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   */
  async createAction() {
    const actions = [
      ...this.system.actions,
      {
        ...this.system.schema.fields.actions.element.getInitialValue(),
        id: foundry.utils.randomID(),
      },
    ]
    return this.update({ "system.actions": actions })
  }

  /**
   * Retrieves an action by its ID
   *
   * Items expose `actionList`, which is `actions` plus whatever the item builds
   * on the fly -- a weapon's default attack, say. Actors have no such thing to
   * add, so they expose `actions` and nothing else, and looking only for
   * `actionList` here would never find a character's exploration skills.
   * @param {string} actionId - The unique identifier of the action
   * @param {string} itemId - Optional item ID to search within
   * @returns {object | undefined} The action object if found, undefined otherwise
   */
  getAction(actionId, itemId) {
    const actionSource = !itemId ? this.system : this.items.get(itemId)?.system
    const actions = actionSource?.actionList ?? actionSource?.actions
    return actions?.find(({ id }) => id === actionId)
  }

  /**
   * Gets the index of an action in the actions array
   * @param {string} actionId - The unique identifier of the action
   * @param itemId
   * @returns {number} The index of the action, or -1 if not found
   */
  getActionIndex(actionId, itemId) {
    const actionSource = !itemId ? this.system : this.items.get(itemId)?.system
    return actionSource?.actions.findIndex(({ id }) => id === actionId)
  }

  /**
   * Resolves an action using the ActionResolver
   * @see {@link ../rules-engines/action-resolver.mjs}
   * @param {string|object} action - Either an action ID or the action object
   * itself
   * @param {string} itemId - The parent item of the action, if any.
   * @returns {Promise<object>} The result of the action resolution
   */
  async resolveAction(action, itemId = "") {
    const fetchedAction =
      typeof action === "string" ? this.getAction(action, itemId) : action
    const item = itemId ? this.items.get(itemId) : null
    const resolver = new ActionResolver(
      fetchedAction,
      item,
      this,
      game.user.targets,
    )
    return resolver.resolve()
  }

  /**
   * Updates an existing action with new data
   * @param {string} actionId - The unique identifier of the action to update
   * @param {object} updates - The properties to update on the action
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   * @throws {Error} If the action is not found
   */
  async updateAction(actionId, updates) {
    const updatedActionIndex = this.getActionIndex(actionId)

    if (updatedActionIndex < 0)
      throw new Error("Failed to update action: action not found")

    const updatedActions = this.system.actions.map((a) => {
      if (a.id !== actionId) return a
      return {
        ...a,
        ...updates,
      }
    })

    return this.update({
      "system.actions": updatedActions,
    })
  }

  /**
   * Deletes an action from this item
   * @param {string} actionId - The unique identifier of the action to delete
   * @returns {Promise<Item>} A Promise that resolves to the updated Item
   */
  async deleteAction(actionId) {
    return this.update({
      "system.actions": this.system.actions.filter(({ id }) => id !== actionId),
    })
  }

  // === Action effect management ==============================================
  // Note: Action effects are different from *active effects*, which are a
  // document type in Foundry.
  // Effect management is now handled by the ActionEditor and
  // ActionEffectEditor applications.

  // === Spell management ======================================================
  async prepareSpell(spellId) {
    const preparedSpells = [...this.system.preparedSpells]
    const spellToAdd = this.items.get(spellId)

    // A spell's level depends on whose list it's being cast from, so ask the
    // actor rather than reading the spell's own default level.
    const levelToPrepare = this.system.spellLevelFor(spellToAdd)

    const maxSpellsAtLevel = this.system.spellSlots[levelToPrepare - 1] || 0
    const preparedSpellsOfLevel = this.system.preparedSpells
      .map((id) => this.items.get(id))
      .filter(
        (i) => i && this.system.spellLevelFor(i) === levelToPrepare,
      ).length

    if (maxSpellsAtLevel <= preparedSpellsOfLevel)
      throw new Error("BAGS.SpellManager.SlotsFull")

    preparedSpells.push(spellId)
    return this.update({ "system.preparedSpells": preparedSpells })
  }

  async unprepareSpell(spellId) {
    const deletedSpellIndex = this.system.preparedSpells.findIndex(
      (id) => id === spellId,
    )
    const preparedSpells = [...this.system.preparedSpells]
    preparedSpells.splice(deletedSpellIndex, 1)
    return this.update({ "system.preparedSpells": preparedSpells })
  }
}
