/**
 * @file The character creation flow.
 *
 * A step-by-step interface for building a first level character. Which steps
 * appear depends entirely on what the GM has configured in the
 * `characterCreationSources` setting -- a game with no ancestry compendium never
 * sees an ancestry step, and a game with nothing configured at all still gets a
 * usable ability score roller.
 *
 * Nothing is written to the Actor until the final step is confirmed, so closing
 * the window partway through leaves the Actor untouched.
 *
 * The `static` members near the bottom are Foundry action handlers. Foundry
 * invokes them with `this` bound to the application instance, so each one only
 * reads the event and hands off to an instance method -- that keeps the DOM
 * plumbing separate from the behaviour, and keeps the private state private.
 */

import BAGSApplication from "../applications/application.mjs"
import {
  DEFAULT_GOLD_ITEM_UUID,
  SYSTEM_NAME,
  SYSTEM_TEMPLATE_PATH,
} from "../config/constants.mjs"
import getItemsFromSources from "../common/get-items-from-sources.mjs"
import signNumber from "../utils/sign-number.mjs"
import { spellLevelForClass } from "../utils/spell-level-for-class.mjs"
import { releaseSheet } from "./actor.character.creation-gate.mjs"
import {
  addToCart,
  buildStartingHitPointsFormula,
  calculateCartTotal,
  calculateRemainingGold,
  getActiveSteps,
  getFirstLevelSpellSlots,
  meetsPrerequisites,
  resolveStartingGoldFormula,
  scoreClassFit,
} from "./actor.character.creation-helpers.mjs"

/** The Item types offered on the equipment step. */
const EQUIPMENT_TYPES = ["weapon", "armor", "item"]

