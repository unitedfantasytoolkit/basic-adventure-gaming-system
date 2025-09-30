import { SYSTEM_NAME } from "../config/constants.mjs"

import BAGSItem from "../items/item.document.mjs"

import BAGSAbilitySheet from "../items/item.ability.sheet.mjs"
import BAGSAbilityDataModel from "../items/item.ability.datamodel.mjs"

import BAGSArmorSheet from "../items/item.armor.sheet.mjs"
import BAGSItemArmorDataModel from "../items/item.armor.datamodel.mjs"

import BAGSCharacterClassSheet from "../items/item.character-class.sheet.mjs"
import BAGSCharacterClassDataModel from "../items/item.character-class.datamodel.mjs"

import BAGSMiscellaneousItemSheet from "../items/item.miscellaneous.sheet.mjs"
import BAGSItemMiscellaneousDataModel from "../items/item.miscellaneous.datamodel.mjs"

import BAGSSpellSheet from "../items/item.spell.sheet.mjs"
import BAGSSpellDataModel from "../items/item.spell.datamodel.mjs"

import BAGSWeaponSheet from "../items/item.weapon.sheet.mjs"
import BAGSItemWeaponDataModel from "../items/item.weapon.datamodel.mjs"

Hooks.once("init", async () => {
  CONFIG.Item.documentClass = BAGSItem

  CONFIG.Item.dataModels = {
    class: BAGSCharacterClassDataModel,
    item: BAGSItemMiscellaneousDataModel,
    ability: BAGSAbilityDataModel,
    armor: BAGSItemArmorDataModel,
    spell: BAGSSpellDataModel,
    weapon: BAGSItemWeaponDataModel,
  }

  // Register data models and sheets for items
  foundry.documents.collections.Items.unregisterSheet(
    "core",
    foundry.appv1.sheets.ItemSheet,
  )

  // --- Physical items ----------------------------------------------------
  foundry.documents.collections.Items.registerSheet(
    SYSTEM_NAME,
    BAGSMiscellaneousItemSheet,
    {
      types: ["item"],
      makeDefault: true,
      label: "BAGS.SheetItem",
    },
  )
  foundry.documents.collections.Items.registerSheet(
    SYSTEM_NAME,
    BAGSWeaponSheet,
    {
      types: ["weapon"],
      makeDefault: true,
      label: "BAGS.SheetWeapon",
    },
  )
  foundry.documents.collections.Items.registerSheet(
    SYSTEM_NAME,
    BAGSArmorSheet,
    {
      types: ["armor"],
      makeDefault: true,
      label: "BAGS.SheetSpell",
    },
  )
  // --- Non-physical items ----------------------------------------------------
  foundry.documents.collections.Items.registerSheet(
    SYSTEM_NAME,
    BAGSCharacterClassSheet,
    {
      types: ["class"],
      makeDefault: true,
      label: "BAGS.SheetClassItem",
    },
  )
  foundry.documents.collections.Items.registerSheet(
    SYSTEM_NAME,
    BAGSSpellSheet,
    {
      types: ["spell"],
      makeDefault: true,
      label: "BAGS.SheetSpell",
    },
  )
  foundry.documents.collections.Items.registerSheet(
    SYSTEM_NAME,
    BAGSAbilitySheet,
    {
      types: ["ability"],
      makeDefault: true,
      label: "BAGS.SheetAbility",
    },
  )
})
