/**
 * @file The entity class for all Actors in the syste
 */

import {
  DEFAULT_ART_ACTOR_CHARACTER,
  DEFAULT_ART_ACTOR_MONSTER,
  DEFAULT_ART_ACTOR_MOUNT,
} from "../config/constants.mjs"

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

  resolveAction(item, action) {
    console.info(this)
    console.info(item)
    console.info(action)
    console.info(game.user)
  }

  async rollSave(save, modifier) {
    const roll = new Roll(
      `1d20+${modifier}cs<=${this.system.savingThrows[save]}`,
    )

    await roll.resolve()
  }
}
