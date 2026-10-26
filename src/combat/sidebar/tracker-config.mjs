/**
 * @file The combat tracker's configuration dialog.
 *
 * The system's turn-sequence preferences belong here rather than in the world
 * settings list: they are about how this tracker behaves, and a referee looking
 * for them will look where Foundry already keeps "Token Turn Markers" and the
 * tracked resource. They sit in their own fieldset alongside those.
 */

import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../../config/constants.mjs"
import { ATTACK_SPACING } from "../../rules-engines/segments.mjs"
import {
  DECLARATION_MODE,
  REROLL_CADENCE,
  TURN_GRANULARITY,
  resolveInitiativeConfig,
} from "../initiative-config.mjs"

/**
 * The system settings this dialog owns, in the order they are shown.
 *
 * Kept as data so the template, the context and the save handler cannot drift
 * apart -- adding a preference means adding one entry here.
 * `relevant` hides a preference that the game currently being played has no use
 * for. It is not a permission check -- the setting still exists and still
 * applies if the world switches rulesets -- it is about not asking a Basic/Expert
 * table to answer a question only the Advanced games pose.
 * @type {Array<{key: string, type: string, choices?: object,
 * relevant?: (config: object) => boolean}>}
 */
const BAGS_SETTINGS = [
  {
    key: "turnGranularity",
    type: "select",
    choices: TURN_GRANULARITY,
    labels: "BAGS.Settings.Combat.TurnGranularity.Choices",
  },
  {
    key: "rerollCadence",
    type: "select",
    choices: REROLL_CADENCE,
    labels: "BAGS.Settings.Combat.RerollCadence.Choices",
  },
  {
    key: "declarationMode",
    type: "select",
    choices: DECLARATION_MODE,
    labels: "BAGS.Settings.Combat.DeclarationMode.Choices",
  },
  {
    key: "blindDeclarations",
    type: "checkbox",
    relevant: (config) => config.declarationMode !== DECLARATION_MODE.OFF,
  },
  {
    key: "attackSpacing",
    type: "select",
    // A blank first option meaning "whatever this ruleset prefers", which is a
    // real answer and not the absence of one.
    choices: { DEFAULT: "", ...ATTACK_SPACING },
    labels: "BAGS.Settings.Combat.AttackSpacing.Choices",
    labelKeys: {
      "": "default",
      [ATTACK_SPACING.INITIATIVE]: "initiative",
      [ATTACK_SPACING.INITIATIVE_THEN_END]: "initiativeThenEnd",
      [ATTACK_SPACING.SPREAD]: "spread",
      [ATTACK_SPACING.EVEN]: "even",
    },
    relevant: (config) => config.usesAttackRoutines,
  },
  { key: "showMovementBudget", type: "checkbox" },
  { key: "postRoundCard", type: "checkbox" },
]

/**
 * The combat tracker configuration, with the system's own preferences added.
 */
export default class BAGSCombatTrackerConfig extends foundry.applications.apps
  .CombatTrackerConfig {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    form: { handler: BAGSCombatTrackerConfig.#save },
  }

  /** @inheritdoc */
  static PARTS = {
    ...super.PARTS,
    body: {
      template: `${SYSTEM_TEMPLATE_PATH}/combat/tracker-config.hbs`,
      scrollable: [""],
    },
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)

    // The viewed combat when there is one, so a per-encounter override decides
    // what is worth showing; the world's rules otherwise.
    const initiative = resolveInitiativeConfig(
      game.combats?.viewed ?? undefined,
    )

    context.bags = BAGS_SETTINGS.filter(
      (setting) => !setting.relevant || setting.relevant(initiative),
    ).map((setting) => {
      const config = game.settings.settings.get(`${SYSTEM_NAME}.${setting.key}`)

      return {
        name: `${SYSTEM_NAME}.${setting.key}`,
        key: setting.key,
        type: setting.type,
        label: config?.name ?? setting.key,
        hint: config?.hint ?? "",
        value: game.settings.get(SYSTEM_NAME, setting.key),
        options: setting.choices
          ? Object.values(setting.choices).map((value) => ({
              value,
              label: game.i18n.localize(
                `${setting.labels}.${setting.labelKeys?.[value] ?? value}`,
              ),
            }))
          : null,
      }
    })

    return context
  }

  /**
   * Save Foundry's settings and the system's together.
   *
   * Core's handler is a private static, so it cannot be called from here; the
   * two lines it runs are reproduced rather than reached.
   * @this {BAGSCombatTrackerConfig}
   * @param {Event} event - The submit event.
   * @param {HTMLFormElement} form - The form.
   * @param {object} submitData - The gathered form data.
   * @returns {Promise<void>} Resolves once every setting is stored.
   */
  static async #save(event, form, submitData) {
    const settings = foundry.utils.expandObject(submitData.object)
    const combatConfig = foundry.documents.Combat.CONFIG_SETTING

    await game.settings.set("core", "combatTheme", settings.core.combatTheme)
    if (game.user.can("SETTINGS_MODIFY")) {
      await game.settings.set("core", combatConfig, settings.core[combatConfig])
    }

    const ours = settings[SYSTEM_NAME] ?? {}
    await Promise.all(
      BAGS_SETTINGS.filter((setting) => setting.key in ours).map((setting) =>
        game.settings.set(SYSTEM_NAME, setting.key, ours[setting.key]),
      ),
    )
  }
}
