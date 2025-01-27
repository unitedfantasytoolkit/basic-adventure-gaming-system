/**
 * @file The entity class for all Actors in the syste
 */

import {
  DEFAULT_ART_ACTOR_CHARACTER,
  DEFAULT_ART_ACTOR_MONSTER,
  DEFAULT_ART_ACTOR_MOUNT,
} from "../config/constants.mjs"

import CharacterCreationWizard from "./actor.character.creation-wizard.mjs"
import ActionResolver from "../rules-engines/action-resolver.mjs"

export default class BAGSActor extends Actor {
  static getDefaultArtwork(actorData) {
    let art = ""

    switch (actorData.type) {
      case "character":
        art = DEFAULT_ART_ACTOR_CHARACTER
        break
      case "mount":
        art = DEFAULT_ART_ACTOR_MOUNT
        break
      case "monster":
      default:
        art = DEFAULT_ART_ACTOR_MONSTER
        break
    }

    return {
      img: art,
      texture: {
        src: art,
      },
    }
  }

  async resolveAction(action, item = null) {
    const resolver = new ActionResolver(action, item, this, game.user.targets)

    return resolver.resolve()
  }

  async rollSave(save, modifier) {
    const roll = new Roll(
      `1d20+${modifier}cs<=${this.system.savingThrows[save]}`,
    )

    await roll.resolve()
  }

  async doCreationWizard() {
    const wizard = new CharacterCreationWizard({
      actor: this,
    })

    wizard.render(true)
  }

  getRollData() {
    return this.system
  }
}
