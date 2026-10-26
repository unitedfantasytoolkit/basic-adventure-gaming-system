/**
 * @file The vocabulary the spell rules modules speak.
 *
 * A ruleset decides which parts of a spell entry its world cares about by
 * listing them in `entryFields`. B/X lists two; the Advanced games list most of
 * them. Anything not listed is still stored on the spell -- a spell imported
 * from a 2nd Edition compendium keeps its casting time in a Basic world -- it
 * simply isn't shown or offered for editing.
 */

/**
 * The parts of a printed spell entry a ruleset can turn on.
 *
 * These match the field names under `system.entry` on a spell, except for
 * `schools` and `spheres`, which sit beside the entry because they classify the
 * spell rather than describe how it is cast.
 * @readonly
 * @enum {string}
 */
export const SPELL_ENTRY_FIELDS = {
  RANGE: "range",
  DURATION: "duration",
  CASTING_TIME: "castingTime",
  AREA_OF_EFFECT: "areaOfEffect",
  SAVING_THROW: "savingThrow",
  COMPONENTS: "components",
  SCHOOLS: "schools",
  SPHERES: "spheres",
}

/**
 * How a caster comes by the spells they can cast.
 *
 * This decides what adding a spell looks like, not where spells are stored --
 * a caster's spells are always Items on their Actor either way.
 * @readonly
 * @enum {string}
 */
export const SPELL_ACCESS = {
  /**
   * The caster has every spell their class list offers, the way a cleric prays
   * for whatever they need. Spells arrive in bulk as levels unlock.
   */
  FULL: "full",

  /**
   * The caster knows a personal subset, the way a magic-user keeps a spellbook.
   * Spells are added one at a time and may have to be learned.
   */
  REPERTOIRE: "repertoire",
}

/**
 * The entry fields every Advanced game prints. Both Advanced rules modules
 * share these; they differ in how they classify spells, not in what the entry
 * says.
 * @type {string[]}
 */
export const ADVANCED_ENTRY_FIELDS = [
  SPELL_ENTRY_FIELDS.RANGE,
  SPELL_ENTRY_FIELDS.DURATION,
  SPELL_ENTRY_FIELDS.CASTING_TIME,
  SPELL_ENTRY_FIELDS.AREA_OF_EFFECT,
  SPELL_ENTRY_FIELDS.SAVING_THROW,
  SPELL_ENTRY_FIELDS.COMPONENTS,
  SPELL_ENTRY_FIELDS.SCHOOLS,
]
