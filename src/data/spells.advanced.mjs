/**
 * @file The Advanced games' spell rules, in both editions.
 *
 * The two editions print the same spell entry and differ in how they classify
 * what they print: 1st Edition names a spell's school, 2nd Edition adds spheres
 * of influence for divine casters on top. Both gate a magic-user's spellbook on
 * Intelligence, which is the interesting part and the reason these modules
 * carry behaviour rather than just data.
 */

import {
  ADVANCED_ENTRY_FIELDS,
  SPELL_ACCESS,
  SPELL_ENTRY_FIELDS,
} from "../config/spell-fields.mjs"
import {
  hasRoomToLearn,
  hasSlotsAtLevel,
  learningLimitsForScore,
} from "../utils/spell-learning.mjs"
import { spellLevelForClass } from "../utils/spell-level-for-class.mjs"
import arcaneLearningByIntelligence, {
  ARCANE_LEARNING_ABILITY,
} from "./spells.advanced-learning.mjs"
import rollDice from "../utils/roll-dice.mjs"

/**
 * The schools of magic 2nd Edition ships with.
 *
 * These seed the editor's suggestions; they don't constrain anything. A referee
 * who wants a Cosmic school types it and it joins the list.
 * @type {string[]}
 */
export const ADVANCED_SCHOOLS = [
  "Abjuration",
  "Alteration",
  "Conjuration/Summoning",
  "Divination",
  "Enchantment/Charm",
  "Illusion/Phantasm",
  "Invocation/Evocation",
  "Necromancy",
]

/**
 * The spheres of influence 2nd Edition grants priests.
 * @type {string[]}
 */
export const ADVANCED_SPHERES = [
  "All",
  "Animal",
  "Astral",
  "Charm",
  "Combat",
  "Creation",
  "Divination",
  "Elemental",
  "Guardian",
  "Healing",
  "Necromantic",
  "Plant",
  "Protection",
  "Summoning",
  "Sun",
  "Weather",
]

/**
 * Whether a caster may take on a spell.
 *
 * Divine casters receive their whole list and are only limited by what their
 * class can cast at all. Arcane casters are limited twice over: by that same
 * slot check, and by how many spells of a level their Intelligence lets them
 * keep in a spellbook.
 * @param {Actor} actor - The would-be caster
 * @param {Item} spell - The spell being learned
 * @param {object} options - Lookup options
 * @param {Item} options.classItem - The class learning the spell
 * @param {string} [options.access] - The resolved access mode for that class
 * @returns {{allowed: boolean, reason?: string, data?: object}} Whether it may
 * be learned, and the learning limits when they applied
 */
export function canLearnAdvanced(actor, spell, { classItem, access } = {}) {
  if (!classItem) {
    return { allowed: false, reason: "BAGS.Items.Spells.Learning.NoClass" }
  }

  const level = spellLevelForClass(classItem, spell)
  const slots = classItem.system?.currentLevelDetails?.spellSlots

  if (!hasSlotsAtLevel(slots, level)) {
    return { allowed: false, reason: "BAGS.Items.Spells.Learning.LevelTooHigh" }
  }

  // A caster who receives their whole list never had to qualify for any of it.
  if (access === SPELL_ACCESS.FULL) return { allowed: true }

  const score = actor?.system?.base?.abilityScores?.[ARCANE_LEARNING_ABILITY]
  const limits = learningLimitsForScore(arcaneLearningByIntelligence, score)

  if (!limits) {
    return {
      allowed: false,
      reason: "BAGS.Items.Spells.Learning.CannotLearnSpells",
    }
  }

  const known = (actor?.items?.documentsByType?.spell || []).filter(
    (known_) =>
      known_.id !== spell.id && spellLevelForClass(classItem, known_) === level,
  ).length

  if (!hasRoomToLearn(known, limits.maxPerLevel)) {
    return {
      allowed: false,
      reason: "BAGS.Items.Spells.Learning.TooManyKnown",
      data: limits,
    }
  }

  return { allowed: true, data: limits }
}

/**
 * Roll to learn the spell.
 *
 * Divine casters don't roll. An arcane caster rolls percentile dice against the
 * chance their Intelligence affords them, and a failure means this spell is
 * beyond them -- though nothing here records that, so the referee decides
 * whether they may try again.
 * @param {Actor} actor - The would-be caster
 * @param {Item} spell - The spell being learned
 * @param {object} options - Lookup options
 * @param {Item} options.classItem - The class learning the spell
 * @param {string} [options.access] - The resolved access mode for that class
 * @returns {Promise<{learned: boolean, roll?: Roll, chance?: number}>} How it
 * went
 */
export async function attemptToLearnAdvanced(actor, spell, { access } = {}) {
  if (access === SPELL_ACCESS.FULL) return { learned: true }

  const score = actor?.system?.base?.abilityScores?.[ARCANE_LEARNING_ABILITY]
  const limits = learningLimitsForScore(arcaneLearningByIntelligence, score)

  if (!limits) {
    return { learned: false, reason: "BAGS.Items.Spells.Learning.CannotLearn" }
  }

  const roll = await rollDice(actor, "1d100")

  return {
    learned: roll.total <= limits.chance,
    roll,
    chance: limits.chance,
  }
}

/**
 * Build a rules module for one of the Advanced editions.
 * @param {object} options - What sets this edition apart
 * @param {string} options.id - The module's id
 * @param {string} options.name - The module's display name
 * @param {boolean} [options.usesSpheres] - Whether divine casters use spheres
 * @returns {object} The rules module
 */
function buildAdvancedSpells({ id, name, usesSpheres = false }) {
  return {
    id,
    name,

    entryFields: [...ADVANCED_ENTRY_FIELDS],

    schools: [...ADVANCED_SCHOOLS],
    spheres: usesSpheres ? [...ADVANCED_SPHERES] : [],

    traditions: [
      {
        id: "arcane",
        label: "BAGS.Systems.Spells.Traditions.Arcane",
        access: SPELL_ACCESS.REPERTOIRE,
      },
      {
        id: "divine",
        label: "BAGS.Systems.Spells.Traditions.Divine",
        access: SPELL_ACCESS.FULL,
        // Spheres are the divine caster's classification, on top of the school
        // every Advanced spell already carries.
        entryFields: usesSpheres ? [SPELL_ENTRY_FIELDS.SPHERES] : [],
      },
    ],

    canLearn: canLearnAdvanced,
    attemptToLearn: attemptToLearnAdvanced,
  }
}

/**
 * Advanced 1st Edition: schools, and four class lists that the class items
 * themselves describe.
 * @type {object}
 */
export const advancedFirstEditionSpells = buildAdvancedSpells({
  id: "advanced-1e",
  name: "BAGS.Systems.Spells.Advanced1e.Name",
})

/**
 * Advanced 2nd Edition: schools for wizards, spheres for priests.
 * @type {object}
 */
export const advancedSecondEditionSpells = buildAdvancedSpells({
  id: "advanced-2e",
  name: "BAGS.Systems.Spells.Advanced2e.Name",
  usesSpheres: true,
})
