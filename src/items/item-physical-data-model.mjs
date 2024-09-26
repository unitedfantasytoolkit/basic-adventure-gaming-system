/**
 * @file A subclassable data model that represents physical objects.
 */

const {
  NumberField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
  FilePathField,
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
          uuid: new DocumentUUIDField({}),
        }),
        weight: new NumberField({ min: 0, initial: 0 }),
        description: new HTMLField({}),
        banner: new FilePathField({
          categories: ["IMAGE"],
        }),
        containerUUID: new DocumentUUIDField({}),
      }
    }
  }

export default PhysicalItemDataMixin
