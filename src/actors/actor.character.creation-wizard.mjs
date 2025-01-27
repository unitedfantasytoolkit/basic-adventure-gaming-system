import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import WizardManager from "../common/wizard-step-manager.mjs"
import animatedRoll from "../utils/animated-dice-roll.mjs"
import createItemsFromUUIDs from "../utils/create-items-from-uuids.mjs"
import getItemsFromSources from "../common/get-items-from-sources.mjs"

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

export default class CharacterCreationWizard extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  actor

  #wizardManager

  wizardData

  static #EQUIPMENT_FILTERS = {
    types: {
      weapon: "TYPES.Item.weapon",
      armor: "TYPES.Item.armor",
      item: "TYPES.Item.item",
      container: "TYPES.Item.container",
    },
    sort: {
      nameAsc: "BAGS.Sort.NameAscending",
      nameDesc: "BAGS.Sort.NameDescending",
      costAsc: "BAGS.Sort.CostAscending",
      costDesc: "BAGS.Sort.CostDescending",
    },
  }

  constructor(options = {}) {
    super(options)
    this.actor = options.actor

    this.#wizardManager = new WizardManager({
      abilityScores: { current: true },
      class: {},
      equipment: {},
      biography: {},
    })

    this.wizardData = {
      abilityScores: Object.keys(CharacterCreationWizard.#abilityScores).reduce(
        (prev, curr) => ({ ...prev, [curr]: 0 }),
        {},
      ),
      selectedClass: null,
      equipment: [],
      biography: {},
      startingGold: 0,
      equipmentFilters: {
        search: "",
        types: Object.keys(CharacterCreationWizard.#EQUIPMENT_FILTERS.types),
        sort: "nameAsc",
      },
    }
  }

  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    id: "character-wizard-{id}",
    classes: [
      "application--character-wizard",
      "application--bags",
      "scrollable",
    ],
    window: {
      minimizable: false,
      resizable: false,
      contentTag: "form",
      contentClasses: [],
    },
    actions: {
      // Ability Scores
      "roll-abilities": this.#onRollAbilities,
      "accept-abilities": this.#onAcceptAbilities,
      // Character Class
      "select-class": this.#onSelectClass,
      "confirm-class": this.#onConfirmClass,
      // Navigation
      "previous-step": this.#onPreviousStep,
      "next-step": this.#onNextStep,
      // Equipment
      "add-to-cart": this.#onAddToCart,
      "remove-from-cart": this.#onRemoveFromCart,
      "confirm-equipment": this.#onConfirmEquipment,
      "update-equipment-search": this.#onUpdateEquipmentSearch,
      "toggle-equipment-type": this.#onToggleEquipmentType,
      "change-equipment-sort": this.#onChangeEquipmentSort,
    },
    position: {
      width: 720,
      height: 640,
    },
  }

  // === Rendering ==========================================================
  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/character/creation-wizard`
  }

  static PARTS = {
    // navigation: {
    //   template: `${this.TEMPLATE_ROOT}/navigation.hbs`,
    // },
    abilities: {
      template: `${this.TEMPLATE_ROOT}/step-abilities.hbs`,
      scrollable: [".step-content"],
    },
    class: {
      template: `${this.TEMPLATE_ROOT}/step-class.hbs`,
      scrollable: [".step-content"],
    },
    equipment: {
      template: `${this.TEMPLATE_ROOT}/step-equipment.hbs`,
      scrollable: [".step-content"],
    },
  }

  get title() {
    console.info(this.actor)
    return game.i18n.format(
      game.i18n.localize("BAGS.Actors.Character.CreationWizard.Title"),
      { name: this.actor.name },
    )
  }

  // === Context Preparation ===================================================
  async _prepareContext(_options) {
    return {
      steps: this.#wizardManager.steps,
      data: this.wizardData,
      config: {
        abilityFormula: CharacterCreationWizard.#abilityScoreFormula,
        abilityScores: CharacterCreationWizard.#abilityScores,
      },
    }
  }

  async _preparePartContext(partId, context) {
    switch (partId) {
      case "navigation":
        // Add any navigation-specific context
        break
      case "abilities":
        // Add ability score context
        break
      case "class":
        context.availableClasses = await this.#getAvailableClasses()
        break
      case "equipment":
        // const method = game.settings.get(
        //   SYSTEM_NAME,
        //   "characterCreationStartingGear",
        // )
        //
        const method = null

        if (method === "table") {
          const results = await this.#rollStartingGear()
          if (results?.length) {
            context.tableResults = results
            this.#wizardManager.setStepValidity("equipment", true)
          }
        } else {
          const shoppingData = await this.#prepareShoppingData()
          context.shoppingData = shoppingData
          // Step is valid if they have items in cart or explicitly skip
          this.#wizardManager.setStepValidity(
            "equipment",
            this.wizardData.equipment.length > 0 ||
              this.wizardData.skipEquipment,
          )
        }
        break
      default:
        break
    }
    return context
  }

  // === Action Handlers ===================================================
  static async #onRollAbilities(event) {
    const abilityScores = Object.keys(CharacterCreationWizard.#abilityScores)
    const formula = CharacterCreationWizard.#abilityScoreFormula
    const results = {}

    for (const score of abilityScores) {
      const roll = await new Roll(formula).evaluate({
        async: true,
      })
      await animatedRoll(
        this.element.querySelector(`.ability-score[data-ability='${score}']`),
        roll,
      )
      results[score] = roll.total
    }

    this.wizardData.abilityScores = results
    this.#wizardManager.setStepValidity("abilityScores", true)
    this.render()
  }

  static async #onAcceptAbilities() {
    await this.actor.update({
      "system.base.abilityScores": this.wizardData.abilityScores,
    })

    this.#wizardManager.moveToNext()
    this.render()
  }

  // Add class selection methods
  static async #onSelectClass(event) {
    const { uuid } = event.target.closest("[data-uuid]").dataset
    const classItem = await fromUuid(uuid)

    this.wizardData.selectedClass = classItem
    this.#wizardManager.setStepValidity("class", true)
    this.render()
  }

  static async #onConfirmClass() {
    const cls = this.wizardData.selectedClass
    if (!cls) return

    await createItemsFromUUIDs([cls.uuid], this.actor)

    if (cls.system.features?.length)
      await createItemsFromUUIDs(cls.system.features, this.actor)

    this.#wizardManager.moveToNext()

    this.render()
  }

  async #getAvailableClasses() {
    const sources =
      game.settings.get(SYSTEM_NAME, "characterCreationSources")?.classes || []

    return (await getItemsFromSources(sources, { type: "class" }))
      .flat()
      .sort((a, b) => {
        const aScore = this.#getClassCompatibilityScore(a)
        const bScore = this.#getClassCompatibilityScore(b)
        return bScore - aScore
      })
  }

  #getClassCompatibilityScore(cls) {
    let score = 0
    const abilities = this.wizardData.abilityScores

    // First, check if the character meets prerequisites
    const prereqs = cls.system.prerequisites
    const meetsPrereqs = Object.entries(prereqs).every(
      ([key, value]) => abilities[key] >= value,
    )

    // If prerequisites aren't met, return -1 to sort to bottom
    if (!meetsPrereqs) return -1

    // Check hit die size for martial tendency
    if (
      cls.system.hitDieSize === 8 &&
      (abilities.str >= 13 || abilities.dex >= 13 || abilities.con >= 13)
    ) {
      score += 1
    }

    const scoreOnRequisites = (requisites) => {
      if (requisites.isAnd) {
        const allMet = Object.entries(requisites)
          .filter(([key]) => key !== "isAnd")
          .every(([key, value]) => abilities[key] >= value)
        if (allMet) score += 2
      } else {
        const anyMet = Object.entries(requisites)
          .filter(([key]) => key !== "isAnd")
          .some(([key, value]) => abilities[key] >= value)
        if (anyMet) score += 2
      }
    }

    // Check full prime requisites for XP bonus
    scoreOnRequisites(cls.system.fullPrimeRequisites)
    scoreOnRequisites(cls.system.halfPrimeRequisites)

    return score
  }

  static #onPreviousStep() {
    // Handle navigation to previous step
  }

  static #onNextStep() {
    // Handle navigation to next step
  }

  static get #abilityScores() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )
    return Array.from(
      (abilityScoreSettings?.abilityScores || new Map()).entries(),
    ).reduce((prev, curr) => ({ ...prev, [curr[0]]: curr[1] }), {})
  }

  static get #abilityScoreFormula() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )

    return abilityScoreSettings?.rollFormula || "3d6"
  }

  async #rollStartingGear() {
    const cls = this.wizardData.selectedClass
    if (!cls?.system.gearTable) return null

    const table = await fromUuid(cls.system.gearTable)
    if (!table) return null

    const roll = await table.roll()
    return roll.results
  }

  #calculateSpentMoney() {
    return this.wizardData.equipment.reduce((total, item) => {
      return total + item.value * item.quantity
    }, 0)
  }

  static async #onAddToCart(event) {
    const { uuid } = event.target.closest("[data-uuid]").dataset
    const item = await fromUuid(uuid)
    const quantity = Number(event.target.previousElementSibling.value || 1)

    this.wizardData.equipment.push({
      uuid,
      name: item.name,
      img: item.img,
      quantity,
      cost: (item.system.value || 1) * quantity,
    })

    this.#wizardManager.setStepValidity("equipment", true)
    this.render()
  }

  static async #onRemoveFromCart(event) {
    const { index } = event.target.closest("[data-index]").dataset
    this.wizardData.equipment.splice(index, 1)

    this.#wizardManager.setStepValidity(
      "equipment",
      this.wizardData.equipment.length > 0 || this.wizardData.skipEquipment,
    )
    this.render()
  }

  static async #onConfirmEquipment() {
    // const method = game.settings.get(
    //   SYSTEM_NAME,
    //   "characterCreationStartingGear",
    // )

    const method = ""

    if (method === "table") {
      // Add items from table roll
      const results = await this.#rollStartingGear()
      if (!results?.length) return

      await createItemsFromUUIDs(
        results.map((r) => r.documentUuid),
        this.actor,
      )
    } else {
      // Add purchased items and remaining currency
      if (this.wizardData.equipment.length) {
        const itemUuids = this.wizardData.equipment.map((e) => e.uuid)
        await createItemsFromUUIDs(itemUuids, this.actor, (data, source) => {
          const entry = this.wizardData.equipment.find(
            (e) => e.uuid === source.uuid,
          )
          if (entry) {
            data.system.quantity = entry.quantity
          }
          return data
        })
      }

      // Add currency items based on remaining money
      const { CURRENCY_GOLD, CURRENCY_SILVER, CURRENCY_COPPER } =
        CONFIG.BAGS.ITEM_UUIDS

      const remaining = this.#calculateRemainingMoney()
      // const totalInCopper = Math.floor(remaining * 100) // Convert to copper pieces
      // const gold = Math.floor(totalInCopper / 100)
      // const silver = Math.floor((totalInCopper % 100) / 10)
      // const copper = totalInCopper % 10

      if (remaining > 0) {
        const gold = Math.floor(remaining)
        const silver = Math.floor((remaining - gold) * 10)
        const copper = Math.floor(((remaining - gold) * 10 - silver) * 10)

        const currency = []
        if (gold > 0) currency.push({ uuid: CURRENCY_GOLD, quantity: gold })
        if (silver > 0)
          currency.push({ uuid: CURRENCY_SILVER, quantity: silver })
        if (copper > 0)
          currency.push({ uuid: CURRENCY_COPPER, quantity: copper })

        await createItemsFromUUIDs(
          currency.map((c) => c.uuid),
          this.actor,
          (data, source) => {
            const entry = currency.find((c) => c.uuid === source.uuid)
            if (entry) {
              data.system.quantity = entry.quantity
            }
            return data
          },
        )
      }
    }

    this.#wizardManager.moveToNext()
    this.render()
  }

  async #prepareShoppingData() {
    // Roll starting gold if we haven't yet
    if (!this.wizardData.startingGold) {
      const formula = game.settings.get(
        SYSTEM_NAME,
        "characterCreationStartingGold",
      )
      const roll = await new Roll(formula).evaluate({ async: true })
      this.wizardData.startingGold = roll.total
    }

    // Get available items
    const sources =
      game.settings.get(SYSTEM_NAME, "characterCreationSources")?.equipment ||
      []
    let items = await getItemsFromSources(sources, {
      type: ["weapon", "armor", "gear", "container"],
    })

    // Apply filters
    items = this.#filterEquipmentItems(items)

    const remaining = this.#calculateRemainingMoney()

    return {
      startingGold: this.wizardData.startingGold,
      remainingGold: remaining,
      availableItems: items,
      cart: this.wizardData.equipment,
      filters: {
        options: CharacterCreationWizard.#EQUIPMENT_FILTERS,
        current: this.wizardData.equipmentFilters,
      },
    }
  }

  #calculateRemainingMoney() {
    return this.wizardData.startingGold - this.#calculateSpentMoney()
  }

  #filterEquipmentItems(items) {
    const { search, types, sort } = this.wizardData.equipmentFilters

    // Filter by type and search
    let filtered = items.filter((item) => {
      const matchesType = types.includes(item.type)
      const matchesSearch =
        !search || item.name.toLowerCase().includes(search.toLowerCase())
      return matchesType && matchesSearch
    })

    // Sort items
    filtered.sort((a, b) => {
      switch (sort) {
        case "nameAsc":
          return a.name.localeCompare(b.name)
        case "nameDesc":
          return b.name.localeCompare(a.name)
        case "costAsc":
          return a.system.value - b.system.value
        case "costDesc":
          return b.system.value - a.system.value
        default:
          return 0
      }
    })

    return filtered
  }

  static #onUpdateEquipmentSearch(event) {
    this.wizardData.equipmentFilters.search = event.target.value
    this.render()
  }

  static #onToggleEquipmentType(event) {
    const type = event.target.value
    const types = this.wizardData.equipmentFilters.types

    if (event.target.checked) {
      if (!types.includes(type)) types.push(type)
    } else {
      const index = types.indexOf(type)
      if (index > -1) types.splice(index, 1)
    }

    this.render()
  }

  static #onChangeEquipmentSort(event) {
    this.wizardData.equipmentFilters.sort = event.target.value
    this.render()
  }

  #resetEquipmentFilters() {
    this.wizardData.equipmentFilters = {
      search: "",
      types: Object.keys(CharacterCreationWizard.#EQUIPMENT_FILTERS.types),
      sort: "nameAsc",
    }
  }
}
