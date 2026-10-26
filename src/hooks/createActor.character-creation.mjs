/**
 * @file Hand newly created, blank characters to the character creation flow.
 *
 * Foundry opens a new Actor's sheet by itself, and does it in a way no hook can
 * head off -- see `actor.character.creation-gate.mjs`. So rather than trying to
 * stop the sheet, we hold it shut, take as long as we need to work out what the
 * player wants, and release it when we're done.
 */

import BAGSCharacterCreation from "../actors/actor.character.creation.mjs"
import {
  holdSheet,
  releaseSheet,
} from "../actors/actor.character.creation-gate.mjs"
import { SYSTEM_NAME } from "../config/constants.mjs"

/**
 * Whether an Actor looks like a character nobody has built yet.
 *
 * The strongest signal is that no ability score has been set, which is what
 * `canRollAbilityScores` reports. An imported or duplicated character always has
 * scores, so it never qualifies. Owned Items are checked too, to catch the
 * unusual case of a template Actor that has gear but no rolled scores.
 * @param {Actor} actor - The newly created Actor
 * @returns {boolean} Whether this is a blank character
 */
const isBlankCharacter = (actor) => {
  if (actor.type !== "character") return false

  // Compendium entries aren't being played yet.
  if (actor.pack) return false

  if (actor.items?.size > 0) return false

  return actor.system?.canRollAbilityScores === true
}

/**
 * Read the GM's preference for what new characters should do.
 * @returns {"always"|"offer"|"never"} The configured mode
 */
const creationMode = () =>
  game.settings.get(SYSTEM_NAME, "characterCreationMode")

/**
 * Ask whether the player wants to build this character step by step.
 * @param {Actor} actor - The new Actor
 * @returns {Promise<boolean>} Whether to open character creation
 */
const confirmCreation = (actor) =>
  foundry.applications.api.DialogV2.confirm({
    window: { title: "BAGS.CharacterCreation.Offer.Title" },
    content: `<p>${game.i18n.format("BAGS.CharacterCreation.Offer.Content", {
      name: actor.name,
    })}</p>`,
    yes: {
      label: "BAGS.CharacterCreation.Offer.Yes",
      icon: "fa-solid fa-dice",
    },
    no: {
      label: "BAGS.CharacterCreation.Offer.No",
      icon: "fa-solid fa-pen-to-square",
    },
    modal: true,
    // Dismissing the dialog is a "no", not an error to handle.
    rejectClose: false,
  })

Hooks.on("createActor", (actor, _options, userId) => {
  // This hook fires on every connected client. Only the one that made the Actor
  // should get a window.
  if (userId !== game.user.id) return

  if (creationMode() === "never") return
  if (!actor.isOwner) return
  if (!isBlankCharacter(actor)) return

  // Every check above is synchronous, which matters: the sheet is told to render
  // a moment from now, and a hold taken after the first `await` would miss it.
  holdSheet(actor)

  // Deliberately not awaited. Foundry doesn't wait for async hooks anyway, and
  // returning immediately keeps the hold above tight against the sheet render it
  // needs to beat.
  ;(async () => {
    try {
      if (creationMode() === "offer" && !(await confirmCreation(actor))) {
        releaseSheet(actor)
        actor.sheet.render(true)
        return
      }

      new BAGSCharacterCreation({ document: actor }).render(true)
    } catch (error) {
      // Never leave a character with a sheet that refuses to open.
      releaseSheet(actor)
      console.error("BAGS | Could not offer character creation", error)
      actor.sheet.render(true)
    }
  })()
})
