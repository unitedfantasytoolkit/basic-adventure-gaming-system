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
        }),
        value: new NumberField({
          min: 0,
          initial: 1,
        }),
        uses: new SchemaField({
          value: new NumberField({ min: 0, initial: 1 }),
          max: new NumberField({ min: 0, initial: 1 }),
        }),
        weight: new NumberField({ min: 0, initial: 0 }),
        description: new HTMLField({}),
        flavorText: new HTMLField({}),
        banner: new FilePathField({
          categories: ["IMAGE"],
        }),
        container: new SchemaField({
          isContainer: new BooleanField({ initial: false }),
          contains: new ArrayField(new DocumentUUIDField({})),
          weightMax: new NumberField(),
          weightModifier: new NumberField({ initial: 1 }),
        }),
        identification: new SchemaField({
          isIdentified: new BooleanField({ initial: true }),
          name: new StringField(),
          description: new HTMLField(),
          xpReward: new NumberField({ initial: 0, min: 0 }),
        }),
        countsAsTreasure: new BooleanField({ initial: false }),
      }
    }
  }

export default PhysicalItemDataMixin
