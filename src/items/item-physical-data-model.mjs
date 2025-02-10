/**
 * @file A subclassable data model that represents physical objects.
 */

const {
  ArrayField,
  NumberField,
  StringField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
  FilePathField,
  BooleanField,
} = foundry.data.fields

const PhysicalItemDataMixin = (schema) =>
  class PhysicalItemDataModel extends foundry.abstract.TypeDataModel {
    static defineSchema() {
      return {
        ...schema,
        quantity: new NumberField({
          min: 0,
          initial: 1,
          label: "BAGS.Items.Physical.Quantity.Label",
          hint: "BAGS.Items.Physical.Quantity.Hint",
        }),
        cost: new NumberField({
          min: 0,
          initial: 1,
          label: "BAGS.Items.Physical.Cost.Label",
          hint: "BAGS.Items.Physical.Cost.Hint",
        }),
        uses: new SchemaField({
          value: new NumberField({
            min: 0,
            initial: 1,
            label: "BAGS.Items.Physical.Uses.Value.Label",
            hint: "BAGS.Items.Physical.Uses.Value.Hint",
          }),
          max: new NumberField({
            min: 0,
            initial: 1,
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
        countsAsTreasure: new BooleanField({
          initial: false,
          label: "BAGS.Items.Physical.CountsAsTreasure.Label",
          hint: "BAGS.Items.Physical.CountsAsTreasure.Hint",
        }),
      }
    }
  }

export default PhysicalItemDataMixin
