/**
 * @file Initialize BAGS' settings.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"
import SystemRegistry from "../config/system-registry"
import CharacterCreationSourcesConfig from "../applications/character-creation-source-config.mjs"
import TagManager from "../applications/settings.tag-config.mjs"
import { registerRewardsSettings } from "../rewards/ledger.mjs"

Hooks.once("init", async () => {
  if (!CONFIG.BAGS) CONFIG.BAGS = {}

  CONFIG.BAGS.SystemRegistry = SystemRegistry

  await Hooks.callAll("BAGS.RegisterSystems", CONFIG.BAGS.SystemRegistry)

  const systemRegistry = CONFIG.BAGS.SystemRegistry

  Object.values(CONFIG.BAGS.SystemRegistry.categories).forEach((category) => {
    const components = systemRegistry.getAll(category)
    const choices = Object.fromEntries(components.map((c) => [c.id, c.name]))

    /**
     * A category is meant to have exactly one component flagged `default: true`,
     * but nothing enforces that -- a rules module can register components
     * without one, and a category can legitimately be empty. Falling back to the
     * first registered component (and then to an empty string) keeps a
     * misconfigured rules module from taking the whole system down during init,
     * which used to happen here by way of `.find(...).id` on `undefined`.
     */
    const defaultComponent =
      components.find((component) => component.default) ?? components[0]

    if (!defaultComponent) {
      console.warn(
        `BAGS | Rules category "${category}" has no registered components.`,
      )
    } else if (!defaultComponent.default) {
      console.warn(
        `BAGS | Rules category "${category}" has no component flagged as the ` +
          `default; falling back to "${defaultComponent.id}".`,
      )
    }

    game.settings.register(SYSTEM_NAME, `selected${category}`, {
      name: `BAGS.Settings.Rules.${category}.Name`,
      hint: `BAGS.Settings.Rules.${category}.Hint`,
      scope: "world",
      config: true,
      type: String,
      choices,
      default: defaultComponent?.id ?? "",
      onChange: () => {
        Hooks.callAll("BAGS.SystemChange", category)
      },
    })
  })

  game.settings.register(SYSTEM_NAME, "characterCreationSources", {
    name: "BAGS.Settings.CharacterCreation.Sources.Name",
    hint: "BAGS.Settings.CharacterCreation.Sources.Hint",
    scope: "world",
    config: false,
    type: Object,
    /**
     * Each category holds an array of `{ id, type }` entries, where `type` is
     * either "folder" or "compendium". Character creation shows a step for a
     * category only when that category has at least one source, so a game that
     * doesn't use ancestries or spells simply never sees those steps.
     */
    default: {
      classes: [],
      equipment: [],
      identity: [],
      spells: [],
      abilities: [],
    },
  })

  /**
   * What happens when someone makes a new, blank character.
   *
   * "offer" is the default because character creation is a convenience, not a
   * policy: a GM building a quick NPC-shaped character shouldn't have to cancel
   * out of a wizard, and a table that always builds by hand shouldn't be asked
   * every time either. Set it to "never" and the sheet opens as it always has.
   */
  game.settings.register(SYSTEM_NAME, "characterCreationMode", {
    name: "BAGS.Settings.CharacterCreation.Mode.Name",
    hint: "BAGS.Settings.CharacterCreation.Mode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      always: "BAGS.Settings.CharacterCreation.Mode.Choices.always",
      offer: "BAGS.Settings.CharacterCreation.Mode.Choices.offer",
      never: "BAGS.Settings.CharacterCreation.Mode.Choices.never",
    },
    default: "offer",
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

  registerRewardsSettings()

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
