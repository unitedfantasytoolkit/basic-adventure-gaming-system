/**
 * @file Keeps the harvested school and sphere suggestions honest.
 *
 * The vocabulary is cached because reading compendiums on every editor render
 * would be miserable. That leaves the cache to be dropped whenever something
 * could have changed what's on offer: a spell gaining a school, the configured
 * sources changing, or the world switching to a rules module with a different
 * seed list.
 */

import { invalidateSpellVocabulary } from "../utils/spell-vocabulary.mjs"

/**
 * Drop the cache when a spell Item is created, changed, or deleted.
 * @param {Item} item - The Item that changed
 */
const invalidateForSpell = (item) => {
  if (item?.type === "spell") invalidateSpellVocabulary()
}

Hooks.on("createItem", invalidateForSpell)
Hooks.on("updateItem", invalidateForSpell)
Hooks.on("deleteItem", invalidateForSpell)

Hooks.on("BAGS.SystemChange", (category) => {
  if (category === CONFIG.BAGS?.SystemRegistry?.categories?.SPELLS) {
    invalidateSpellVocabulary()
  }
})

// Character creation sources are where the harvest looks beyond the world, so
// changing them changes the answer.
Hooks.on("closeCharacterCreationSourcesConfig", () => {
  invalidateSpellVocabulary()
})
