import { SYSTEM_NAME } from "../config/constants.mjs"
import {
  CLASS_OVERRIDE_ITEM,
  DATA_MODEL_ITEM_AMMUNITION,
  DATA_MODEL_ITEM_CHARACTER_CLASS,
} from "../config/overrides.mjs"
import BAGSCharacterClassSheet from "../items/item.character-class.sheet.mjs"

Hooks.once("init", async () => {
  // Give modules a chance to add encumbrance schemes
  //
  // They can do so by adding their encumbrance schemes
  // to CONFIG.BAGS.encumbranceOptions
  Hooks.call("bags-setup-encumbrance")

  CONFIG.Item.documentClass = CLASS_OVERRIDE_ITEM

  CONFIG.Item.dataModels = {
    class: DATA_MODEL_ITEM_CHARACTER_CLASS,
    ammunition: DATA_MODEL_ITEM_AMMUNITION,
  }

  // Register data models and sheets for items
  Items.unregisterSheet("core", ItemSheet)
  Items.registerSheet(SYSTEM_NAME, BAGSCharacterClassSheet, {
    types: ["class"],
    makeDefault: true,
    label: "BAGS.SheetClassItem",
  })
})

Hooks.once("ready", async () => {
  const devsheet = (await fromUuid("Actor.A81XqzmshDo9D55H")).sheet.render(true)
})
