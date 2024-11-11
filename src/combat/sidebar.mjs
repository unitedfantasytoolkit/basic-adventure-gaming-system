// import BAGS from "../config";
import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import BAGSCombatTrackerConfig from "./combat-config.mjs"
import BAGSGroupCombat from "./combat-group.mjs"
import BAGSCombatGroupSelector from "./combat-set-groups.mjs"
import BAGSCombatant from "./combatant.mjs"

export default class BAGSCombatTab extends CombatTracker {
  // ===========================================================================
  // APPLICATION SETUP
  // ===========================================================================

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: `${SYSTEM_TEMPLATE_PATH}/sidebar/combat-tracker.hbs`,
    })
  }

  static GROUP_CONFIG_APP = new BAGSCombatGroupSelector()

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  async getData(options) {
    const context = await super.getData(options)
    const isGroupInitiative = game.settings.get(
      SYSTEM_NAME,
      CONFIG.Combat.documentClass.CONFIG_SETTING,
    ).usesGroupInitiative

    const turns = context.turns.map((turn) => {
      const combatant = game.combat.combatants.get(turn.id)
      turn.isSlowed = turn.initiative`${CONFIG.Combatant.documentClass.INITIATIVE_VALUE_SLOWED}`
      turn.isCasting = !!combatant.getFlag(game.system.id, "prepareSpell")
      turn.isRetreating = !!combatant.getFlag(game.system.id, "moveInCombat")
      turn.isOwnedByUser = !!combatant.actor.isOwner
      turn.group = combatant.group
      return turn
    })

    const groups = turns.reduce((arr, turn) => {
      const idx = arr.findIndex((r) => r.group === turn.group)

      if (idx !== -1) {
        arr[idx].turns.push(turn)
        return arr
      }

      return [
        ...arr,
        {
          group: turn.group,
          label: BAGSGroupCombat.GROUPS[turn.group],
          initiative: turn.initiative,
          turns: [turn],
        },
      ]
    }, [])

    return foundry.utils.mergeObject(context, {
      turns,
      groups,
      isGroupInitiative,
    })
  }

  // ===========================================================================
  // UI EVENTS
  // ===========================================================================

  activateListeners(html) {
    super.activateListeners(html)

    // --- Group initiative rerolling ------------------------------------------
    html.find('.combat-button[data-control="reroll"]').click(() => {
      game.combat.rollInitiative()
    })

    // --- Group configurator --------------------------------------------------
    html.find('.combat-button[data-control="set-groups"]').click(() => {
      BAGSCombatTab.GROUP_CONFIG_APP.render(true, { focus: true })
    })

    // --- Combat settings -----------------------------------------------------
    html.find(".combat-settings").unbind("click")
    html.find(".combat-settings").click((ev) => {
      ev.preventDefault()
      new BAGSCombatTrackerConfig().render(true)
    })
  }

  async #toggleFlag(combatant, flag) {
    const isActive = !!combatant.getFlag(game.system.id, flag)
    await combatant.setFlag(game.system.id, flag, !isActive)
  }

  /**
   * Handle a Combatant control toggle
   * @private
   * @param {Event} event - The originating mousedown event
   */
  async _onCombatantControl(event) {
    event.preventDefault()
    event.stopPropagation()
    const btn = event.currentTarget
    const li = btn.closest(".combatant")
    const combat = this.viewed
    const c = combat.combatants.get(li.dataset.combatantId)

    switch (btn.dataset.control) {
      // Toggle combatant spellcasting flag
      case "casting":
        return this.#toggleFlag(c, "prepareSpell")
      // Toggle combatant retreating flag
      case "retreat":
        return this.#toggleFlag(c, "moveInCombat")
      // Fall back to the superclass's button events
      default:
        return super._onCombatantControl(event)
    }
  }

  // ===========================================================================
  // ADDITIONS TO THE COMBATANT CONTEXT MENU
  // ===========================================================================

  _getEntryContextOptions() {
    const options = super._getEntryContextOptions()
    return [
      {
        name: game.i18n.localize("BAGS.combat.SetCombatantAsActive"),
        icon: '<i class="fas fa-star-of-life"></i>',
        callback: (li) => {
          const combatantId = li.data("combatant-id")
          const turnToActivate = this.viewed.turns.findIndex(
            (t) => t.id === combatantId,
          )
          this.viewed.activateCombatant(turnToActivate)
        },
      },
      ...options,
    ]
  }
}
