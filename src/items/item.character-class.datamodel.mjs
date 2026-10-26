/**
 * @file Data model for a character's class.
 */
import filterFalsyKeyVals from "../utils/filter-falsy-key-vals.mjs"
import mapToNumberField from "../utils/map-to-number-field.mjs"
import BaseItemDataModel from "./item.datamodel.mjs"
import { actionsFactory } from "../common/action.fields.mjs"
import { SPELL_ACCESS } from "../config/spell-fields.mjs"
import { getSpellAccess } from "../config/spell-rules.mjs"

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

      /**
       * A dice formula for this class's starting money, such as "5d4 * 10".
       *
       * B/X uses one formula for every character, which lives in the
       * `characterCreationStartingGold` world setting. Later games like AD&D
       * give each class its own roll, so a formula set here takes precedence
       * over the world setting. Leave it blank to use the world setting.
       */
      startingGold: new StringField({
        required: false,
        blank: true,
        initial: "",
      }),

      features: new ArrayField(new DocumentUUIDField({ type: "Item" })),

      /**
       * The spells this class can learn, and what level each one is on its
       * list.
       *
       * The list lives here rather than on the spells because spells usually
       * come from a compendium that can't be edited. A referee building a class
       * needs to be able to say "this spell is on my list" without touching
       * somebody else's content.
       *
       * Rulesets that don't do class lists at all -- 2nd Edition sorts spells
       * into wizard and priest and stops there -- leave this empty and let the
       * spell's own tradition decide.
       */
      spellList: new ArrayField(
        new SchemaField({
          uuid: new DocumentUUIDField({
            type: "Item",
            label: "BAGS.CharacterClass.SpellList.Spell.Label",
          }),
          level: new NumberField({
            min: 0,
            initial: 1,
            label: "BAGS.CharacterClass.SpellList.Level.Label",
            hint: "BAGS.CharacterClass.SpellList.Level.Hint",
          }),
        }),
        { initial: [] },
      ),

      /**
       * Which magical tradition this class practises, chosen from the world's
       * spell rules module.
       */
      traditionId: new StringField({
        required: false,
        blank: true,
        label: "BAGS.CharacterClass.Spellcasting.Tradition.Label",
        hint: "BAGS.CharacterClass.Spellcasting.Tradition.Hint",
      }),

      /**
       * How this class comes by its spells, overriding the habit of its
       * tradition. Left blank, a class does whatever its tradition does --
       * which is what all but the odd homebrew wants.
       */
      spellAccess: new StringField({
        required: false,
        blank: true,
        choices: {
          "": "BAGS.CharacterClass.Spellcasting.Access.FromTradition",
          [SPELL_ACCESS.FULL]: "BAGS.CharacterClass.Spellcasting.Access.Full",
          [SPELL_ACCESS.REPERTOIRE]:
            "BAGS.CharacterClass.Spellcasting.Access.Repertoire",
        },
        label: "BAGS.CharacterClass.Spellcasting.Access.Label",
        hint: "BAGS.CharacterClass.Spellcasting.Access.Hint",
      }),

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

      actions: actionsFactory(),

      // --- Advancement -------------------------------------------------------
      xp: new NumberField({
        min: 0,
        initial: 0,
      }),

      xpTable: new ArrayField(
        new SchemaField({
          value: new NumberField({ min: 0, initial: 0 }),

          // TODO: This and THAC0 could be combined into an attack roll offset
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

      xpLog: new ArrayField(
        new SchemaField({
          date: new NumberField({ integer: true }),
          xpChange: new NumberField(),
          levelChange: new NumberField(),
          note: new HTMLField(),
        }),
        { initial: [] },
      ),

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
   * The spells on this class's list, grouped by the level they sit at *on this
   * list* -- which isn't always the level printed on the spell.
   *
   * Spells usually live in a compendium, so this has to resolve UUIDs and is
   * asynchronous. Entries whose spell has gone away are skipped rather than
   * left as holes.
   * @returns {Promise<Item[][]>} Spells by level, index 0 being level 1
   */
  async getSpellItems() {
    const resolved = await Promise.all(
      this.spellList.map(async (entry) => ({
        level: entry.level || 1,
        spell: await fromUuid(entry.uuid),
      })),
    )

    const found = resolved.filter(({ spell }) => !!spell)
    if (!found.length) return []

    const highestLevel = found.reduce(
      (highest, { level }) => (level > highest ? level : highest),
      0,
    )

    const byLevel = new Array(highestLevel).fill(null).map(() => [])

    found.forEach(({ level, spell }) => {
      byLevel[level - 1].push(spell)
    })

    return byLevel
  }

  /**
   * Every spell UUID on this class's list.
   * @returns {string[]} The UUIDs
   */
  get spellUUIDs() {
    return this.spellList.map((entry) => entry.uuid).filter(Boolean)
  }

  /**
   * How this class comes by its spells, resolved against its tradition.
   * @returns {string} One of `SPELL_ACCESS`
   */
  get resolvedSpellAccess() {
    return getSpellAccess(this.parent)
  }

  get hasPrerequisites() {
    return !!Object.keys(this.prerequisitesFormatted).length
  }

  get prerequisitesFormatted() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )
    const abilityScores = abilityScoreSettings?.abilityScores || new Map()

    const formatted = {}
    for (const [key, value] of Object.entries(this.prerequisites)) {
      if (value > 0) {
        const config = abilityScores.get(key)
        formatted[key] = {
          label: config?.label || key,
          value,
        }
      }
    }
    return formatted
  }

  get prerequsiitesCount() {
    return Object.keys(this.prerequisitesFormatted).length
  }

  get halfRequisitesFormatted() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )
    const abilityScores = abilityScoreSettings?.abilityScores || new Map()

    const formatted = {}
    for (const [key, value] of Object.entries(this.halfPrimeRequisites)) {
      if (key !== "isAnd" && value > 0) {
        const config = abilityScores.get(key)
        formatted[key] = {
          label: config?.label || key,
          value,
        }
      }
    }
    return formatted
  }

  get halfRequisitesCount() {
    return Object.keys(this.halfRequisitesFormatted).length
  }

  get fullRequisitesFormatted() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )
    const abilityScores = abilityScoreSettings?.abilityScores || new Map()

    const formatted = {}
    for (const [key, value] of Object.entries(this.fullPrimeRequisites)) {
      if (key !== "isAnd" && value > 0) {
        const config = abilityScores.get(key)
        formatted[key] = {
          label: config?.label || key,
          value,
        }
      }
    }
    return formatted
  }

  get fullRequisitesCount() {
    return Object.keys(this.fullRequisitesFormatted).length
  }

  /**
   * Whether this class casts spells at all.
   *
   * A class with slots but no list still counts: rulesets that sort spells by
   * tradition rather than by class list -- 2nd Edition among them -- never fill
   * a list in, and a wizard with no `spellList` is still a wizard.
   * @returns {boolean} True when this class casts
   */
  get hasSpells() {
    if (this.spellUUIDs.some((uuid) => !!fromUuidSync(uuid))) return true

    return !!this.traditionId && this.spellSlots.length > 0
  }

  get level() {
    return this.manuallySetLevel
  }

  /**
   * The level this class's own actions are judged against.
   *
   * A class ability is gated on progress in *that class*, not on the character
   * overall -- a fighter 5 / thief 1 doesn't get the thief's 5th-level trick.
   * Every other kind of Item leaves this undefined and falls back to the actor.
   * @see {@link ../utils/action-availability.mjs}
   * @returns {number} This class's current level
   */
  get actionLevel() {
    return this.level
  }

  get maxLevel() {
    return this.xpTable.length || 1
  }

  /**
   * The experience this class's current level started at.
   *
   * The optional chaining is load-bearing. `manuallySetLevel` isn't bounded by
   * the length of `xpTable`, so a class whose table is shorter than its level --
   * a half-built homebrew, or a table that was trimmed after the fact -- indexes
   * past the end. Throwing from a getter takes the whole sheet down with it, and
   * a meter that starts at zero is a much smaller lie than a window that won't
   * open.
   * @returns {number} The threshold for the current level
   */
  get xpFromPrev() {
    if (!this.level) return 0

    return this.xpTable[this.level - 1]?.value ?? 0
  }

  get xpToNext() {
    if (this.level >= this.xpTable.length)
      return this.xpTable[this.xpTable.length - 1].value

    return this.xpTable[this.level].value
  }

  get xpRemaining() {
    return Math.max(0, this.xpToNext - this.xp)
  }

  get currentLevelData() {
    try {
      return this.xpTable[this.level]
    } catch {
      return null
    }
  }

  get canLevelUp() {
    if (this.level >= this.xpTable.length) return false
    return this.xp >= this.xpToNext
  }

  /**
   * @todo Handle "can't gain more XP than one less needed to earn two levels"
   */
  get canAddXP() {
    if (this.level >= this.xpTable.length) return false
    return true
  }

  get currentLevelDetails() {
    const currentLevelIndex = this.level - 1
    const {
      attackBonus,
      thac0,
      hd,
      saves: savingThrows,
    } = this.xpTable[currentLevelIndex]

    // Transpose spell slots from [spellLevel][characterLevel] to [characterLevel]
    const currentSpellSlots = this.spellSlots
      .map((spellLevelSlots) => spellLevelSlots[currentLevelIndex])
      .filter((slots) => slots != null)

    return {
      id: this.parent.id,
      name: this.parent.name,
      level: this.level,
      attackBonus,
      thac0,
      hd,
      xp: {
        current: this.xp,
        prev: this.xpFromPrev,
        next: this.xpToNext,
      },
      savingThrows,
      resources: this.leveledResources,
      spellSlots: currentSpellSlots,
    }
  }
}
