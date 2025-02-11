/**
 * @file Data model for a character's class.
 */
import filterFalsyKeyVals from "../utils/filter-falsy-key-vals.mjs"
import mapToNumberField from "../utils/map-to-number-field.mjs"
import BaseItemDataModel from "./item.datamodel.mjs"

const {
  StringField,
  ArrayField,
  NumberField,
  BooleanField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
} = foundry.data.fields

export default class BAGSCharacterClassDataModel extends BaseItemDataModel {
  static LOCALIZATION_PREFIXES = ["BAGS.CharacterClass"]

  /**
   *
   */
  static defineSchema() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )

    const savingThrowSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
      )

    const combatSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.COMBAT,
    )

    const abilityScores = abilityScoreSettings?.abilityScores || new Map()
    const scores = abilityScores.keys()
    const saves = savingThrowSettings?.savingThrows || {}
    const worstPossibleSave = savingThrowSettings?.worstPossible || 19

    const scoreObjs = Array.from(abilityScores.entries())

    const prerequisiteFields = scoreObjs.reduce(mapToNumberField, {})
    const halfPrimeRequisiteFields = scoreObjs.reduce(mapToNumberField, {})
    const fullPrimeRequisiteFields = scoreObjs.reduce(mapToNumberField, {})
    const savingThrowFields = Object.keys(saves).reduce(
      (obj, key) => ({
        ...obj,
        [key]: new NumberField({
          min: 0,
          nullable: false,
          blank: false,
          initial: worstPossibleSave,
        }),
      }),
      {},
    )
    const savingThrowDefaults = Object.keys(saves).reduce(
      (obj, key) => ({
        ...obj,
        [key]: worstPossibleSave,
      }),
      {},
    )

    return {
      ...super.defineSchema(),
      restrictions: new HTMLField({
        required: false,
        blank: true,
      }),

      prerequisites: new SchemaField(prerequisiteFields),

      halfPrimeRequisites: new SchemaField({
        ...halfPrimeRequisiteFields,
        isAnd: new BooleanField({
          initial: true,
        }),
      }),

      fullPrimeRequisites: new SchemaField({
        ...fullPrimeRequisiteFields,
        isAnd: new BooleanField({
          initial: true,
        }),
      }),

      weapons: new StringField({
        blank: false,
        required: false,
      }),
      armor: new StringField({
        blank: false,
        required: false,
      }),
      languages: new StringField({
        blank: false,
        required: false,
      }),

      hitDieSize: new NumberField({
        min: 4,
        choices: [4, 6, 8, 10, 12].reduce(
          (obj, key) => ({
            ...obj,
            [key]: `d${key}`,
          }),
          [],
        ),
        initial: 4,
        integer: true,
      }),

      gearTable: new DocumentUUIDField({
        type: "RollTable",
        required: false,
      }),

      features: new ArrayField(new DocumentUUIDField({ type: "Item" })),

      spellList: new ArrayField(new DocumentUUIDField({ type: "Item" })),

      isAncestryClass: new BooleanField({
        initial: false,
      }),

      ancestryClassConstraints: new ArrayField(
        new SchemaField({
          ancestry: new DocumentUUIDField({
            type: "Item",
          }),
          level: new NumberField({
            initial: 10,
            min: 1,
          }),
        }),
      ),

      // --- Advancement -------------------------------------------------------
      xp: new NumberField({
        min: 0,
        initial: 0,
      }),

      xpTable: new ArrayField(
        new SchemaField({
          value: new NumberField({ min: 0, initial: 0 }),
          attackBonus: new NumberField({ min: 0, initial: 0 }),
          thac0: new NumberField({ min: 1, max: combatSettings?.baseTHAC0 }),
          hd: new SchemaField({
            count: new NumberField({ min: 1, initial: 1, integer: true }),
            modifier: new NumberField({ min: 0, initial: 0 }),
            canUseConMod: new BooleanField({ initial: true }),
          }),
          saves: new SchemaField(savingThrowFields),
        }),
        {
          initial: [
            {
              value: 0,
              attackBonus: 0,
              thac0: 19,
              hd: { count: 1, modifier: 0, canUseConMod: true },
              saves: savingThrowDefaults,
            },
          ],
        },
      ),

      manuallySetLevel: new NumberField({
        min: 1,
        initial: 1,
      }),

      // --- Leveled Resources -------------------------------------------------
      /**
       * Leveled resources are resources that
       * increase as a character increases their
       * level in this class, like thief skills.
       */
      leveledResources: new ArrayField(
        new SchemaField({
          // First level: the type of resource ("Spell Slots")
          label: new StringField({ blank: false }),
          pool: new ArrayField(
            new SchemaField({
              // Second level: a "tier" of this resource type ("Spell Slots" > "1st")
              label: new StringField({ blank: false }),
              perLevel: new ArrayField(
                // Third level: amount of this tier of resource at Index+1 level
                // (Magic User of level 1 has "Spell Slots" > "1st" > 1)
                new NumberField({ blank: true, nullable: true }),
              ),
            }),
          ),
        }),
      ),
      // --- Spell slots -------------------------------------------------------
      spellSlots: new ArrayField(
        new ArrayField(new NumberField({ blank: true, nullable: true })),
      ),
    }
  }

  /**
   * @returns {Promise[]} - An array of promises that make up the requested items
   */
  get featureItems() {
    return this.features.map((i) => fromUuidSync(i)).filter((i) => !!i)
  }

  /**
   *  @todo Separate by spell level
   * @returns {Promise[]} - An array of promises that make up the requested items
   */
  async getSpellItems() {
    const items = await Promise.all(this.spellList.map((i) => fromUuid(i)))
    const highestLevel = items.reduce(
      (highest, i) => (i?.system?.lvl > highest ? i?.system?.lvl : highest),
      0,
    )
    if (!highestLevel) return []
    const list = new Array(highestLevel).fill(null).map(() => [])
    items.forEach((i) => {
      if (!i) return // If the item doesn't exist, bail
      const idx = (i?.system?.lvl || 1) - 1
      try {
        list[idx].push(i)
      } catch (e) {
        console.error(e)
        console.info(list, idx, i)
      }
    })

    return list
  }

  get hasPrerequisites() {
    return !!Object.keys(this.prerequisitesFormatted).length
  }

  get prerequisitesFormatted() {
    return filterFalsyKeyVals(this.prerequisites)
  }

  get prerequsiitesCount() {
    return Object.keys(this.preequisitesFormatted).length
  }

  get halfRequisitesFormatted() {
    const reqs = filterFalsyKeyVals(this.halfPrimeRequisites)
    if (reqs.isAnd) delete reqs.isAnd
    return reqs
  }

  get halfRequisitesCount() {
    return Object.keys(this.halfRequisitesFormatted).length
  }

  get fullRequisitesFormatted() {
    const reqs = filterFalsyKeyVals(this.fullPrimeRequisites)
    if (reqs.isAnd) delete reqs.isAnd
    return reqs
  }

  get fullRequisitesCount() {
    return Object.keys(this.fullRequisitesFormatted).length
  }

  get hasSpells() {
    return !!this.spellList.map((i) => fromUuidSync(i)).filter((i) => !!i)
      .length
  }

  get level() {
    return this.manuallySetLevel
  }

  get maxLevel() {
    return this.xpTable.length || 1
  }

  get currentLevelDetails() {
    const currentLevelIndex = this.level - 1
    return {
      ...this.xpTable[currentLevelIndex],
      resources: this.leveledResources,
      spellSlots: this.spellSlots[currentLevelIndex],
    }
  }
}
