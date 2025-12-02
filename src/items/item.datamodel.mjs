/**
 * @file The base data model for every Item.
 */
import { actionsFactory } from "../common/action.fields.mjs"

const { ArrayField, StringField, HTMLField, FilePathField } =
  foundry.data.fields

class BaseItemDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tags: new ArrayField(new StringField(), { initial: [] }),
      actions: actionsFactory(),
      description: new HTMLField({
        label: "BAGS.Items.Physical.Description.Label",
        hint: "BAGS.Items.Physical.Description.Hint",
      }),
      flavorText: new HTMLField({
        label: "BAGS.Items.Physical.FlavorText.Label",
        hint: "BAGS.Items.Physical.FlavorText.Hint",
      }),
      banner: new FilePathField({
        categories: ["IMAGE"],
        label: "BAGS.Items.Physical.Banner.Label",
        hint: "BAGS.Items.Physical.Banner.Hint",
      }),
    }
  }

  get canUseEffects() {
    return this.areEffectsAppliedWhenUnequipped || this.isEquipped
  }

  get canUseActions() {
    return this.areActionsAvailableWhenUnequipped || this.isEquipped
  }

  /**
   * Returns the complete list of actions available for this item.
   * By default, returns the actions array. Subclasses can override
   * to include additional action sources (e.g., weapon default attack).
   * @returns {Array} Array of action objects
   */
  get actionList() {
    return this.actions
  }

  // eslint-disable-next-line
  get _tooltipControlsHTML() {
    return `
      <span><i class="iconoir-mouse-button-left" aria-label="Left click"></i> View</span>
      <span><i class="iconoir-pc-mouse" aria-label="Middle click"></i> Pin tooltip</span>
      <span><i class="iconoir-mouse-button-right" aria-label="Right Click"></i> Menu</span>
    `
  }

  get _tooltipLogisticsHTML() {
    return `
  <dl class="item-stats">
    <dt><i class="fas fa-hashtag" aria-label="Quantity"></i></dt>
    <dd>${this.quantity}</dd>

    <dt><i class="fa fa-coins"></i></dt>
    <dd>${this.cost > 0 ? this.cost : "-"}</dd>

    <dt><i class="fa fa-weight-hanging"></i></dt>
    <dd>${this.weight > 0 ? this.weight : "-"}</dd>
  </dl>
  `
  }

  get _tooltipContentHTML() {
    return this.flavorText || this.description || ""
  }
}

export default BaseItemDataModel
