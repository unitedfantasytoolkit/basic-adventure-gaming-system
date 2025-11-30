import { actionsFactory } from "../common/action.fields.mjs"
import BaseItemDataModel from "./item.datamodel.mjs"

const { DocumentUUIDField, NumberField } = foundry.data.fields

export default class BAGSSpellDataModel extends BaseItemDataModel {
  static LOCALIZATION_PREFIXES = ["BAGS.Items.Spells"]

  static defineSchema() {
    return {
      ...super.defineSchema(),
      level: new NumberField({ min: 0, initial: 1 }),
      classUUID: new DocumentUUIDField({ type: "Item" }),
      actions: actionsFactory(),
    }
  }

  get castingClass() {
    return fromUuidSync(this.classUUID)
  }

  cast() {}

  /**
   * Generate tooltip logistics HTML for spells showing level and casting class
   * @returns {string} HTML for the logistics section of the tooltip
   */
  get _tooltipLogisticsHTML() {
    const className = this.castingClass?.name || "—"
    const levelLabel = game.i18n.localize("BAGS.SpellManager.Level")

    return `
      <dl class="item-stats">
        <dt><i class="fas fa-layer-group" aria-label="${levelLabel}"></i></dt>
        <dd>${this.level}</dd>

        <dt><i class="fas fa-graduation-cap" aria-label="Class"></i></dt>
        <dd>${className}</dd>
      </dl>
    `
  }
}
