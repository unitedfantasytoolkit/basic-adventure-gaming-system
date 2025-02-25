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
      label: "BAGS.Actors.Common.Fields.Base.Speed.Label",
      hint: "BAGS.Actors.Common.Fields.Base.Speed.Hint",
    }),
    /**
     * Encompasses ascending AC attack bonus and descending AC THAC0
     */
    attackRollOffset: new NumberField({
      min: 0,
      nullable: false,
      initial: 0,
      label: "BAGS.Actors.Common.Fields.Base.AttackRollOffset.Label",
      hint: "BAGS.Actors.Common.Fields.Base.AttackRollOffset.Hint",
    }),
    /**
     * Encompasses ascending and descending AC by being an offset from
     * the settings-defined THAC0 base *or* 0
     */
    armorClassOffset: new NumberField({
      initial: 0,
      nullable: false,
      label: "BAGS.Actors.Common.Fields.Base.ArmorClassOffset.Label",
      hint: "BAGS.Actors.Common.Fields.Base.ArmorClassOffset.Hint",
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
        label: "BAGS.Actors.Common.Fields.Modifiers.Melee.Attack.Label",
        hint: "BAGS.Actors.Common.Fields.Modifiers.Melee.Attack.Hint",
      }),
      damage: new NumberField({
        initial: 0,
        nullable: false,
        label: "BAGS.Actors.Common.Fields.Modifiers.Melee.Damage.Label",
        hint: "BAGS.Actors.Common.Fields.Modifiers.Melee.Damage.Hint",
      }),
    }),
    missile: new SchemaField({
      attack: new NumberField({
        initial: 0,
        nullable: false,
        label: "BAGS.Actors.Common.Fields.Modifiers.Missile.Attack.Label",
        hint: "BAGS.Actors.Common.Fields.Modifiers.Missile.Attack.Hint",
      }),
      damage: new NumberField({
        initial: 0,
        nullable: false,
        label: "BAGS.Actors.Common.Fields.Modifiers.Missile.Damage.Label",
        hint: "BAGS.Actors.Common.Fields.Modifiers.Missile.Damage.Hint",
      }),
    }),
    initiative: new NumberField({
      initial: 0,
      nullable: false,
      label: "BAGS.Actors.Common.Fields.Modifiers.Initiative.Label",
      hint: "BAGS.Actors.Common.Fields.Modifiers.Initiative.Hint",
    }),
    loyalty: new NumberField({
      min: 0,
      nullable: false,
      initial: 7,
      label: "BAGS.Actors.Common.Fields.Modifiers.Loyalty.Label",
      hint: "BAGS.Actors.Common.Fields.Modifiers.Loyalty.Hint",
    }),
    ...fields,
  })
}

export const retainerFactory = (fields) =>
  new SchemaField({
    isRetainer: new BooleanField({
      initial: false,
      nullable: false,
      label: "BAGS.Actors.Common.Fields.Retainer.IsRetainer.Label",
      hint: "BAGS.Actors.Common.Fields.Retainer.IsRetainer.Hint",
    }),
    wage: new SchemaField({
      /**
       * The Item to use as currency for this Actor's wage.
       */
      currency: new DocumentUUIDField({
        type: "Item",
        initial: DEFAULT_GOLD_ITEM_UUID,
        blank: false,
        label: "BAGS.Actors.Common.Fields.Retainer.Wage.Currency.Label",
        hint: "BAGS.Actors.Common.Fields.Retainer.Wage.Currency.Hint",
      }),
      /**
       * How much of this wage is paid.
       */
      quantity: new NumberField({
        min: 0,
        initial: 0,
        blank: false,
        label: "BAGS.Actors.Common.Fields.Retainer.Wage.Quantity.Label",
        hint: "BAGS.Actors.Common.Fields.Retainer.Wage.Quantity.Hint",
      }),
      /**
       * How often the Actor is paid.
       */
      interval: new StringField({
        initial: "",
        label: "BAGS.Actors.Common.Fields.Retainer.Wage.Interval.Label",
        hint: "BAGS.Actors.Common.Fields.Retainer.Wage.Interval.Hint",
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
      label: "BAGS.Actors.Common.Fields.HP.Value.Label",
      hint: "BAGS.Actors.Common.Fields.HP.Value.Hint",
    }),
    /**
     * How many HP the Actor has when fully healed.
     */
    max: new NumberField({
      initial: 4,
      blank: false,
      min: 0,
      label: "BAGS.Actors.Common.Fields.HP.Max.Label",
      hint: "BAGS.Actors.Common.Fields.HP.Max.Hint",
    }),
    /**
     * How many temporary HP the Actor has -- a buffer before losing HP.
     */
    temporary: new NumberField({
      initial: 0,
      blank: false,
      min: 0,
      label: "BAGS.Actors.Common.Fields.HP.Temporary.Label",
      hint: "BAGS.Actors.Common.Fields.HP.Temporary.Hint",
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
      label: "BAGS.Actors.Common.Fields.BiographicalDetails.Alignment.Label",
      hint: "BAGS.Actors.Common.Fields.BiographicalDetails.Alignment.Hint",
    }),
    /**
     * A prefix attached to the Actor's name. Examples: "Sir/Dame", "Arbiter",
     * "Agent"
     */
    identityPrefix: new StringField({
      nullable: false,
      initial: "",
      label: "BAGS.Actors.Common.Fields.BiographicalDetails.IdentityPrefix.Label",
      hint: "BAGS.Actors.Common.Fields.BiographicalDetails.IdentityPrefix.Hint",
    }),
    /**
     * A suffix attached to the Actor's name. Examples: "of Clan Bearhair",
     * ", butcher of Bogtown", "the Smelly"
     */
    identitySuffix: new StringField({
      nullable: false,
      initial: "",
      label: "BAGS.Actors.Common.Fields.BiographicalDetails.IdentitySuffix.Label",
      hint: "BAGS.Actors.Common.Fields.BiographicalDetails.IdentitySuffix.Hint",
    }),
    /**
     * A physical description of the Actor.
     */
    description: new HTMLField({
      nullable: false,
      initial: "",
      label: "BAGS.Actors.Common.Fields.BiographicalDetails.Description.Label",
      hint: "BAGS.Actors.Common.Fields.BiographicalDetails.Description.Hint",
    }),
    /**
     * The character's background.
     */
    background: new HTMLField({
      nullable: false,
      initial: "",
      label: "BAGS.Actors.Common.Fields.BiographicalDetails.Background.Label",
      hint: "BAGS.Actors.Common.Fields.BiographicalDetails.Background.Hint",
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
    label: "BAGS.Actors.Common.Fields.Banner.Label",
    hint: "BAGS.Actors.Common.Fields.Banner.Hint",
  })
