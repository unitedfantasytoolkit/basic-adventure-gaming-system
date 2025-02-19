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

  /**
   * Get all ActiveEffects that may apply to this Actor.
   * If CONFIG.ActiveEffect.legacyTransferral is true, this is equivalent to actor.effects.contents.
   * If CONFIG.ActiveEffect.legacyTransferral is false, this will also return all the transferred ActiveEffects on any
   * of the Actor's owned Items.
   * @yields {ActiveEffect}
   * @returns {Generator<ActiveEffect, void, void>}
   */
  *allApplicableEffects() {
    for (const effect of this.effects) {
      yield effect
    }
    if (CONFIG.ActiveEffect.legacyTransferral) return
    for (const item of this.items) {
      for (const effect of item.effects) {
        if (item.isPhysical && !item.system.isEquipped) continue
        if (effect.transfer) yield effect
      }
    }
  }

  // get appliedEffects() {
  //   const effects = super.appliedEffects.filter((e) => {
  //     if (e.parent instanceof CONFIG.Actor.documentClass) return true
  //     if (e.parent.isPhysical) {
  //       console.info(e.parent.system)
  //       return e.parent.system.isEquipped
  //     }
  //     return false
  //   })

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

  get appliedEffectsBySource() {
    const sources = new Map()

    this.appliedEffects.forEach((effect) => {
      const { uuid } = effect.parent
      if (!sources.has(uuid)) sources.set(uuid, [])
      sources.get(uuid).push(effect)
    })

    return Array.from(sources.entries()).map(([uuid, effects]) => ({
      parent: fromUuidSync(uuid),
      effects,
    }))
  }

  get temporaryAppliedEffects() {
    return this.appliedEffects.filter((e) => e.isTemporary)
  }

  get lastingAppliedEffects() {
    return this.appliedEffects.filter((e) => !e.isTemporary)
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

  get equipped() {
    const equipped = {
      weapon: [],
      armor: [],
      item: [],
    }
    this.items
      .filter((i) => i.system.isEquipped)
      .forEach((i) => equipped[i.type].push(i))
    return equipped
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
