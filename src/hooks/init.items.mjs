import { SYSTEM_NAME } from "../config/constants.mjs"
import {
  CLASS_OVERRIDE_ITEM,
  DATA_MODEL_ITEM_AMMUNITION,
  DATA_MODEL_ITEM_CHARACTER_CLASS,
  DATA_MODEL_ITEM_ABILITY,
  DATA_MODEL_ITEM_ARMOR,
  DATA_MODEL_ITEM_CONTAINER,
  DATA_MODEL_ITEM_MISCELLANEOUS,
  DATA_MODEL_ITEM_SPELL,
  DATA_MODEL_ITEM_WEAPON,
} from "../config/overrides.mjs"

import BAGSAbilitySheet from "../items/item.ability.sheet.mjs"
import BAGSAmmunitionSheet from "../items/item.ammunition.sheet.mjs"
import BAGSArmorSheet from "../items/item.armor.sheet.mjs"
import BAGSCharacterClassSheet from "../items/item.class.sheet.mjs"
import BAGSContainerSheet from "../items/item.container.sheet.mjs"
import BAGSMiscellaneousItemSheet from "../items/item.miscellaneous.sheet.mjs"
import BAGSSpellSheet from "../items/item.spell.sheet.mjs"
import BAGSWeaponSheet from "../items/item.weapon.sheet.mjs"

Hooks.once("init", async () => {
  CONFIG.Item.documentClass = CLASS_OVERRIDE_ITEM

  CONFIG.Item.dataModels = {
    class: DATA_MODEL_ITEM_CHARACTER_CLASS,
    ammunition: DATA_MODEL_ITEM_AMMUNITION,
    item: DATA_MODEL_ITEM_MISCELLANEOUS,
    ability: DATA_MODEL_ITEM_ABILITY,
    armor: DATA_MODEL_ITEM_ARMOR,
    container: DATA_MODEL_ITEM_CONTAINER,
    spell: DATA_MODEL_ITEM_SPELL,
    weapon: DATA_MODEL_ITEM_WEAPON,
  }

  // Register data models and sheets for items
  Items.unregisterSheet("core", ItemSheet)

  // --- Physical items ----------------------------------------------------
  Items.registerSheet(SYSTEM_NAME, BAGSMiscellaneousItemSheet, {
    types: ["item"],
    makeDefault: true,
    label: "BAGS.SheetItem",
  })
  Items.registerSheet(SYSTEM_NAME, BAGSAmmunitionSheet, {
    types: ["ammunition"],
    makeDefault: true,
    label: "BAGS.SheetAmmunition",
  })
  Items.registerSheet(SYSTEM_NAME, BAGSWeaponSheet, {
    types: ["weapon"],
    makeDefault: true,
    label: "BAGS.SheetWeapon",
  })
  Items.registerSheet(SYSTEM_NAME, BAGSArmorSheet, {
    types: ["armor"],
    makeDefault: true,
    label: "BAGS.SheetSpell",
  })
  Items.registerSheet(SYSTEM_NAME, BAGSContainerSheet, {
    types: ["container"],
    makeDefault: true,
    label: "BAGS.SheetContainer",
  })

  // --- Non-physical items ----------------------------------------------------
  Items.registerSheet(SYSTEM_NAME, BAGSCharacterClassSheet, {
    types: ["class"],
    makeDefault: true,
    label: "BAGS.SheetClassItem",
  })
  Items.registerSheet(SYSTEM_NAME, BAGSSpellSheet, {
    types: ["spell"],
    makeDefault: true,
    label: "BAGS.SheetSpell",
  })
  Items.registerSheet(SYSTEM_NAME, BAGSAbilitySheet, {
    types: ["ability"],
    makeDefault: true,
    label: "BAGS.SheetAbility",
  })
})
