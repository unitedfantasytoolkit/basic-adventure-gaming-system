/**
 * @file The data model for spell Items.
 *
 * A spell holds three separable things. Its **mechanics** -- level, tradition,
 * reversibility -- are edition-neutral and drive what the system does. Its
 * **entry** is the block a rulebook prints above the spell's text, which is
 * reference material for a referee to read and is never resolved by code; the
 * numbers that resolve live on the spell's actions. Its **classification** --
 * schools and spheres -- sits between the two, describing the spell rather than
 * how it's cast.
 *
 * Everything under `entry` is stored regardless of the world's rules module. A
 * spell imported from a 2nd Edition compendium keeps its casting time in a
 * Basic world; the world just doesn't show it.
 */
import { actionsFactory } from "../common/action.fields.mjs"
import BaseItemDataModel from "./item.datamodel.mjs"
import { getEntryFields, getTradition } from "../config/spell-rules.mjs"
import { SPELL_ENTRY_FIELDS } from "../config/spell-fields.mjs"
import { spellLevelForClass } from "../utils/spell-level-for-class.mjs"

const {
  ArrayField,
  BooleanField,
  DocumentUUIDField,
  NumberField,
  SchemaField,
  StringField,
} = foundry.data.fields

export default class BAGSSpellDataModel extends BaseItemDataModel {
  static LOCALIZATION_PREFIXES = ["BAGS.Items.Spells"]

  static defineSchema() {
    return {
      ...super.defineSchema(),

      // --- Mechanics ---------------------------------------------------------

      /**
       * The spell's level, used for any class whose list doesn't say otherwise.
       * A class's `spellList` is what overrides this.
       */
      level: new NumberField({
        min: 0,
        initial: 1,
        label: "BAGS.Items.Spells.Fields.Level.Label",
        hint: "BAGS.Items.Spells.Fields.Level.Hint",
      }),

      /**
       * Which magical tradition this spell belongs to -- arcane, divine, or
       * whatever else the world's rules module offers.
       *
       * For rulesets built around class lists this can be left empty and
       * inferred from the classes that list the spell. Second Edition content
       * has no class lists at all -- a spell is simply a wizard spell or a
       * priest spell -- so there it's the only thing that says where a spell
       * belongs.
       */
      traditionId: new StringField({
        required: false,
        blank: true,
        label: "BAGS.Items.Spells.Fields.Tradition.Label",
        hint: "BAGS.Items.Spells.Fields.Tradition.Hint",
      }),

      isReversible: new BooleanField({
        initial: false,
        label: "BAGS.Items.Spells.Fields.IsReversible.Label",
        hint: "BAGS.Items.Spells.Fields.IsReversible.Hint",
      }),

      /**
       * The spell this one reverses into. Pairs are usually set up from both
       * sides -- Light points at Darkness and Darkness back at Light -- but
       * nothing here requires that.
       */
      reversedSpellUUID: new DocumentUUIDField({
        type: "Item",
        label: "BAGS.Items.Spells.Fields.ReversedSpell.Label",
        hint: "BAGS.Items.Spells.Fields.ReversedSpell.Hint",
      }),

      // --- Classification ----------------------------------------------------
      // Free text, and deliberately not a fixed list. Published spells use
      // dozens of schools between them, and a referee who wants a Cosmic school
      // for weird space business shouldn't have to fork a rules module.

      schools: new ArrayField(new StringField(), {
        initial: [],
        label: "BAGS.Items.Spells.Fields.Schools.Label",
        hint: "BAGS.Items.Spells.Fields.Schools.Hint",
      }),

      spheres: new ArrayField(new StringField(), {
        initial: [],
        label: "BAGS.Items.Spells.Fields.Spheres.Label",
        hint: "BAGS.Items.Spells.Fields.Spheres.Hint",
      }),

      source: new StringField({
        label: "BAGS.Items.Spells.Fields.Source.Label",
        hint: "BAGS.Items.Spells.Fields.Source.Hint",
      }),

      // --- The printed entry -------------------------------------------------
      // Reference text, not mechanics. These are free text because real spell
      // entries say "1 rd./level", "Touch", and "Special", and because most of
      // them are formulas over caster level that no fixed number can hold.

      entry: new SchemaField({
        range: new StringField({
          label: "BAGS.Items.Spells.Fields.Range.Label",
          hint: "BAGS.Items.Spells.Fields.Range.Hint",
        }),
        duration: new StringField({
          label: "BAGS.Items.Spells.Fields.Duration.Label",
          hint: "BAGS.Items.Spells.Fields.Duration.Hint",
        }),
        castingTime: new StringField({
          label: "BAGS.Items.Spells.Fields.CastingTime.Label",
          hint: "BAGS.Items.Spells.Fields.CastingTime.Hint",
        }),
        areaOfEffect: new StringField({
          label: "BAGS.Items.Spells.Fields.AreaOfEffect.Label",
          hint: "BAGS.Items.Spells.Fields.AreaOfEffect.Hint",
        }),
        savingThrow: new StringField({
          label: "BAGS.Items.Spells.Fields.SavingThrow.Label",
          hint: "BAGS.Items.Spells.Fields.SavingThrow.Hint",
        }),
        components: new SchemaField({
          verbal: new BooleanField({
            initial: false,
            label: "BAGS.Items.Spells.Fields.Components.Verbal.Label",
            hint: "BAGS.Items.Spells.Fields.Components.Verbal.Hint",
          }),
          somatic: new BooleanField({
            initial: false,
            label: "BAGS.Items.Spells.Fields.Components.Somatic.Label",
            hint: "BAGS.Items.Spells.Fields.Components.Somatic.Hint",
          }),
          material: new BooleanField({
            initial: false,
            label: "BAGS.Items.Spells.Fields.Components.Material.Label",
            hint: "BAGS.Items.Spells.Fields.Components.Material.Hint",
          }),
        }),

        /**
         * What the material component actually is -- "a bit of sponge", and so
         * on. Only meaningful when `components.material` is set.
         */
        materials: new StringField({
          label: "BAGS.Items.Spells.Fields.Materials.Label",
          hint: "BAGS.Items.Spells.Fields.Materials.Hint",
        }),
      }),

      actions: actionsFactory(),
    }
  }

