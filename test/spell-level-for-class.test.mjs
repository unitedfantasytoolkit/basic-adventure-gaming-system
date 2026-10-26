/**
 * @file Tests for working out what level a spell is on a class's list.
 *
 * The property that matters: a spell no class lists behaves exactly as it did
 * before class lists existed, falling back to the level printed on the spell.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  spellLevelInList,
  spellLevelForClass,
  spellLevelForClasses,
} from "../src/utils/spell-level-for-class.mjs"

// === Test Helpers ============================================================

const SLEEP = "Compendium.spells.Item.sleep"
const FIREBALL = "Compendium.spells.Item.fireball"

/**
 * Build a spell-shaped object.
 * @param {string} uuid - The spell's UUID
 * @param {number} level - The level printed on the spell
 * @returns {object} A spell-shaped object
 */
function spell(uuid, level = 1) {
  return { uuid, system: { level } }
}

/**
 * Build a class-shaped object.
 * @param {Array} spellList - The class's spell list entries
 * @returns {object} A class-shaped object
 */
function classItem(spellList = []) {
  return { system: { spellList } }
}

// === spellLevelInList ========================================================

test("falls back to the spell's own level for an empty list", () => {
  assert.is(spellLevelInList([], SLEEP, 3), 3)
})

test("uses the level the list gives the spell", () => {
  const list = [{ uuid: SLEEP, level: 2 }]

  assert.is(spellLevelInList(list, SLEEP, 1), 2)
})

test("falls back for a spell the list doesn't mention", () => {
  const list = [{ uuid: SLEEP, level: 2 }]

  assert.is(spellLevelInList(list, FIREBALL, 3), 3)
})

test("treats a listing with no level as a link, not an override", () => {
  const list = [{ uuid: SLEEP, level: 0 }]

  assert.is(spellLevelInList(list, SLEEP, 5), 5)
})

test("falls back to level 1 when nothing says otherwise", () => {
  assert.is(spellLevelInList([], SLEEP, undefined), 1)
  assert.is(spellLevelInList(undefined, SLEEP, undefined), 1)
})

// === spellLevelForClass ======================================================

test("reads the level off the class's list", () => {
  const elf = classItem([{ uuid: SLEEP, level: 3 }])

  assert.is(spellLevelForClass(elf, spell(SLEEP, 1)), 3)
})

test("falls back to the spell's level for a class with no list", () => {
  assert.is(spellLevelForClass(classItem(), spell(SLEEP, 2)), 2)
})

test("survives a missing class", () => {
  assert.is(spellLevelForClass(undefined, spell(SLEEP, 4)), 4)
})

// === spellLevelForClasses ====================================================

test("takes the lowest level across a character's classes", () => {
  const magicUser = classItem([{ uuid: SLEEP, level: 3 }])
  const elf = classItem([{ uuid: SLEEP, level: 1 }])

  assert.is(spellLevelForClasses([magicUser, elf], spell(SLEEP, 9)), 1)
})

test("ignores classes that don't list the spell", () => {
  const magicUser = classItem([{ uuid: SLEEP, level: 1 }])
  const cleric = classItem([{ uuid: FIREBALL, level: 2 }])

  // The cleric contributes the spell's own level of 4, the magic-user 1.
  assert.is(spellLevelForClasses([magicUser, cleric], spell(SLEEP, 4)), 1)
})

test("falls back to the spell's own level for a classless character", () => {
  assert.is(spellLevelForClasses([], spell(SLEEP, 4)), 4)
  assert.is(spellLevelForClasses(undefined, spell(SLEEP, 4)), 4)
})

test("falls back when no class lists the spell", () => {
  const cleric = classItem([{ uuid: FIREBALL, level: 2 }])

  assert.is(spellLevelForClasses([cleric], spell(SLEEP, 2)), 2)
})

test.run()