export default class BAGSCharacterCreation extends BAGSApplication {
  /**
   * The choices made so far. This is the single source of truth for the flow;
   * the Actor isn't touched until {@link BAGSCharacterCreation#complete} runs.
   */
  #choices = {
    abilityScores: {},
    identity: null,
    class: null,
    abilities: [],
    spells: [],
    cart: [],
    startingGold: 0,
    hasRolledGold: false,
    alignment: undefined,
    description: undefined,
  }

  /** The step currently on screen. */
  #step = "scores"

  /**
   * Steps the player has actually looked at.
   *
   * Used only by the progress rail. The final step asks for nothing required,
   * so without this it would be ticked off before it had ever been opened,
   * which reads as "you already did this."
   */
  #visited = new Set(["scores"])

  /**
   * Items loaded from the configured sources, keyed by category.
   *
   * Compendium reads are slow enough to be worth doing once per category
   * instead of on every re-render, and a re-render happens on every click.
   */
  #itemCache = {}

  /** Free text search applied to the equipment list. */
  #equipmentSearch = ""

  /**
   * Whether {@link BAGSCharacterCreation#complete} ran to the end.
   *
   * Closing the window early is a cancellation, and the player should be left
   * looking at the Actor's own sheet. Finishing already opens that sheet, so this
   * keeps the two paths from both trying to.
   */
  #completed = false

  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    id: "character-creation-{id}",
    classes: [
      "application--bags",
      "application--sheet",
      "application--character-creation",
    ],
    window: {
      title: "BAGS.CharacterCreation.Title",
      minimizable: true,
      resizable: true,
      contentTag: "section",
    },
    position: {
      width: 900,
      height: 700,
    },
    actions: {
      "goto-step": this.onGotoStep,
      "next-step": this.onNextStep,
      "previous-step": this.onPreviousStep,
      "roll-ability-scores": this.onRollAbilityScores,
      "reroll-ability-score": this.onRerollAbilityScore,
      "select-identity": this.onSelectIdentity,
      "select-class": this.onSelectClass,
      "toggle-ability": this.onToggleAbility,
      "toggle-spell": this.onToggleSpell,
      "roll-starting-gold": this.onRollStartingGold,
      "add-to-cart": this.onAddToCart,
      "remove-from-cart": this.onRemoveFromCart,
      finish: this.onFinish,
    },
    form: {
      handler: this.onChangeForm,
      submitOnChange: true,
      closeOnSubmit: false,
    },
  }

  /**
   * The creation flow manages its own step navigation rather than using the
   * base class's tab chrome, because the set of steps changes with the world's
   * configured sources. An empty TABS keeps the frame's tab nav from rendering.
   */
  static TABS = []

  /** Icons for the step navigation, keyed by step ID. */
  static STEP_ICONS = {
    scores: "fa-solid fa-dice-d20",
    identity: "fa-solid fa-people-group",
    class: "fa-solid fa-shield-halved",
    abilities: "fa-solid fa-sparkles",
    spells: "fa-solid fa-book-sparkles",
    equipment: "fa-solid fa-bag-shopping",
    details: "fa-solid fa-user-pen",
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/character/creation`
  }

  static PARTS = {
    steps: {
      template: `${this.TEMPLATE_ROOT}/steps.hbs`,
    },
    scores: {
      template: `${this.TEMPLATE_ROOT}/step-scores.hbs`,
      scrollable: [".scrollable"],
    },
    identity: {
      template: `${this.TEMPLATE_ROOT}/step-identity.hbs`,
      scrollable: [".scrollable"],
    },
    class: {
      template: `${this.TEMPLATE_ROOT}/step-class.hbs`,
      scrollable: [".scrollable"],
    },
    abilities: {
      template: `${this.TEMPLATE_ROOT}/step-abilities.hbs`,
      scrollable: [".scrollable"],
    },
    spells: {
      template: `${this.TEMPLATE_ROOT}/step-spells.hbs`,
      scrollable: [".scrollable"],
    },
    equipment: {
      template: `${this.TEMPLATE_ROOT}/step-equipment.hbs`,
      scrollable: [".scrollable"],
    },
    details: {
      template: `${this.TEMPLATE_ROOT}/step-details.hbs`,
      scrollable: [".scrollable"],
    },
    footer: {
      template: `${this.TEMPLATE_ROOT}/footer.hbs`,
    },
  }

  /** @override */
  get title() {
    return game.i18n.format("BAGS.CharacterCreation.Title", {
      name: this.document.name,
    })
  }

  // === Configuration reads ===================================================

  /*
   * These two getters read world configuration rather than instance state.
   * They're kept as instance getters so the rest of the class can read
   * `this.sources` and `this.abilityScoreSystem` without ceremony, and so a
   * subclass can override where the flow gets its data from.
   */

  /**
   * The configured creation sources.
   * @returns {object} Source lists keyed by category
   */
  // eslint-disable-next-line class-methods-use-this
  get sources() {
    return game.settings.get(SYSTEM_NAME, "characterCreationSources") || {}
  }

  /**
   * The selected ability score rules module.
   * @returns {object} The ability score system component
   */
  // eslint-disable-next-line class-methods-use-this
  get abilityScoreSystem() {
    return (
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      ) || {}
    )
  }

  /**
   * The steps to show, given the configured sources and the chosen class.
   * @returns {string[]} Active step IDs, in order
   */
  get activeSteps() {
    return getActiveSteps(this.sources, this.#choices.class)
  }

  /**
   * Whether every ability score has been rolled or entered.
   * @returns {boolean} True when no score is missing
   */
  get hasAllAbilityScores() {
    const { abilityScores = new Map() } = this.abilityScoreSystem
    const keys = Array.from(abilityScores.keys())

    if (!keys.length) return false

    return keys.every((key) => {
      const value = this.#choices.abilityScores[key]
      return typeof value === "number" && value > 0
    })
  }

  /**
   * The things still standing between this character and being finished.
   *
   * Only genuinely required choices are listed. Equipment, ancestry, abilities,
   * and spells are all optional -- plenty of tables start characters with
   * nothing but a class and a weapon they narrate for themselves.
   * @returns {string[]} Localization keys describing what's missing
   */
  get missingRequirements() {
    const missing = []

    if (!this.hasAllAbilityScores)
      missing.push("BAGS.CharacterCreation.Requirements.AbilityScores")

    // A class is only required when the world actually supplies classes.
    if (this.sources.classes?.length && !this.#choices.class)
      missing.push("BAGS.CharacterCreation.Requirements.Class")

    return missing
  }

  /**
   * Whether the flow can be completed.
   * @returns {boolean} True when nothing required is missing
   */
  get canFinish() {
    return this.missingRequirements.length === 0
  }

  // === Item loading ==========================================================

  /**
   * Load the Items for a source category, caching the result.
   *
   * `getItemsFromSources` already skips sources it can't resolve, so a deleted
   * folder costs that folder's contents rather than the whole category.
   * @param {string} category - The source category to load
   * @param {string|string[]} type - The Item type(s) to keep
   * @returns {Promise<Array>} The matching Items
   */
  async #loadItems(category, type) {
    if (this.#itemCache[category]) return this.#itemCache[category]

    const sources = this.sources[category] || []
    if (!sources.length) return []

    this.#itemCache[category] = await getItemsFromSources(sources, { type })

    return this.#itemCache[category]
  }

  // === Rendering =============================================================

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const steps = this.activeSteps
    const stepIndex = steps.indexOf(this.#step)

    return {
      ...context,
      choices: this.#choices,
      steps: steps.map((id, index) => ({
        id,
        index,
        active: id === this.#step,
        complete: this.#isStepComplete(id),
        label: `BAGS.CharacterCreation.Steps.${id}.Label`,
        icon: this.constructor.STEP_ICONS[id],
      })),
      currentStep: this.#step,
      isFirstStep: stepIndex <= 0,
      isLastStep: stepIndex === steps.length - 1,
      canFinish: this.canFinish,
    }
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    await super._preparePartContext(partId, context, options)

    // Every step part is wrapped by the shared `sheetTab` partial, which wants
    // a `tab` record. Reusing it keeps this flow's markup consistent with the
    // sheets even though the flow doesn't use the tab system for navigation.
    if (this.constructor.STEP_ICONS[partId]) {
      context.tab = {
        id: partId,
        group: "creation",
        active: partId === this.#step,
        cssClass: partId === this.#step ? "active" : "",
      }
    }

    switch (partId) {
      case "scores":
        return this.#prepareScoresContext(context)
      case "identity":
        return this.#prepareIdentityContext(context)
      case "class":
        return this.#prepareClassContext(context)
      case "abilities":
        return this.#prepareAbilitiesContext(context)
      case "spells":
        return this.#prepareSpellsContext(context)
      case "equipment":
        return this.#prepareEquipmentContext(context)
      case "details":
        return this.#prepareDetailsContext(context)
      default:
        return context
    }
  }

  /**
   * Build the ability score step's context.
   * @param {object} context - The part context
   * @returns {object} The context, with ability score rows added
   */
  #prepareScoresContext(context) {
    const { abilityScores = new Map() } = this.abilityScoreSystem

    context.abilities = Array.from(abilityScores.entries()).map(
      ([key, data]) => {
        const value = this.#choices.abilityScores[key] ?? null

        return {
          key,
          label: data.label,
          hint: data.hint,
          value,
          modifiers: this.#describeModifiers(data, value),
        }
      },
    )
    context.hasRolled = context.abilities.some((a) => a.value !== null)

    return context
  }

  /**
   * Turn an ability score's modifier record into sentences a player can read.
   *
   * The record is raw data -- `{ meleeAttack: 1, openDoors: 3 }` -- and the
   * rules module's `modifierDisplay` says how each of those numbers should be
   * phrased, because they aren't all the same kind of number. See
   * {@link module:data/bx.ability-scores.modifierDisplay} for the details.
   *
   * A rules module that doesn't describe its modifiers still gets something
   * legible, just terser: the raw key and a signed number.
   * @param {object} abilityData - The ability's entry in the rules module
   * @param {number|null} value - The rolled score
   * @returns {string[]} Localized descriptions, one per meaningful modifier
   */
  #describeModifiers(abilityData, value) {
    if (value === null) return []

    const modifiers = abilityData?.modifiers?.get(value) || {}
    const display = this.abilityScoreSystem.modifierDisplay || {}

    return Object.entries(modifiers)
      .filter(([key, modifier]) => {
        if (typeof modifier !== "number") return false

        // A +0 bonus isn't worth the space, unless the rules module says this
        // particular zero means something.
        return modifier !== 0 || display[key]?.showZero === true
      })
      .map(([key, modifier]) => {
        const descriptor = display[key]
        const labelKey = descriptor?.values?.[modifier] ?? descriptor?.label

        if (!labelKey) return `${key} ${signNumber(modifier)}`

        return game.i18n.format(labelKey, {
          value: modifier,
          signed: signNumber(modifier),
        })
      })
  }

  /**
   * Build the ancestry step's context.
   * @param {object} context - The part context
   * @returns {Promise<object>} The context, with selectable identities added
   */
  async #prepareIdentityContext(context) {
    const identities = await this.#loadItems("identity", "identity")

    context.identities = identities.map((item) => ({
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      description: item.system.description,
      selected: this.#choices.identity?.uuid === item.uuid,
      eligible: meetsPrerequisites(
        item.system.prerequisites,
        this.#choices.abilityScores,
      ),
    }))

    return context
  }

  /**
   * Build the class step's context.
   *
   * Classes the character can't take are kept in the list but flagged, so a
   * player can see what they narrowly missed instead of wondering why a class
   * they expected is absent.
   * @param {object} context - The part context
   * @returns {Promise<object>} The context, with selectable classes added
   */
  async #prepareClassContext(context) {
    const classes = await this.#loadItems("classes", "class")

    context.classes = classes
      .map((item) => {
        const fit = scoreClassFit(item, this.#choices.abilityScores)

        return {
          uuid: item.uuid,
          name: item.name,
          img: item.img,
          hitDieSize: item.system.hitDieSize,
          description: item.system.description,
          selected: this.#choices.class?.uuid === item.uuid,
          eligible: fit >= 0,
          fit,
          isCaster: getFirstLevelSpellSlots(item).some(Boolean),
        }
      })
      .sort((a, b) => b.fit - a.fit || a.name.localeCompare(b.name))

    return context
  }

  /**
   * Build the abilities step's context.
   * @param {object} context - The part context
   * @returns {Promise<object>} The context, with selectable abilities added
   */
  async #prepareAbilitiesContext(context) {
    const abilities = await this.#loadItems("abilities", "ability")

    context.abilityItems = abilities.map((item) => ({
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      description: item.system.description,
      selected: this.#choices.abilities.some((a) => a.uuid === item.uuid),
    }))

    return context
  }

  /**
   * Build the spell step's context.
   *
   * The class decides how many spells of each level can be taken, so the step
   * shows slot counts alongside the list and reports when a level is full.
   * @param {object} context - The part context
   * @returns {Promise<object>} The context, with selectable spells added
   */
  async #prepareSpellsContext(context) {
    const spells = await this.#loadItems("spells", "spell")
    const slots = getFirstLevelSpellSlots(this.#choices.class)

    const chosenAtLevel = (level) =>
      this.#choices.spells.filter((s) => s.level === level).length

    // A class may keep a list of the spells it can learn. A class that doesn't
    // -- the rulesets that sort spells by tradition rather than by list never
    // fill one in -- offers everything the configured sources turned up.
    const classItem = this.#choices.class
    const listed = new Set(classItem?.system?.spellUUIDs || [])
    const available = listed.size
      ? spells.filter((s) => listed.has(s.uuid))
      : spells

    context.spellLevels = slots
      .map((count, index) => {
        const level = index + 1
        if (!count) return null

        const chosen = chosenAtLevel(level)

        return {
          level,
          slots: count,
          chosen,
          full: chosen >= count,
          spells: available
            .filter((s) => spellLevelForClass(classItem, s) === level)
            .map((item) => ({
              uuid: item.uuid,
              name: item.name,
              img: item.img,
              level,
              selected: this.#choices.spells.some((s) => s.uuid === item.uuid),
            })),
        }
      })
      .filter(Boolean)

    return context
  }

  /**
   * Build the equipment step's context.
   * @param {object} context - The part context
   * @returns {Promise<object>} The context, with the shop and cart added
   */
  async #prepareEquipmentContext(context) {
    const items = await this.#loadItems("equipment", EQUIPMENT_TYPES)
    const spent = calculateCartTotal(this.#choices.cart)
    const remaining = calculateRemainingGold(
      this.#choices.startingGold,
      this.#choices.cart,
    )

    const search = this.#equipmentSearch.trim().toLowerCase()

    context.goldFormula = resolveStartingGoldFormula(
      this.#choices.class,
      game.settings.get(SYSTEM_NAME, "characterCreationStartingGold"),
    )
    context.hasRolledGold = this.#choices.hasRolledGold
    context.gold = { starting: this.#choices.startingGold, spent, remaining }
    context.search = this.#equipmentSearch

    context.availableItems = items
      .filter((item) => !search || item.name.toLowerCase().includes(search))
      .map((item) => ({
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        type: item.type,
        cost: item.system.cost || 0,
        affordable: (item.system.cost || 0) <= remaining,
      }))

    context.cart = this.#choices.cart.map((entry, index) => ({
      ...entry,
      index,
      subtotal: entry.cost * entry.quantity,
    }))

    return context
  }

  /**
   * Build the final details step's context.
   * @param {object} context - The part context
   * @returns {object} The context, with a summary of every choice made
   */
  #prepareDetailsContext(context) {
    context.summary = {
      abilityScores: this.#choices.abilityScores,
      identity: this.#choices.identity?.name,
      class: this.#choices.class?.name,
      abilities: this.#choices.abilities.map((a) => a.name),
      spells: this.#choices.spells.map((s) => s.name),
      itemCount: this.#choices.cart.reduce((n, e) => n + e.quantity, 0),
      gold: calculateRemainingGold(
        this.#choices.startingGold,
        this.#choices.cart,
      ),
    }
    context.missingRequirements = this.missingRequirements

    return context
  }

  /**
   * Whether a step has been satisfied, for the progress indicator.
   * @param {string} step - The step ID
   * @returns {boolean} Whether the step counts as done
   */
  #isStepComplete(step) {
    switch (step) {
      case "scores":
        return this.hasAllAbilityScores
      case "identity":
        return !!this.#choices.identity
      case "class":
        return !!this.#choices.class
      case "abilities":
        return this.#choices.abilities.length > 0
      case "spells":
        return this.#choices.spells.length > 0
      case "equipment":
        return this.#choices.hasRolledGold
      case "details":
        // Nothing here is required, so the only thing to report is whether the
        // player has been given the chance to review it.
        return this.#visited.has("details")
      default:
        return false
    }
  }

  // === Behaviour =============================================================
  // Everything below is the flow's actual behaviour, called by the action
  // handlers at the end of the class.

  /**
   * Move to a step by ID, ignoring steps that aren't currently active.
   * @param {string} step - The step ID to show
   */
  setStep(step) {
    if (!this.activeSteps.includes(step)) return
    this.#step = step
    this.#visited.add(step)
    this.render()
  }

  /**
   * Move forward or backward through the active steps.
   * @param {number} offset - How many steps to move; negative goes back
   */
  shiftStep(offset) {
    const steps = this.activeSteps
    const target = steps[steps.indexOf(this.#step) + offset]
    if (target) this.setStep(target)
  }

  /**
   * Roll every ability score, then show them all at once.
   * @returns {Promise<void>} Resolves once every score is rolled
   */
  async rollAllAbilityScores() {
    const { abilityScores = new Map() } = this.abilityScoreSystem
    const keys = Array.from(abilityScores.keys())

    await Promise.all(keys.map((key) => this.rollAbilityScore(key)))

    this.render()
  }

  /**
   * Roll one ability score.
   *
   * Rendering is left to the caller so that rolling a full set of six scores
   * repaints the window once instead of six times.
   * @param {string} key - The ability score key
   * @returns {Promise<void>} Resolves once the score is recorded
   */
  async rollAbilityScore(key) {
    const { rollFormula = "3d6" } = this.abilityScoreSystem
    const roll = await new Roll(rollFormula).evaluate()

    this.#choices.abilityScores[key] = roll.total
  }

  /**
   * Set an ability score by hand.
   * @param {string} key - The ability score key
   * @param {number} value - The score to set
   */
  setAbilityScore(key, value) {
    if (Number.isFinite(value) && value > 0)
      this.#choices.abilityScores[key] = value
  }

  /**
   * Select an ancestry, or clear it when it's already selected.
   * @param {string} uuid - The identity Item's UUID
   * @returns {Promise<void>} Resolves once the choice is applied
   */
  async chooseIdentity(uuid) {
    this.#choices.identity =
      this.#choices.identity?.uuid === uuid ? null : await fromUuid(uuid)

    this.render()
  }

  /**
   * Select a class, or clear it when it's already selected.
   *
   * Changing class clears any chosen spells and any gold already rolled, since
   * both can depend on which class was picked.
   * @param {string} uuid - The class Item's UUID
   * @returns {Promise<void>} Resolves once the choice is applied
   */
  async chooseClass(uuid) {
    const isDeselecting = this.#choices.class?.uuid === uuid

    this.#choices.class = isDeselecting ? null : await fromUuid(uuid)
    this.#choices.spells = []
    this.#choices.startingGold = 0
    this.#choices.hasRolledGold = false

    // The step list may have changed shape; make sure we're still on a step
    // that exists before re-rendering.
    if (!this.activeSteps.includes(this.#step)) this.#step = "class"

    this.render()
  }

  /**
   * Add or remove an ability.
   * @param {string} uuid - The ability Item's UUID
   * @returns {Promise<void>} Resolves once the choice is applied
   */
  async toggleAbilityChoice(uuid) {
    const existing = this.#choices.abilities.findIndex((a) => a.uuid === uuid)

    if (existing > -1) this.#choices.abilities.splice(existing, 1)
    else {
      const item = await fromUuid(uuid)
      if (item) this.#choices.abilities.push({ uuid, name: item.name })
    }

    this.render()
  }

  /**
   * Add or remove a spell, respecting the class's slot count for its level.
   * @param {string} uuid - The spell Item's UUID
   * @param {number} level - The spell's level
   * @returns {Promise<void>} Resolves once the choice is applied
   */
  async toggleSpellChoice(uuid, level) {
    const existing = this.#choices.spells.findIndex((s) => s.uuid === uuid)

    if (existing > -1) {
      this.#choices.spells.splice(existing, 1)
      this.render()
      return
    }

    const slots = getFirstLevelSpellSlots(this.#choices.class)[level - 1] || 0
    const taken = this.#choices.spells.filter((s) => s.level === level).length

    if (taken >= slots) {
      ui.notifications.warn(
        game.i18n.format("BAGS.CharacterCreation.Spells.NoSlotsLeft", {
          level,
        }),
      )
      return
    }

    const item = await fromUuid(uuid)
    if (item) this.#choices.spells.push({ uuid, name: item.name, level })

    this.render()
  }

  /**
   * Roll the character's starting money.
   *
   * Uses the class's formula when it has one, otherwise the world default. The
   * roll is posted to chat so the table can see it wasn't fudged.
   * @returns {Promise<void>} Resolves once the roll is applied
   */
  async rollStartingGold() {
    const formula = resolveStartingGoldFormula(
      this.#choices.class,
      game.settings.get(SYSTEM_NAME, "characterCreationStartingGold"),
    )

    let roll
    try {
      roll = await new Roll(formula).evaluate()
    } catch {
      ui.notifications.error(
        game.i18n.format("BAGS.CharacterCreation.Equipment.BadGoldFormula", {
          formula,
        }),
      )
      return
    }

    this.#choices.startingGold = Math.max(0, Math.floor(roll.total))
    this.#choices.hasRolledGold = true

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: game.i18n.localize(
        "BAGS.CharacterCreation.Equipment.StartingGold",
      ),
    })

    this.render()
  }

  /**
   * Put an item in the cart, refusing anything the character can't afford.
   * @param {string} uuid - The Item's UUID
   * @param {number} quantity - How many to buy
   * @returns {Promise<void>} Resolves once the cart is updated
   */
  async addItemToCart(uuid, quantity = 1) {
    const item = await fromUuid(uuid)
    if (!item) return

    const cost = item.system.cost || 0
    const remaining = calculateRemainingGold(
      this.#choices.startingGold,
      this.#choices.cart,
    )

    if (cost * quantity > remaining) {
      ui.notifications.warn(
        game.i18n.localize("BAGS.CharacterCreation.Equipment.CannotAfford"),
      )
      return
    }

    this.#choices.cart = addToCart(this.#choices.cart, {
      uuid,
      name: item.name,
      img: item.img,
      cost,
      quantity,
    })

    this.render()
  }

  /**
   * Take an entry back out of the cart.
   * @param {number} index - The cart entry's index
   */
  removeCartEntry(index) {
    this.#choices.cart.splice(index, 1)
    this.render()
  }

  /**
   * Record the equipment search term.
   * @param {string} search - The search text
   */
  setEquipmentSearch(search) {
    this.#equipmentSearch = search ?? ""
  }

  /**
   * Record the free text biographical details.
   * @param {object} details - The submitted details
   * @param {string} [details.alignment] - The character's alignment
   * @param {string} [details.description] - The character's description
   */
  setDetails({ alignment, description }) {
    if (alignment !== undefined) this.#choices.alignment = alignment
    if (description !== undefined) this.#choices.description = description
  }

  // === Completion ============================================================

  /**
   * Write every choice onto the Actor.
   *
   * Ordering matters: the class Item has to exist before hit points are rolled,
   * because the class supplies the hit dice.
   * @returns {Promise<void>} Resolves once the Actor is built
   */
  async complete() {
    if (!this.canFinish) {
      ui.notifications.warn(
        game.i18n.localize("BAGS.CharacterCreation.Requirements.Incomplete"),
      )
      return
    }

    try {
      await this.#applyAbilityScores()
      await this.#createChosenItems()
      await this.#applyStartingHitPoints()
    } catch (error) {
      console.error("BAGS | Character creation failed", error)
      ui.notifications.error(
        game.i18n.localize("BAGS.CharacterCreation.Failed"),
      )
      return
    }

    this.#completed = true

    // Released before the close rather than left to `_onClose`, so the order of
    // the two can't matter: the sheet is asked to render immediately afterwards,
    // and a sheet still held at that moment would quietly refuse to open.
    releaseSheet(this.document)

    await this.close()
    this.document.sheet.render(true)
  }

  /** @override */
  _onClose(options) {
    super._onClose(options)

    // Backing out of creation leaves a blank but perfectly usable character, so
    // hand the player its sheet rather than nothing at all. Finishing has already
    // done this itself, and an already-open sheet needs no help -- which is also
    // what stops a hand-opened creation window from popping a sheet on close.
    releaseSheet(this.document)

    if (!this.#completed && !this.document.sheet?.rendered)
      this.document.sheet?.render(true)
  }

  /**
   * Write ability scores and biographical details to the Actor.
   * @returns {Promise<void>} Resolves once the Actor is updated
   */
  async #applyAbilityScores() {
    const update = {}

    Object.entries(this.#choices.abilityScores).forEach(([key, value]) => {
      update[`system.base.abilityScores.${key}`] = value
    })

    if (this.#choices.alignment !== undefined)
      update["system.biographicalDetails.alignment"] = this.#choices.alignment

    if (this.#choices.description !== undefined)
      update["system.biographicalDetails.description"] =
        this.#choices.description

    if (Object.keys(update).length) await this.document.update(update)
  }

  /**
   * Create the class, ancestry, abilities, spells, equipment, and leftover
   * money on the Actor in a single embedded document call.
   * @returns {Promise<void>} Resolves once the Items are created
   */
  async #createChosenItems() {
    const uuids = [
      this.#choices.class?.uuid,
      this.#choices.identity?.uuid,
      ...(this.#choices.class?.system?.features || []),
      ...this.#choices.abilities.map((a) => a.uuid),
      ...this.#choices.spells.map((s) => s.uuid),
    ].filter(Boolean)

    // Quantities are keyed by UUID so purchased stacks and leftover money can
    // be created in the same pass as everything else.
    const quantities = new Map(
      this.#choices.cart.map((entry) => [entry.uuid, entry.quantity]),
    )

    const remaining = calculateRemainingGold(
      this.#choices.startingGold,
      this.#choices.cart,
    )
    if (remaining > 0) quantities.set(DEFAULT_GOLD_ITEM_UUID, remaining)

    const documents = await Promise.all(
      [...uuids, ...quantities.keys()].map(async (uuid) => {
        const source = await fromUuid(uuid)
        if (!source) {
          console.warn(`BAGS | Skipping missing creation Item ${uuid}`)
          return null
        }

        const data = source.toObject()
        delete data._id

        const quantity = quantities.get(uuid)
        if (quantity !== undefined) data.system.quantity = quantity

        return data
      }),
    )

    const toCreate = documents.filter(Boolean)
    if (toCreate.length)
      await this.document.createEmbeddedDocuments("Item", toCreate)
  }

  /**
   * Roll and set first level hit points.
   *
   * Skipped entirely when the class has no hit dice configured, leaving the
   * Actor's existing hit points alone rather than zeroing them.
   * @returns {Promise<void>} Resolves once hit points are set
   */
  async #applyStartingHitPoints() {
    const conModifier = this.document.system.abilityScores?.con?.bonusHP ?? 0

    const formula = buildStartingHitPointsFormula(
      this.#choices.class,
      conModifier,
    )
    if (!formula) return

    const roll = await new Roll(formula).evaluate()

    // A first level character with 0 or fewer hit points can't be played.
    const total = Math.max(1, roll.total)

    await this.document.update({
      "system.hp.value": total,
      "system.hp.max": total,
    })
  }

  // === Action handlers =======================================================
  // Foundry calls these with `this` bound to the application instance. They
  // exist only to pull values out of the DOM event and delegate.

  /**
   * Read a dataset value from the element that triggered an event.
   * @param {Event} event - The originating event
   * @param {string} attribute - The dataset key to read
   * @returns {string|undefined} The value, if present
   */
  static #datasetValue(event, attribute) {
    const selector = `[data-${attribute.replace(
      /[A-Z]/g,
      (c) => `-${c.toLowerCase()}`,
    )}]`
    return event.target.closest(selector)?.dataset?.[attribute]
  }

  /**
   * Jump straight to a step from the progress nav.
   * @param {Event} event - The originating click event
   */
  static onGotoStep(event) {
    const step = BAGSCharacterCreation.#datasetValue(event, "step")
    if (step) this.setStep(step)
  }

  /** Advance one step. */
  static onNextStep() {
    this.shiftStep(1)
  }

  /** Go back one step. */
  static onPreviousStep() {
    this.shiftStep(-1)
  }

  /**
   * Roll every ability score.
   * @returns {Promise<void>} Resolves once the rolls finish
   */
  static async onRollAbilityScores() {
    await this.rollAllAbilityScores()
  }

  /**
   * Reroll a single ability score.
   * @param {Event} event - The originating click event
   * @returns {Promise<void>} Resolves once the roll finishes
   */
  static async onRerollAbilityScore(event) {
    const ability = BAGSCharacterCreation.#datasetValue(event, "ability")
    if (!ability) return

    await this.rollAbilityScore(ability)
    this.render()
  }

  /**
   * Select or clear an ancestry.
   * @param {Event} event - The originating click event
   * @returns {Promise<void>} Resolves once the choice is applied
   */
  static async onSelectIdentity(event) {
    const uuid = BAGSCharacterCreation.#datasetValue(event, "uuid")
    if (uuid) await this.chooseIdentity(uuid)
  }

  /**
   * Select or clear a class.
   * @param {Event} event - The originating click event
   * @returns {Promise<void>} Resolves once the choice is applied
   */
  static async onSelectClass(event) {
    const uuid = BAGSCharacterCreation.#datasetValue(event, "uuid")
    if (uuid) await this.chooseClass(uuid)
  }

  /**
   * Add or remove an ability.
   * @param {Event} event - The originating click event
   * @returns {Promise<void>} Resolves once the choice is applied
   */
  static async onToggleAbility(event) {
    const uuid = BAGSCharacterCreation.#datasetValue(event, "uuid")
    if (uuid) await this.toggleAbilityChoice(uuid)
  }

  /**
   * Add or remove a spell.
   * @param {Event} event - The originating click event
   * @returns {Promise<void>} Resolves once the choice is applied
   */
  static async onToggleSpell(event) {
    const element = event.target.closest("[data-uuid]")
    const { uuid, spellLevel } = element?.dataset ?? {}
    if (!uuid) return

    await this.toggleSpellChoice(uuid, Number(spellLevel) || 1)
  }

  /**
   * Roll starting money.
   * @returns {Promise<void>} Resolves once the roll is applied
   */
  static async onRollStartingGold() {
    await this.rollStartingGold()
  }

  /**
   * Put an item in the cart.
   * @param {Event} event - The originating click event
   * @returns {Promise<void>} Resolves once the cart is updated
   */
  static async onAddToCart(event) {
    const element = event.target.closest("[data-uuid]")
    const { uuid } = element?.dataset ?? {}
    if (!uuid) return

    const quantity =
      Number(element.querySelector("[data-quantity]")?.value) || 1

    await this.addItemToCart(uuid, quantity)
  }

  /**
   * Take an item out of the cart.
   * @param {Event} event - The originating click event
   */
  static onRemoveFromCart(event) {
    const index = BAGSCharacterCreation.#datasetValue(event, "index")
    if (index !== undefined) this.removeCartEntry(Number(index))
  }

  /**
   * Finish creation and build the character.
   * @returns {Promise<void>} Resolves once the Actor is built
   */
  static async onFinish() {
    await this.complete()
  }

  /**
   * Absorb form field changes.
   *
   * The name field writes straight to the Actor, since renaming is harmless and
   * lets the player watch the window title update. Everything else is held in
   * the flow's state until it's confirmed.
   * @param {Event} _event - The originating form event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The submitted form data
   * @returns {Promise<void>} Resolves once the changes are recorded
   */
  static async onChangeForm(_event, _form, formData) {
    const data = formData.object

    if (data.search !== undefined) this.setEquipmentSearch(data.search)

    Object.entries(data)
      .filter(([key]) => key.startsWith("abilityScores."))
      .forEach(([key, value]) => {
        this.setAbilityScore(key.split(".")[1], Number(value))
      })

    this.setDetails(data)

    if (data.name && data.name !== this.document.name)
      await this.document.update({ name: data.name })

    this.render()
  }
}
