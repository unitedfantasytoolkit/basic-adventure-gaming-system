/**
 * @file The schools and spheres this world knows about.
 *
 * Two things feed the list. The world's rules module seeds it, so a fresh 2nd
 * Edition game offers the eight schools before anybody has made a spell. And
 * the spells actually in play are harvested, so a referee who invents a Cosmic
 * school for weird space business gets it back as a suggestion everywhere,
 * without forking a rules module.
 *
 * Neither list constrains anything. The editor offers them as suggestions and
 * takes whatever gets typed.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"
import { getSeedVocabulary } from "../config/spell-rules.mjs"
import getItemsFromSources from "../common/get-items-from-sources.mjs"

/**
 * @typedef SpellVocabulary
 * @property {string[]} schools - Known school names, sorted
 * @property {string[]} spheres - Known sphere names, sorted
 */

/**
 * The last harvest, kept because reading compendiums is slow and the editor
 * asks on every render.
 * @type {SpellVocabulary|null}
 */
let cached = null

/**
 * Forget the harvested vocabulary, so the next read rebuilds it.
 *
 * Called when a spell changes, when the configured sources change, and when the
 * world switches rules module -- any of which can change what's on offer.
 */
export function invalidateSpellVocabulary() {
  cached = null
}

/**
 * Tidy one entry without trying to be clever.
 *
 * Published spell lists disagree with themselves -- "Enchantment/Charm" and
 * "Enchantment" both turn up in the same corpus -- and guessing which of those
 * a referee meant would do more harm than leaving both on the list.
 * @param {string} value - A raw school or sphere name
 * @returns {string} The tidied name
 */
function normalize(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Collect the distinct schools and spheres used by a set of spells.
 * @param {Item[]} spells - The spells to read
 * @returns {{schools: Set<string>, spheres: Set<string>}} What they use
 */
function harvestFrom(spells) {
  const schools = new Set()
  const spheres = new Set()

  spells.forEach((spell) => {
    ;(spell.system?.schools || []).forEach((school) => {
      const tidied = normalize(school)
      if (tidied) schools.add(tidied)
    })
    ;(spell.system?.spheres || []).forEach((sphere) => {
      const tidied = normalize(sphere)
      if (tidied) spheres.add(tidied)
    })
  })

  return { schools, spheres }
}

/**
 * Every school and sphere this world knows about.
 *
 * Reads the world's own spells plus whatever compendiums are configured as
 * character creation sources -- the same places a referee already told the
 * system to look for content.
 * @returns {Promise<SpellVocabulary>} The suggestions to offer
 */
export async function getSpellVocabulary() {
  if (cached) return cached

  const seed = getSeedVocabulary()

  const schools = new Set(seed.schools.map(normalize).filter(Boolean))
  const spheres = new Set(seed.spheres.map(normalize).filter(Boolean))

  const worldSpells = game.items?.filter((item) => item.type === "spell") || []
  const fromWorld = harvestFrom(worldSpells)
  fromWorld.schools.forEach((school) => schools.add(school))
  fromWorld.spheres.forEach((sphere) => spheres.add(sphere))

  try {
    const sources =
      game.settings.get(SYSTEM_NAME, "characterCreationSources")?.spells || []

    if (sources.length) {
      const sourceSpells = await getItemsFromSources(sources, {
        type: "spell",
        sort: false,
      })
      const fromSources = harvestFrom(sourceSpells)
      fromSources.schools.forEach((school) => schools.add(school))
      fromSources.spheres.forEach((sphere) => spheres.add(sphere))
    }
  } catch (error) {
    // A world with no sources configured, or one whose settings aren't
    // registered yet, still deserves the seed and its own spells.
    console.warn(
      "BAGS | Could not harvest spell vocabulary from sources",
      error,
    )
  }

  cached = {
    schools: Array.from(schools).sort((a, b) => a.localeCompare(b)),
    spheres: Array.from(spheres).sort((a, b) => a.localeCompare(b)),
  }

  return cached
}
