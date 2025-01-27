/**
 * @file The entity class for all Actors in the syste
 */

import {
  DEFAULT_ART_ACTOR_CHARACTER,
  DEFAULT_ART_ACTOR_MONSTER,
  DEFAULT_ART_ACTOR_MOUNT,
} from "../config/constants.mjs"

import CharacterCreationWizard from "./actor.character.creation-wizard.mjs"

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

  /**
   * Given a save type, roll a saving throw.
   * Note that this roll has no context; for rolls with context (like monster
   * abilities and spells), use an Action.
   *
   * @TODO: Roll prompt dialog.
   */
  async rollSave(saveType) {
    return saveType
  }

  async doCreationWizard() {
    const wizard = new CharacterCreationWizard({
      actor: this,
    })

    wizard.render(true)
  }
}
