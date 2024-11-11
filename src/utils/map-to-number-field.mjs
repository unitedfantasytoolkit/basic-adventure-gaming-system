/**
 * @file Make a positive integer field out of a key and optional label/hint
 */

const { NumberField } = foundry.data.fields

const mapToNumberField = (obj, [key, { label, hint }]) => ({
  ...obj,
  [key]: new NumberField({
    min: 0,
    nullable: false,
    blank: false,
    initial: 0,
    label,
    hint,
  }),
})

export default mapToNumberField
