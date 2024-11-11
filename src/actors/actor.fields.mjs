/**
 * @file A subclassable data model that represents physical objects.
 */

import { DEFAULT_GOLD_ITEM_UUID } from "../config/constants.mjs"

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

export const saveOptions = {
  min: 0,
  nullable: false,
  blank: false,
  initial: 0,
}

export const baseFactory = (fields) =>
  new SchemaField({
    speed: new NumberField({
      min: 0,
      nullable: false,
      initial: 120,
      label: "",
      hint: "",
    }),
    /**
     * Encompasses ascending AC attack bonus and descending AC THAC0
     */
    attackRollOffset: new NumberField({
      min: 0,
      nullable: false,
      initial: 0,
      label: "",
      hint: "",
    }),
    /**
     * Encompasses ascending and descending AC by being an offset from
     * the settings-defined THAC0 base *or* 0
     */
    acOffset: new NumberField({
      initial: 0,
      nullable: false,
      label: "",
      hint: "",
    }),
    ...fields,
  })

export const modifiersFactory = (fields) =>
  new SchemaField({
    melee: new SchemaField({
      attack: new NumberField({
        initial: 0,
        nullable: false,
        label: "",
        hint: "",
      }),
      damage: new NumberField({
        initial: 0,
        nullable: false,
        label: "",
        hint: "",
      }),
    }),
    missile: new SchemaField({
      attack: new NumberField({
        initial: 0,
        nullable: false,
        label: "",
        hint: "",
      }),
      damage: new NumberField({
        initial: 0,
        nullable: false,
        label: "",
        hint: "",
      }),
    }),
    initiative: new NumberField({
      initial: 0,
      nullable: false,
      label: "",
      hint: "",
    }),
    loyalty: new NumberField({
      min: 0,
      nullable: false,
      initial: 7,
      label: "",
      hint: "",
    }),
    ...fields,
  })

export const retainerFactory = (fields) =>
  new SchemaField({
    isRetainer: new BooleanField({
      initial: false,
      nullable: false,
      label: "",
      hint: "",
    }),
    wage: new SchemaField({
      currency: new DocumentUUIDField({
        type: "Item",
        initial: DEFAULT_GOLD_ITEM_UUID,
        blank: false,
        label: "",
        hint: "",
      }),
      quantity: new NumberField({
        min: 0,
        initial: 0,
        blank: false,
        label: "",
        hint: "",
      }),
    }),
    ...fields,
  })

export const hpFactory = (fields) =>
  new SchemaField({
    value: new NumberField({
      initial: 4,
      blank: false,
      label: "",
      hint: "",
    }),
    max: new NumberField({
      initial: 4,
      blank: false,
      min: 0,
      label: "",
      hint: "",
    }),
    temporary: new NumberField({
      initial: 0,
      blank: false,
      min: 0,
      label: "",
      hint: "",
    }),
    ...fields,
  })

export const biographicalDetailsFactory = (fields) =>
  new SchemaField({
    alignment: new StringField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
    identity: new StringField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
    description: new HTMLField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
    ...fields,
  })

export const bannerFactory = () =>
  new FilePathField({
    required: false,
    categories: ["IMAGE"],
    initial: "https://placehold.co/600x400/274240/d6cbb3.png",
  })
