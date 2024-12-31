import BAGSCombat from "../combat/combat.mjs"
import { SYSTEM_NAME } from "../config/constants.mjs"
import {
  CLASS_OVERRIDE_COMBAT,
  CLASS_OVERRIDE_SIDEBAR_COMBAT_CONFIG,
} from "../config/overrides.mjs"
import BXConfig from "../config/bx.mjs"

Hooks.once("init", async () => {
  if (!CONFIG.BAGS) CONFIG.BAGS = {}
  if (!(CONFIG.BAGS.systems instanceof Map)) CONFIG.BAGS.systems = new Map()

  CONFIG.BAGS.systems.set("bx", BXConfig)

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

  game.settings.register(SYSTEM_NAME, "usesAscendingAC", {
    name: game.i18n.localize("BAGS.settings.useFactionRepModifiers.name"),
    hint: game.i18n.localize("BAGS.settings.useFactionRepModifiers.hint"),
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
  })
})
