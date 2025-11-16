/**
 * @file Data model for character identity (ancestry, culture, background, etc.)
 */
import mapToNumberField from "../utils/map-to-number-field.mjs"
import BaseItemDataModel from "./item.datamodel.mjs"
import { actionsFactory } from "../common/action.fields.mjs"

const { StringField, SchemaField, HTMLField } = foundry.data.fields

export default class BAGSIdentityDataModel extends BaseItemDataModel {
  static LOCALIZATION_PREFIXES = ["BAGS.Identity"]

  static defineSchema() {
    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )

    const abilityScores = abilityScoreSettings?.abilityScores || new Map()
    const scoreObjs = Array.from(abilityScores.entries())
    const prerequisiteFields = scoreObjs.reduce(mapToNumberField, {})

    return {
      ...super.defineSchema(),
      restrictions: new HTMLField({
        required: false,
        blank: true,
      }),

      prerequisites: new SchemaField(prerequisiteFields),

      actions: actionsFactory(),
    }
  }

  /**
   * Check if an actor meets the prerequisites for this identity.
   * @param {Actor} actor - The actor to check
   * @returns {boolean} True if prerequisites are met
   */
  meetsPrerequisites(actor) {
    if (!actor || actor.type !== "character") return false

    const abilityScoreSettings =
      CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
        CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
      )
    const abilityScores = abilityScoreSettings?.abilityScores || new Map()

    for (const [key] of abilityScores.entries()) {
      const required = this.prerequisites[key]
      if (required && actor.system.base.abilityScores[key] < required) {
        return false
      }
    }

    return true
  }
}
