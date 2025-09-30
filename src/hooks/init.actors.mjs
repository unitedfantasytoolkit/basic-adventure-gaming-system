import { SYSTEM_NAME } from "../config/constants.mjs"
import BAGSActor from "../actors/actor.document.mjs"
import BAGSCharacterSheet from "../actors/actor.character.sheet.mjs"
import BAGSMonsterSheet from "../actors/actor.monster.sheet.mjs"

Hooks.once("init", async () => {
  // We do this because we need settings to have initialized before we can
  // use our actor data models.
  const { default: CharacterDataModel } = await import(
    "../actors/actor.character.datamodel.mjs"
  )
  const { default: MonsterDataModel } = await import(
    "../actors/actor.monster.datamodel.mjs"
  )

  CONFIG.Actor.documentClass = BAGSActor

  CONFIG.Actor.dataModels = {
    character: CharacterDataModel,
    monster: MonsterDataModel,
  }

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet(
    "core",
    foundry.appv1.sheets.ActorSheet,
  )
  foundry.documents.collections.Actors.registerSheet(
    SYSTEM_NAME,
    BAGSCharacterSheet,
    {
      types: ["character"],
      makeDefault: true,
      label: "BAGS.SheetClassCharacter",
    },
  )
  foundry.documents.collections.Actors.registerSheet(
    game.system.id,
    BAGSMonsterSheet,
    {
      types: ["monster"],
      makeDefault: true,
      label: "BAGS.SheetClassMonster",
    },
  )
})
