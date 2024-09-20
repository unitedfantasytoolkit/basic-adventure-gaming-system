import BAGSCharacterSheet from "../actors/character/actor-character-sheet";

import {
  DEFAULT_INITIATIVE_FORMULA_GROUP,
  DEFAULT_INITIATIVE_FORMULA_INDIVIDUAL,
  SYSTEM_NAME,
} from "../config/constants.mjs";
import {
  CLASS_OVERRIDE_ACTOR,
  CLASS_OVERRIDE_ITEM,
  DATA_MODEL_ACTOR_CHARACTER,
  DATA_MODEL_ITEM_CHARACTER_CLASS,
} from "../config/overrides.mjs";
import BAGSCharacterClassDataModel from "../items/class/item-character-class-data-model.mjs";
import BAGSCharacterClassSheet from "../items/class/item-class-sheet.mjs";

Hooks.once("init", () => {
  // Give modules a chance to add encumbrance schemes
  //
  // They can do so by adding their encumbrance schemes
  // to CONFIG.BAGS.encumbranceOptions
  Hooks.call("bags-setup-encumbrance");

  CONFIG.Actor.documentClass = CLASS_OVERRIDE_ACTOR;
  CONFIG.Item.documentClass = CLASS_OVERRIDE_ITEM;

  CONFIG.Actor.dataModels = {
    character: DATA_MODEL_ACTOR_CHARACTER,
  };
  CONFIG.Item.dataModels = {
    class: DATA_MODEL_ITEM_CHARACTER_CLASS,
  };

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet(SYSTEM_NAME, BAGSCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "BAGS.SheetClassCharacter",
  });
  // Actors.registerSheet(game.system.id, OseActorSheetMonster, {
  //   types: ["monster"],
  //   makeDefault: true,
  //   label: "OSE.SheetClassMonster",
  // });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(SYSTEM_NAME, BAGSCharacterClassSheet, {
    types: ["class"],
    makeDefault: true,
    label: "BAGS.SheetClassItem",
  });

  // Register data models and sheets for actors

  // Register data models and sheets for items
});
