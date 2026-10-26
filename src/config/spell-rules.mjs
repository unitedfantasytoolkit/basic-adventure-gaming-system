/**
 * @file Reads the world's chosen spell rules module.
 *
 * Everything that needs to know what a spell entry looks like in this world --
 * the sheet, the editor, the spell manager -- comes through here, so there's
 * one place that copes with a world whose rules module has gone missing.
 */

import { SPELL_ACCESS } from "./spell-fields.mjs"

/**
 * The rules module a world falls back to when the registry can't answer.
 *
 * A world mid-`init`, or one whose chosen module came from a module that's no
 * longer enabled, still has to render sheets. Answering with the Basic shape
 * beats throwing.
 * @type {object}
 */
const FALLBACK_RULES = {
  id: "basic",
  entryFields: ["range", "duration"],
  schools: [],
  spheres: [],
  traditions: [],
}

/**
 * The world's selected spell rules module.
 * @returns {object} The rules module, or a Basic-shaped fallback
 */
export function getSpellRules() {
  const registry = CONFIG.BAGS?.SystemRegistry
  if (!registry) return FALLBACK_RULES

  return (
    registry.getSelectedOfCategory(registry.categories.SPELLS) || FALLBACK_RULES
  )
}

/**
 * Every tradition the current rules module offers.
 * @returns {object[]} The traditions, empty if the module defines none
 */
export function getTraditions() {
  return getSpellRules().traditions || []
}

/**
 * Look up one tradition by id.
 * @param {string} traditionId - The tradition's id, such as "arcane"
 * @returns {object|null} The tradition, or null if this ruleset has no such one
 */
export function getTradition(traditionId) {
  if (!traditionId) return null
  return (
    getTraditions().find((tradition) => tradition.id === traditionId) || null
  )
}

/**
 * Which parts of a spell entry this world shows, for a spell of a given
 * tradition.
 *
 * The ruleset lists what every spell prints; a tradition adds whatever else its
 * casters care about. Second Edition puts schools on everything and spheres
 * only on the divine list, and this is how that arrives.
 * @param {string} [traditionId] - The spell's tradition
 * @returns {Set<string>} The field names to show
 */
export function getEntryFields(traditionId) {
  const rules = getSpellRules()
  const tradition = getTradition(traditionId)

  return new Set([
    ...(rules.entryFields || []),
    ...(tradition?.entryFields || []),
  ])
}

/**
 * Whether one part of the spell entry is shown in this world.
 * @param {string} field - A field name from `SPELL_ENTRY_FIELDS`
 * @param {string} [traditionId] - The spell's tradition
 * @returns {boolean} True when the field should be shown and offered for edit
 */
export function isEntryFieldEnabled(field, traditionId) {
  return getEntryFields(traditionId).has(field)
}

/**
 * How a class comes by its spells.
 *
 * A class may say for itself -- a homebrew priest who keeps a book is allowed
 * to exist -- and otherwise inherits the habit of the tradition it practises.
 * @param {Item} classItem - The class Item
 * @returns {string} One of `SPELL_ACCESS`
 */
export function getSpellAccess(classItem) {
  const declared = classItem?.system?.spellAccess
  if (declared) return declared

  const tradition = getTradition(classItem?.system?.traditionId)

  return tradition?.access || SPELL_ACCESS.REPERTOIRE
}

/**
 * The seed vocabularies this ruleset ships, before anything is harvested from
 * the spells actually in play.
 * @returns {{schools: string[], spheres: string[]}} The seed lists
 */
export function getSeedVocabulary() {
  const rules = getSpellRules()
  return {
    schools: rules.schools || [],
    spheres: rules.spheres || [],
  }
}
