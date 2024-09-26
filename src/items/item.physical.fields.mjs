const {
  StringField,
  ArrayField,
  NumberField,
  BooleanField,
  SchemaField,
  DocumentUUIDField,
  HTMLField,
  FilePathField,
} = foundry.data.fields

export const consumedTypeOptions = {
  quantity: "Quantity",
  uses: "Uses",
  self: "Self",
  hp: "User's HP",
  spellslot: "User's Spell slots",
  item: "Item",
  itemuse: "Item Use",
  actionUse: "Action Use",
}

export const actionTypeOptions = {
  attack: "Attack",
  healing: "Healing",
  effect: "Effect",
  misc: "Other",
}

export const actionsFactory = (fields) =>
  new ArrayField(
    new SchemaField({
      img: new FilePathField({
        categories: ["IMAGE"]
      }),
      type: new StringField({
        choices: actionTypeOptions,
      }),
      formula: new StringField({}),
      operator: new StringField({}),
      consumedType: new StringField({
        choices: consumedTypeOptions,
      }),
      consumedItem: new DocumentUUIDField({}),
      description: new HTMLField({}),
      default: new BooleanField({}),
      uses: new SchemaField({
        value: new NumberField({ min: 0, initial: 0 }),
        max: new NumberField({ min: 0, initial: 0 }),
      }),
      ...fields,
    })
  )
