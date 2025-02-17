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

  // get appliedEffects() {
  //   const effects = super.appliedEffects.map((e) => {
  //     if (e.parent instanceof CONFIG.Actor.documentClass) return true
  //     if (e.parent.type === "weapon" || e.parent.type === "armor")
  //       return e.system.isEquipped
  //     return false
  //   })

  //   console.info(effects.map((e) => e.parent))

  //   return effects
  // }

  get appliedEffectsByAffectedKey() {
    const attributeModifications = new Map()

    this.appliedEffects.forEach((effect) => {
      if (!effect.changes?.length) return

      effect.changes.forEach((change) => {
        const { key, ...modification } = change

        if (!attributeModifications.has(key))
          attributeModifications.set(key, [])

        attributeModifications.get(key).push({
          name: effect.name,
          id: effect.id,
          img: effect.img,
          parent: effect.parent,
          modification,
          statuses: effect.statuses,
        })
      })
    })

    return attributeModifications
  }

  get actions() {
    const documentToActions = ({ id, uuid, name, img, ...i }) => ({
      id,
      uuid,
      name,
      img,
      actions: i.system?.actions || [],
    })

    const itemActions = Object.entries(this.items.documentsByType).reduce(
      (obj, [key, items]) => ({
        ...obj,
        [key]: items
          .filter((i) => i.system?.actions?.length)
          .map(documentToActions),
      }),
      {},
    )

    return {
      builtins: [documentToActions(this)],
      ...itemActions,
    }
  }

  get flattenedOverrides() {
    return foundry.utils.flattenObject(this.overrides)
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
