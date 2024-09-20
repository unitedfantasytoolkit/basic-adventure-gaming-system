import {
  ABILITY_SCORES,
  DEFAULT_BASE_THAC0,
  DEFAULT_CHARACTER_HIT_DIE_SIZE,
  HIT_DIE_OPTIONS,
  SAVING_THROWS,
  WORST_POSSIBLE_SAVE,
} from "../../config/constants.mjs";
import mapToNumberField from "../../utils/map-to-number-field.mjs";

const {
  StringField,
  ArrayField,
  NumberField,
  BooleanField,
  ObjectField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
  FilePathField,
} = foundry.data.fields;

export default class BAGSCharacterClassDataModel extends foundry.abstract
  .TypeDataModel {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      tabs: [{ navSelector: ".tabs", contentSelector: "form", initial: "xp" }],
    });
  }

  /**
   *
   */
  static defineSchema() {
    const prerequisiteFields = ABILITY_SCORES.entries().reduce(
      mapToNumberField,
      {},
    );
    const halfPrimeRequisiteFields = ABILITY_SCORES.entries().reduce(
      mapToNumberField,
      {},
    );
    const fullPrimeRequisiteFields = ABILITY_SCORES.entries().reduce(
      mapToNumberField,
      {},
    );
    const savingThrowFields = SAVING_THROWS.reduce(
      (obj, key) => ({
        ...obj,
        [key]: new NumberField({
          min: 0,
          nullable: false,
          blank: false,
          initial: WORST_POSSIBLE_SAVE,
        }),
      }),
      {},
    );
    const savingThrowDefaults = SAVING_THROWS.reduce(
      (obj, key) => ({
        ...obj,
        [key]: WORST_POSSIBLE_SAVE,
      }),
      {},
    );

    return {
      description: new HTMLField({
        required: false,
        blank: true,
      }),
      restrictions: new HTMLField({
        required: false,
        blank: true,
      }),
      banner: new FilePathField({
        required: false,
        categories: ["IMAGE"],
        initial: "https://placehold.co/600x400/274240/d6cbb3",
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
        min: HIT_DIE_OPTIONS[0],
        choices: HIT_DIE_OPTIONS,
        initial: DEFAULT_CHARACTER_HIT_DIE_SIZE,
        integer: true,
      }),

      gearTable: new DocumentUUIDField({
        type: "RollTable",
        required: false,
      }),

      features: new ArrayField(new DocumentUUIDField({ type: "Item" })),

      spellList: new ArrayField(new DocumentUUIDField({ type: "Item" })),

      xp: new NumberField({
        min: 0,
        initial: 0,
      }),

      xpTable: new ArrayField(
        new SchemaField({
          value: new NumberField({ min: 0, initial: 0 }),
          attackBonus: new NumberField({ min: 0, initial: 0 }),
          thac0: new NumberField({ min: 1, max: DEFAULT_BASE_THAC0 }),
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
              value: 2000,
              attackBonus: 0,
              thac0: 19,
              hd: { count: 1, modifier: 0, canUseConMod: true },
              saves: savingThrowDefaults,
            },
          ],
        },
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
        new SchemaField({
          // First level: the type of resource ("Spell Slots")
          level: new NumberField({ blank: false, min: 1, initial: 1 }),
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
    };
  }

  /**
   *  @returns {Promise[]} - An array of promises that make up the requested items
   */
  get featureItems() {
    return this.features.map((i) => fromUuidSync(i)).filter((i) => !!i);
  }

  get maxLevel() {
    return this.xp?.length || 0;
  }

  /**
   *  @todo Separate by spell level
   *
   * @returns {Promise[]} - An array of promises that make up the requested items
   */
  async getSpellItems() {
    const items = await Promise.all(this.spellList.map((i) => fromUuid(i)));
    const highestLevel = items.reduce((highest, i) => {
      return i?.system?.lvl > highest ? i?.system?.lvl : highest;
    }, 0);
    if (!highestLevel) return [];
    const list = new Array(highestLevel).fill(null).map(() => []);
    items.forEach((i) => {
      if (!i) return; // If the item doesn't exist, bail
      const idx = (i?.system?.lvl || 1) - 1;
      try {
        list[idx].push(i);
      } catch (e) {
        console.error(e);
        console.info(list, idx, i);
      }
    });

    return list;
  }

  static filterFalsyKeyVals(source) {
    return Object.keys(source)
      .filter((k) => !!source[k])
      .reduce(
        (obj, k) => ({
          ...obj,
          [k]: source[k],
        }),
        {},
      );
  }

  get hasPrerequisites() {
    return !!Object.keys(this.prerequisitesFormatted).length;
  }
  get prerequisitesFormatted() {
    return CharacterClassDataModel.filterFalsyKeyVals(this.prerequisites);
  }
  get prerequsiitesCount() {
    return Object.keys(this.preequisitesFormatted).length;
  }

  get halfRequisitesFormatted() {
    return CharacterClassDataModel.filterFalsyKeyVals(
      this.primerequisites.half,
    );
  }
  get halfRequisitesCount() {
    return Object.keys(this.halfRequisitesFormatted).length;
  }

  get fullRequisitesFormatted() {
    return CharacterClassDataModel.filterFalsyKeyVals(
      this.primerequisites.full,
    );
  }
  get fullRequisitesCount() {
    return Object.keys(this.fullRequisitesFormatted).length;
  }

  get hasSpells() {
    return !!this.spellList.map((i) => fromUuidSync(i)).filter((i) => !!i)
      .length;
  }
}
