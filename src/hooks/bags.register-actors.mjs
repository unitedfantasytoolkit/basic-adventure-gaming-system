import BAGSCharacterSheet from "../actors/actor.character.sheet.mjs"

import { SYSTEM_NAME } from "../config/constants.mjs"
import {
  CLASS_OVERRIDE_ACTOR,
  DATA_MODEL_ACTOR_CHARACTER,
} from "../config/overrides.mjs"

Hooks.once("init", async () => {
  const { default: CharacterDataModel } = await import(
    "../actors/actor.character.datamodel.mjs"
  )

  CONFIG.Actor.documentClass = CLASS_OVERRIDE_ACTOR

  CONFIG.Actor.dataModels = {
    character: DATA_MODEL_ACTOR_CHARACTER,
  }

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet)
  Actors.registerSheet(SYSTEM_NAME, BAGSCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "BAGS.SheetClassCharacter",
  })
  // Actors.registerSheet(game.system.id, OseActorSheetMonster, {
  //   types: ["monster"],
  //   makeDefault: true,
  //   label: "OSE.SheetClassMonster",
  // });

  // Register data models and sheets for actors
})
