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

  get tooltip() {
    return `
  ${this.flavorText || this.description || ""}
  <footer>
  <span><span class="keybind">Left-Click</span> View</span>
  <span><span class="keybind">Right-Click</span> Menu</span>
  </footer>
  `
  }
}

export default BaseItemDataModel