  // === Tradition =============================================================

  /**
   * The tradition this spell belongs to, as the world's rules module defines
   * it.
   *
   * A spell that doesn't name one falls back to the tradition of the first
   * class whose list carries it, which is how content written for class-list
   * rulesets gets a tradition without anybody typing one in.
   * @returns {object|null} The tradition, or null if none can be worked out
   */
  get tradition() {
    const declared = getTradition(this.traditionId)
    if (declared) return declared

    const [firstClass] = this.castingClasses

    return getTradition(firstClass?.system?.traditionId)
  }

  /**
   * Every class Item in the world whose spell list carries this spell.
   *
   * Classes name their spells rather than the other way round, so this is a
   * scan. It looks at world classes only -- "learned by" is a convenience on
   * the sheet, and reading every compendium to render one row isn't worth what
   * it costs.
   * @returns {Item[]} The class Items that list this spell
   */
  get castingClasses() {
    const { uuid } = this.parent || {}
    if (!uuid || !game.items) return []

    return game.items.filter(
      (item) =>
        item.type === "class" &&
        (item.system.spellList || []).some((entry) => entry?.uuid === uuid),
    )
  }

  /**
   * The first class that lists this spell, for the places that only have room
   * to show one.
   * @returns {Item|null} The class Item, or null
   */
  get castingClass() {
    return this.castingClasses[0] || null
  }

  /**
   * What level this spell is on a particular class's list.
   * @param {Item} classItem - The class Item to look it up on
   * @returns {number} The spell's level for that class
   */
  levelForClass(classItem) {
    return spellLevelForClass(classItem, this.parent)
  }

  // === Display ===============================================================

  /**
   * Which parts of this spell's entry the world shows, given its tradition.
   * @returns {Set<string>} The enabled field names
   */
  get enabledEntryFields() {
    return getEntryFields(this.tradition?.id)
  }

  /**
   * The components in the short form spell tables use -- "V, S, M".
   * @returns {string} The abbreviated component list, empty if there are none
   */
  get componentSummary() {
    const { verbal, somatic, material } = this.entry.components
    return [
      verbal ? game.i18n.localize("BAGS.Items.Spells.Components.Verbal") : null,
      somatic
        ? game.i18n.localize("BAGS.Items.Spells.Components.Somatic")
        : null,
      material
        ? game.i18n.localize("BAGS.Items.Spells.Components.Material")
        : null,
    ]
      .filter(Boolean)
      .join(", ")
  }

  /**
   * The spell this one reverses into, if it has one.
   * @returns {Item|null} The reversed spell's Item, or null
   */
  get reversedSpell() {
    if (!this.reversedSpellUUID) return null
    return fromUuidSync(this.reversedSpellUUID) || null
  }

  /**
   * Generate tooltip logistics HTML for spells, showing what this world shows.
   * @returns {string} HTML for the logistics section of the tooltip
   */
  get _tooltipLogisticsHTML() {
    const levelLabel = game.i18n.localize("BAGS.SpellManager.Level")
    const fields = this.enabledEntryFields
    const components = fields.has(SPELL_ENTRY_FIELDS.COMPONENTS)
      ? this.componentSummary
      : ""
    const range = fields.has(SPELL_ENTRY_FIELDS.RANGE) ? this.entry.range : ""

    return `
      <dl class="item-stats">
        <dt><i class="fas fa-layer-group" aria-label="${levelLabel}"></i></dt>
        <dd>${this.level}</dd>

        ${
          range
            ? `<dt><i class="fas fa-bullseye" aria-label="Range"></i></dt>
        <dd>${range}</dd>`
            : ""
        }

        ${
          components
            ? `<dt><i class="fas fa-hand-sparkles" aria-label="Components"></i></dt>
        <dd>${components}</dd>`
            : ""
        }
      </dl>
    `
  }
}
