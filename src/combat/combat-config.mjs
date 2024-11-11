/**
 * @file The combat tracker config app.
 */
import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

export default class BAGSCombatTrackerConfig extends foundry.applications.apps
  .CombatTrackerConfig {
  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "combat-config",
      title: game.i18n.localize("COMBAT.Settings"),
      classes: ["sheet", "combat-sheet"],
      template: `${SYSTEM_TEMPLATE_PATH}/combat/combat-config.hbs`,
      width: 420,
    })
  }

  /** @override */
  async getData(options = {}) {
    const data = await super.getData(options)

    return foundry.utils.mergeObject(data, {
      systemName: SYSTEM_NAME,
      settings: {
        ...data.settings,
        ...game.settings.get(
          SYSTEM_NAME,
          CONFIG.Combat.documentClass.CONFIG_SETTING,
        ),
      },
      rerollBehaviorChoices: {
        reroll: "COMBAT.RerollBehaviorOptions.Reroll",
        keep: "COMBAT.RerollBehaviorOptions.Keep",
        reset: "COMBAT.RerollBehaviorOptions.Reset",
      },
    })
  }

  /** @override */
  async _updateObject(_event, formData) {
    const gameCombatThemeUpdate = game.settings.set(
      "core",
      "combatTheme",
      formData["core.combatTheme"],
    )
    const coreSettingsUpdate = game.settings.set(
      "core",
      CONFIG.Combat.documentClass.CONFIG_SETTING,
      {
        resource: formData.resource,
        skipDefeated: formData.skipDefeated,
      },
    )
    const systemSettingsUpdate = game.settings.set(
      SYSTEM_NAME,
      CONFIG.Combat.documentClass.CONFIG_SETTING,
      {
        usesGroupInitiative: formData.usesGroupInitiative,
        rerollBehavior: formData.rerollBehavior,
      },
    )

    return Promise.all([
      gameCombatThemeUpdate,
      coreSettingsUpdate,
      systemSettingsUpdate,
    ])
  }
}
