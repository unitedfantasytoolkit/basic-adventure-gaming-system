import { SYSTEM_NAME } from "../config/constants.mjs"
import SystemRegistry from "../config/system-registry"
import CharacterCreationSourcesConfig from "../applications/character-creation-source-config.mjs"
import TagManager from "../applications/settings.tag-config.mjs"

Hooks.once("init", async () => {
  if (!CONFIG.BAGS) CONFIG.BAGS = {}

  CONFIG.BAGS.SystemRegistry = SystemRegistry

  await Hooks.callAll("BAGS.RegisterSystems", CONFIG.BAGS.SystemRegistry)

  const systemRegistry = CONFIG.BAGS.SystemRegistry

  CONFIG.ActiveEffect.legacyTransferral = false

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

  game.settings.register(SYSTEM_NAME, "tags", {
    name: "BAGS.Settings.Tags.Name",
    hint: "BAGS.Settings.Tags.Hint",
    scope: "world",
    config: false,
    type: Array,
    default: [],
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

  game.settings.registerMenu(SYSTEM_NAME, "tagManager", {
    name: "BAGS.Settings.TagManager.Name",
    label: "BAGS.Settings.TagManager.Label",
    icon: "fas fa-tags",
    type: TagManager,
    restricted: true,
  })

  Hooks.callAll("BAGS.RegisterActors")
})
