import { SYSTEM_NAME } from "../config/constants.mjs"
import {
  CLASS_OVERRIDE_COMBAT,
  CLASS_OVERRIDE_SIDEBAR_COMBAT_CONFIG,
} from "../config/overrides.mjs"
import SystemRegistry from "../config/system-registry"
import CharacterCreationSourcesConfig from "../applications/character-creation-source-config.mjs"

Hooks.once("init", async () => {
  if (!CONFIG.BAGS) CONFIG.BAGS = {}

  CONFIG.BAGS.SystemRegistry = SystemRegistry

  await Hooks.callAll("BAGS.RegisterSystems", CONFIG.BAGS.SystemRegistry)

  const systemRegistry = CONFIG.BAGS.SystemRegistry

  Object.entries(CONFIG.BAGS.SystemRegistry.categories).forEach(
    ([_, category]) => {
      const components = systemRegistry.getAll(category)
      const choices = Object.fromEntries(components.map((c) => [c.id, c.name]))

      game.settings.register(SYSTEM_NAME, `selected${category}`, {
        name: `BAGS.Settings.Rules.${category}.Name`,
        hint: `BAGS.Settings.Rules.${category}.Hint`,
        scope: "world",
        config: true,
        type: String,
        choices,
        default: systemRegistry.getAll(category).find((e) => e.default).id,
        onChange: () => {
          Hooks.callAll("BAGS.SystemChange", category)
        },
      })
    },
  )

  // Combat Tracker Configuration
  game.settings.registerMenu(
    SYSTEM_NAME,
    CLASS_OVERRIDE_COMBAT.CONFIG_SETTING,
    {
      name: "SETTINGS.CombatConfigN",
      label: "SETTINGS.CombatConfigL",
      hint: "SETTINGS.CombatConfigH",
      icon: "fa-solid fa-swords",
      type: CLASS_OVERRIDE_SIDEBAR_COMBAT_CONFIG,
    },
  )

  game.settings.register(SYSTEM_NAME, CLASS_OVERRIDE_COMBAT.CONFIG_SETTING, {
    name: "Combat Tracker Configuration",
    scope: "world",
    config: false,
    default: {
      usesGroupInitiative: true,
      rerollInitiative: "reroll",
    },
    type: Object,
    onChange: () => {
      if (game.combat) {
        game.combat.reset()
        game.combats.render()
      }
    },
  })

  game.settings.register(SYSTEM_NAME, "characterCreationSources", {
    name: "BAGS.Settings.CharacterCreation.Sources.Name",
    hint: "BAGS.Settings.CharacterCreation.Sources.Hint",
    scope: "world",
    config: false,
    type: Object,
    default: {
      classes: [], // Array of folder/compendium UUIDs
      equipment: [],
      // other source types as needed
    },
  })

  game.settings.register(SYSTEM_NAME, "characterCreationStartingGold", {
    name: "BAGS.Settings.CharacterCreation.StartingGold.Name",
    hint: "BAGS.Settings.CharacterCreation.StartingGold.Hint",
    scope: "world",
    config: false,
    type: String,
    default: "3d6 * 10",
  })

  game.settings.registerMenu(SYSTEM_NAME, "characterCreationSources", {
    name: "BAGS.Settings.CharacterCreation.Sources.Name",
    label: "BAGS.Settings.CharacterCreation.Sources.Configure",
    hint: "BAGS.Settings.CharacterCreation.Sources.Hint",
    icon: "fas fa-scroll",
    type: CharacterCreationSourcesConfig,
    restricted: true,
  })

  Hooks.callAll("BAGS.RegisterActors")
})
