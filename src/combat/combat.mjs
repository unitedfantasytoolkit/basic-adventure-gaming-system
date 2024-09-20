/**
 * @file System-level modifications to the way combat works
 */

import { SYSTEM_NAME } from "../config/constants.mjs";

/**
 * An extension of Foundry's Combat class that implements initiative for indivitual combatants.
 *
 * @todo Use a single chat card for rolling group initiative
 */
export default class BAGSCombat extends Combat {
  static FORMULA = "1d6 + @init";

  get #rerollBehavior() {
    return game.settings.get(
      SYSTEM_NAME,
      CONFIG.Combat.documentClass.CONFIG_SETTING,
    ).rerollInitiative;
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  async #rollAbsolutelyEveryone() {
    await this.rollInitiative(
      this.combatants.map((c) => c.id),
      { formula: this.constructor.FORMULA },
    );
  }

  // ===========================================================================
  // COMBAT LIFECYCLE MANAGEMENT
  // ===========================================================================

  async startCombat() {
    await super.startCombat();
    if (this.#rerollBehavior !== "reset") await this.#rollAbsolutelyEveryone();
    return this;
  }

  async _onEndRound() {
    switch (this.#rerollBehavior) {
      case "reset":
        this.resetAll();
        break;
      case "reroll":
        this.#rollAbsolutelyEveryone();
        break;
      case "keep":
      default:
        break;
    }
    await super._onEndRound();
    await this.activateCombatant(0);
  }

  async activateCombatant(turn) {
    if (game.user.isGM) {
      await game.combat.update({ turn });
    }
  }
}
