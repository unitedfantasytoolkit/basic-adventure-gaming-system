/**
 * @file A subclassable data model that represents physical objects.
 */

import BaseItemDataModel from "./item.datamodel.mjs"

const {
  ArrayField,
  NumberField,
  StringField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
  BooleanField,
} = foundry.data.fields

class PhysicalItemDataModel extends BaseItemDataModel {
  isPhysicalItem = true

  static defineSchema() {
    return {
      ...super.defineSchema(),
      baseItemId: new StringField({
        nullable: true,
        initial: () => foundry.utils.randomID(),
        label: "BAGS.Items.Physical.BaseItemId.Label",
        hint: "BAGS.Items.Physical.BaseItemId.Hint",
      }),
      isStackable: new BooleanField({
        initial: true,
        label: "BAGS.Items.Physical.IsStackable.Label",
        hint: "BAGS.Items.Physical.IsStackable.Hint",
      }),
      quantity: new NumberField({
        min: 0,
        initial: 1,
        label: "BAGS.Items.Physical.Quantity.Label",
      }),
      cost: new NumberField({
        min: 0,
        initial: 1,
        label: "BAGS.Items.Physical.Cost.Label",
      }),
      uses: new SchemaField({
        value: new NumberField({
          min: 0,
          initial: 0,
          label: "BAGS.Items.Physical.Uses.Value.Label",
          hint: "BAGS.Items.Physical.Uses.Value.Hint",
        }),
        max: new NumberField({
          min: 0,
          initial: 0,
          label: "BAGS.Items.Physical.Uses.Max.Label",
          hint: "BAGS.Items.Physical.Uses.Max.Hint",
        }),
      }),
      weight: new NumberField({
        min: 0,
        initial: 0,
        label: "BAGS.Items.Physical.Weight.Label",
        hint: "BAGS.Items.Physical.Weight.Hint",
      }),
      container: new SchemaField({
        isContainer: new BooleanField({
          initial: false,
          label: "BAGS.Items.Physical.Container.IsContainer.Label",
          hint: "BAGS.Items.Physical.Container.IsContainer.Hint",
        }),
        contains: new ArrayField(new DocumentUUIDField({})),
        weightMax: new NumberField({
          min: 0,
          label: "BAGS.Items.Physical.Container.WeightMax.Label",
          hint: "BAGS.Items.Physical.Container.WeightMax.Hint",
        }),
        weightModifier: new NumberField({
          initial: 1,
          label: "BAGS.Items.Physical.Container.WeightModifier.Label",
          hint: "BAGS.Items.Physical.Container.WeightModifier.Hint",
        }),
      }),
      identification: new SchemaField({
        isIdentified: new BooleanField({
          initial: true,
          label: "BAGS.Items.Physical.Identification.IsIdentified.Label",
          hint: "BAGS.Items.Physical.Identification.IsIdentified.Hint",
        }),
        name: new StringField({
          label: "BAGS.Items.Physical.Identification.Name.Label",
          hint: "BAGS.Items.Physical.Identification.Name.Hint",
        }),
        flavorText: new HTMLField({
          label: "BAGS.Items.Physical.Identification.FlavorText.Label",
          hint: "BAGS.Items.Physical.Identification.FlavorText.Hint",
        }),
        description: new HTMLField({
          label: "BAGS.Items.Physical.Identification.Description.Label",
          hint: "BAGS.Items.Physical.Identification.Description.Hint",
        }),
        xpReward: new NumberField({
          initial: 0,
          min: 0,
          label: "BAGS.Items.Physical.Identification.XPReward.Label",
          hint: "BAGS.Items.Physical.Identification.XPReward.Hint",
        }),
      }),
      hasBeenCountedAsTreasure: new BooleanField({
        initial: false,
        label: "BAGS.Items.Physical.HasBeenCountedAsTreasure.Label",
        hint: "BAGS.Items.Physical.HasBeenCountedAsTreasure.Hint",
      }),
      countsAsTreasure: new BooleanField({
        initial: false,
        label: "BAGS.Items.Physical.CountsAsTreasure.Label",
        hint: "BAGS.Items.Physical.CountsAsTreasure.Hint",
      }),
      isEquipped: new BooleanField({ initial: false }),
      areActionsAvailableWhenUnequipped: new BooleanField({ initial: false }),
      areEffectsAppliedWhenUnequipped: new BooleanField({ initial: false }),
    }
  }

  get canUseEffects() {
    return this.areEffectsAppliedWhenUnequipped || this.isEquipped
  }

  get canUseActions() {
    return this.areActionsAvailableWhenUnequipped || this.isEquipped
  }

  /**
   * Get the container that holds this item, if any.
   * Returns null if the item is not stored in a container.
   * @type {Item|null}
   */
  get parentContainer() {
    if (!this.parent?.actor) return null

    return (
      this.parent.actor.items.find((i) =>
        i.system.container?.contains?.includes(this.parent.uuid),
      ) || null
    )
  }

  /**
   * Get all items contained within this container.
   * Automatically filters out invalid/deleted items.
   * Only returns items if this item is marked as a container.
   * @type {Item[]}
   */
  get contents() {
    if (!this.container?.isContainer || !this.parent?.actor) {
      return []
    }

    const actor = this.parent.actor
    const uuids = this.container.contains || []

    return uuids
      .map((uuid) => fromUuidSync(uuid))
      .filter((item) => item && item.actor === actor)
  }

  /**
   * Current weight of all contents in this container.
   * Returns 0 for non-containers or empty containers.
   * TODO: Implement recursive weight calculation with container modifiers
   * @type {number}
   */
  get contentsWeight() {
    if (!this.container?.isContainer) return 0
    // Placeholder - will implement proper weight calculation later
    return 0
  }

  /**
   * Check if this item is currently stored in a container.
   * @type {boolean}
   */
  get isInContainer() {
    return this.parentContainer !== null
  }
}

export default PhysicalItemDataModel
