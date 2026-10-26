/**
 * @file Works out what level a spell occupies on a class's spell list.
 *
 * The same spell can sit at different levels for different classes -- it might
 * be 1st level for a Magic-User and 2nd for an Elf. A class records that on its
 * own `spellList`, one entry per spell, and any spell the list doesn't mention
 * falls back to the level printed on the spell itself.
 *
 * The list lives on the class rather than the spell on purpose: spells often
 * arrive from a locked compendium, and a referee building a class needs to be
 * able to say "this spell is on my list" without editing somebody else's
 * content.
 */

/**
 * One entry on a class's spell list.
 * @typedef SpellListing
 * @property {string} uuid - UUID of the spell Item
 * @property {number} level - What level that spell is on this class's list
 */

/**
 * The level to assume when nothing says otherwise.
 * @type {number}
 */
const DEFAULT_SPELL_LEVEL = 1

/**
 * Find a spell's level on one list.
 *
 * A listing with no level of its own is a link to the spell, not an override
 * of its level, so it falls back the same way an absent listing does.
 * @param {SpellListing[]} spellList - The class's spell list
 * @param {string} spellUuid - UUID of the spell to look up
 * @param {number} [defaultLevel] - The spell's own level
 * @returns {number} The spell's level on that list
 */
export function spellLevelInList(spellList, spellUuid, defaultLevel) {
  const fallback = defaultLevel || DEFAULT_SPELL_LEVEL

  if (!Array.isArray(spellList) || !spellUuid) return fallback

  const listing = spellList.find((entry) => entry?.uuid === spellUuid)

  return listing?.level || fallback
}

/**
 * Find a spell's level for a particular class.
 * @param {Item} classItem - The class Item whose list to read
 * @param {Item} spell - The spell Item
 * @returns {number} The spell's level for that class
 */
export function spellLevelForClass(classItem, spell) {
  return spellLevelInList(
    classItem?.system?.spellList,
    spell?.uuid,
    spell?.system?.level,
  )
}

/**
 * Find a spell's level for a character who may have several classes.
 *
 * A multi-classed character gets the best of it: a spell that is 1st level for
 * one of their classes and 2nd for another is treated as 1st. Prepared spells
 * are tracked by level alone, without recording which class's slot paid for
 * them, so there is no later point at which a worse answer could be corrected.
 * @param {Item[]} classItems - Every class Item the character has
 * @param {Item} spell - The spell Item
 * @returns {number} The lowest level the spell occupies across those classes
 */
export function spellLevelForClasses(classItems, spell) {
  const fallback = spell?.system?.level || DEFAULT_SPELL_LEVEL

  if (!classItems?.length) return fallback

  const levels = classItems
    .map((classItem) => spellLevelForClass(classItem, spell))
    .filter((level) => Number.isFinite(level))

  return levels.length ? Math.min(...levels) : fallback
}
