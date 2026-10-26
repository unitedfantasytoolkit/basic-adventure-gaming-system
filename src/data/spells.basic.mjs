/**
 * @file The Basic game's spell rules, covering Basic/Expert, BECMI, and the
 * Rules Cyclopedia.
 *
 * These games print two things about a spell -- how far it reaches and how long
 * it lasts -- and classify spells not at all. There are two traditions: arcane
 * casters keep a spellbook, and divine casters pray for whatever they need from
 * the whole list.
 */

import { SPELL_ACCESS, SPELL_ENTRY_FIELDS } from "../config/spell-fields.mjs"
import { hasSlotsAtLevel } from "../utils/spell-learning.mjs"
import { spellLevelForClass } from "../utils/spell-level-for-class.mjs"

/**
 * Whether a caster is far enough along to take on a spell of this level.
 *
 * Basic asks only this much: a first level magic-user can learn first level
 * spells and nothing more, because that's all their class grants slots for.
 * @param {Actor} actor - The would-be caster
 * @param {Item} spell - The spell being learned
 * @param {object} options - Lookup options
 * @param {Item} options.classItem - The class learning the spell
 * @returns {{allowed: boolean, reason?: string}} Whether it may be learned
 */
export function canLearnBasic(actor, spell, { classItem } = {}) {
  if (!classItem) {
    return { allowed: false, reason: "BAGS.Items.Spells.Learning.NoClass" }
  }

  const level = spellLevelForClass(classItem, spell)
  const slots = classItem.system?.currentLevelDetails?.spellSlots

  if (!hasSlotsAtLevel(slots, level)) {
    return { allowed: false, reason: "BAGS.Items.Spells.Learning.LevelTooHigh" }
  }

  return { allowed: true }
}

/**
 * Learn the spell.
 *
 * Basic has no roll to make: a magic-user who finds a spell they can cast
 * copies it, and a cleric never had to learn one in the first place.
 * @returns {Promise<{learned: boolean}>} Always learned
 */
export async function attemptToLearnBasic() {
  return { learned: true }
}

/**
 * The Basic rules module.
 * @type {object}
 */
const basicSpells = {
  id: "basic",
  name: "BAGS.Systems.Spells.Basic.Name",
  default: true,

  entryFields: [SPELL_ENTRY_FIELDS.RANGE, SPELL_ENTRY_FIELDS.DURATION],

  // Basic classifies spells not at all, so there is no vocabulary to seed.
  schools: [],
  spheres: [],

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
    },
  ],

  canLearn: canLearnBasic,
  attemptToLearn: attemptToLearnBasic,
}

export default basicSpells
