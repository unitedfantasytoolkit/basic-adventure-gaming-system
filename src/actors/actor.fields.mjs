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
    /**
     * A creature's exploration speed.
     */
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
    armorClassOffset: new NumberField({
      initial: 0,
      nullable: false,
      label: "",
      hint: "",
    }),
    ...fields,
  })

export const modifiersFactory = (fields) => {
  const savingThrowSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
  )
  return new SchemaField({
    savingThrows: new SchemaField({
      ...Object.keys(savingThrowSettings?.savingThrows || {}).reduce(
        (obj, s) => ({
          ...obj,
          [s]: new NumberField({
            initial: 0,
            label: savingThrowSettings.savingThrows[s].label,
          }),
        }),
        {},
      ),
    }),
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
}

export const retainerFactory = (fields) =>
  new SchemaField({
    isRetainer: new BooleanField({
      initial: false,
      nullable: false,
      label: "",
      hint: "",
    }),
    wage: new SchemaField({
      /**
       * The Item to use as currency for this Actor's wage.
       */
      currency: new DocumentUUIDField({
        type: "Item",
        initial: DEFAULT_GOLD_ITEM_UUID,
        blank: false,
        label: "",
        hint: "",
      }),
      /**
       * How much of this wage is paid.
       */
      quantity: new NumberField({
        min: 0,
        initial: 0,
        blank: false,
        label: "",
        hint: "",
      }),
      /**
       * How often the Actor is paid.
       */
      interval: new StringField({
        initial: "",
        label: "",
        hint: "",
      }),
    }),
    ...fields,
  })

export const hpFactory = (fields) =>
  new SchemaField({
    /**
     * How many HP the Actor has right now.
     */
    value: new NumberField({
      initial: 4,
      blank: false,
      label: "",
      hint: "",
    }),
    /**
     * How many HP the Actor has when fully healed.
     */
    max: new NumberField({
      initial: 4,
      blank: false,
      min: 0,
      label: "",
      hint: "",
    }),
    /**
     * How many temporary HP the Actor has -- a buffer before losing HP.
     */
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
    /**
     * The Actor's alignment. We don't use choices here so users can freely
     * enter whatever they like (Chaotic, Lawful Good, a phase of the moon)
     */
    alignment: new StringField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
    /**
     * A prefix attached to the Actor's name. Examples: "Sir/Dame", "Arbiter",
     * "Agent"
     */
    identityPrefix: new StringField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
    /**
     * A suffix attached to the Actor's name. Examples: "of Clan Bearhair",
     * ", butcher of Bogtown", "the Smelly"
     */
    identitySuffix: new StringField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
    /**
     * A physical description of the Actor.
     */
    description: new HTMLField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
    /**
     * The character's background.
     */
    background: new HTMLField({
      nullable: false,
      initial: "",
      label: "",
      hint: "",
    }),
    ...fields,
  })

export const bannerFactory = () =>
  /**
   * A banner image, used to add some flair to Actors.
   */
  new FilePathField({
    required: false,
    categories: ["IMAGE"],
    initial: "https://placehold.co/600x400/274240/d6cbb3.png",
  })
