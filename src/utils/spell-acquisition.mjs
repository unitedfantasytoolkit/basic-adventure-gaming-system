/**
 * @file Adding spells to a caster.
 *
 * A caster's spells are always Items on their Actor, whatever ruleset is in
 * play. What changes is how they get there: a cleric receives their whole list
 * as levels unlock, while a magic-user adds them one at a time and may have to
 * roll to learn each one. The world's spell rules module owns the roll; this
 * file owns the copying.
 */

import { SPELL_ACCESS } from "../config/spell-fields.mjs"
import { getSpellAccess, getSpellRules } from "../config/spell-rules.mjs"
import { spellLevelForClass } from "./spell-level-for-class.mjs"

/**
 * The UUID a spell Item on an Actor was copied from.
 *
 * Foundry records this itself when a document is created from another, and it's
 * what lets a bulk add tell "already got this one" from "different spell with
 * the same name".
 * @param {Item} spell - A spell Item on an Actor
 * @returns {string|null} The source UUID, or null
 */
export function sourceUuidOf(spell) {
  return spell?._stats?.compendiumSource || spell?.flags?.core?.sourceId || null
}

/**
 * Whether an Actor already holds a given spell.
 *
 * Matches on where the spell came from, falling back to the name for spells
 * that were made by hand and so have no source.
 * @param {Actor} actor - The caster
 * @param {Item} spell - The spell being considered
 * @returns {boolean} True when the caster already has it
 */
export function actorHasSpell(actor, spell) {
  const owned = actor?.items?.documentsByType?.spell || []
  const sourceUuid = spell.uuid

  return owned.some(
    (existing) =>
      sourceUuidOf(existing) === sourceUuid || existing.name === spell.name,
  )
}

/**
 * Ask the world's rules whether this caster may take on this spell.
 * @param {Actor} actor - The caster
 * @param {Item} spell - The spell being learned
 * @param {Item} classItem - The class learning it
 * @returns {{allowed: boolean, reason?: string, data?: object}} The verdict
 */
export function canLearnSpell(actor, spell, classItem) {
  const rules = getSpellRules()

  if (typeof rules.canLearn !== "function") return { allowed: true }

  return rules.canLearn(actor, spell, {
    classItem,
    access: getSpellAccess(classItem),
  })
}

/**
 * Roll to learn a spell, if this world's rules make you roll for it.
 * @param {Actor} actor - The caster
 * @param {Item} spell - The spell being learned
 * @param {Item} classItem - The class learning it
 * @returns {Promise<{learned: boolean, roll?: object, chance?: number}>} How it
 * went
 */
export async function attemptToLearnSpell(actor, spell, classItem) {
  const rules = getSpellRules()

  if (typeof rules.attemptToLearn !== "function") return { learned: true }

  return rules.attemptToLearn(actor, spell, {
    classItem,
    access: getSpellAccess(classItem),
  })
}

/**
 * Copy spells onto an Actor, skipping any it already has.
 * @param {Actor} actor - The caster
 * @param {Item[]} spells - The spells to copy
 * @returns {Promise<Item[]>} The spell Items that were created
 */
export async function addSpellsToActor(actor, spells) {
  const wanted = spells.filter((spell) => spell && !actorHasSpell(actor, spell))

  if (!wanted.length) return []

  const created = await actor.createEmbeddedDocuments(
    "Item",
    wanted.map((spell) => spell.toObject()),
  )

  return created
}

/**
 * Every spell a class's list offers at a given level.
 * @param {Item} classItem - The class whose list to read
 * @param {number} level - The spell level wanted
 * @returns {Promise<Item[]>} The spells at that level, skipping any that have
 * gone away
 */
export async function spellsOnListAtLevel(classItem, level) {
  const listings = classItem?.system?.spellList || []

  const resolved = await Promise.all(
    listings
      .filter((entry) => (entry.level || 1) === level)
      .map((entry) => fromUuid(entry.uuid)),
  )

  return resolved.filter(Boolean)
}

/**
 * Give a caster every spell their class list offers at a level.
 *
 * This is what "full" access looks like in practice -- a cleric doesn't study,
 * they simply have the list -- so nothing is rolled and nothing is refused
 * beyond spells they already hold.
 * @param {Actor} actor - The caster
 * @param {Item} classItem - The class granting the spells
 * @param {number} level - The spell level to grant
 * @returns {Promise<Item[]>} The spell Items that were created
 */
export async function grantSpellsAtLevel(actor, classItem, level) {
  const spells = await spellsOnListAtLevel(classItem, level)
  return addSpellsToActor(actor, spells)
}

/**
 * Which spell levels a class can currently cast.
 * @param {Item} classItem - The class to ask
 * @returns {number[]} Spell levels, lowest first, empty for a non-caster
 */
export function castableSpellLevels(classItem) {
  const slots = classItem?.system?.currentLevelDetails?.spellSlots || []

  return slots
    .map((count, index) => (count > 0 ? index + 1 : null))
    .filter((level) => level !== null)
}

/**
 * Whether a class hands its whole list over rather than making a caster learn
 * spells one at a time.
 * @param {Item} classItem - The class to ask
 * @returns {boolean} True when the class grants its entire list
 */
export function grantsEntireList(classItem) {
  return getSpellAccess(classItem) === SPELL_ACCESS.FULL
}

/**
 * Add one spell to a caster, going through whatever the world's rules require.
 *
 * Returns what happened rather than throwing, because every outcome here --
 * refused, failed to learn, already known -- is something the interface wants
 * to say out loud rather than an error.
 * @param {Actor} actor - The caster
 * @param {Item} spell - The spell being added
 * @param {Item} classItem - The class learning it
 * @returns {Promise<{added: boolean, item?: Item, reason?: string,
 * roll?: object, chance?: number}>} What happened
 */
export async function learnSpell(actor, spell, classItem) {
  if (actorHasSpell(actor, spell)) {
    return { added: false, reason: "BAGS.Items.Spells.Learning.AlreadyKnown" }
  }

  const verdict = canLearnSpell(actor, spell, classItem)
  if (!verdict.allowed) {
    return { added: false, reason: verdict.reason }
  }

  const attempt = await attemptToLearnSpell(actor, spell, classItem)
  if (!attempt.learned) {
    return {
      added: false,
      reason: attempt.reason || "BAGS.Items.Spells.Learning.Failed",
      roll: attempt.roll,
      chance: attempt.chance,
    }
  }

  const [item] = await addSpellsToActor(actor, [spell])

  return { added: !!item, item, roll: attempt.roll, chance: attempt.chance }
}

/**
 * The level a spell would be learned at for a given class.
 * @param {Item} classItem - The class learning it
 * @param {Item} spell - The spell
 * @returns {number} The spell's level on that class's list
 */
export function learnedAtLevel(classItem, spell) {
  return spellLevelForClass(classItem, spell)
}
