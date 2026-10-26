/**
 * @file The data behind a round's chat card.
 *
 * The card carries its own copy of what happened, rather than reading the combat
 * live. That is what makes it a record: declarations are cleared at the top of
 * every round, so a card that looked at the combat would show the *current*
 * round's intentions no matter how far back you scrolled -- and would go blank
 * the moment the round ended.
 *
 * The GM's client keeps this up to date while the round is current. Players
 * cannot: `ChatMessage#getUserLevel` grants ownership only to a message's author,
 * so a player writes their declaration to their own Combatant and the GM mirrors
 * it here. With no GM connected no card is created in the first place, since the
 * round hooks that make one are themselves GM-only.
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const {
  ArrayField,
  BooleanField,
  ColorField,
  NumberField,
  SchemaField,
  StringField,
} = foundry.data.fields

/**
 * One combatant's line on the card.
 * @returns {SchemaField} The member schema.
 */
const memberField = () =>
  new SchemaField({
    /** Kept so the "declare" control knows who it is speaking for. */
    combatantId: new StringField({ required: true, blank: true, initial: "" }),
    name: new StringField({ required: true, blank: true, initial: "" }),
    img: new StringField({ required: true, blank: true, initial: "" }),
    /** The declared action's label and icon, already resolved for display. */
    declarationLabel: new StringField({
      required: true,
      blank: true,
      initial: "",
    }),
    declarationIcon: new StringField({
      required: true,
      blank: true,
      initial: "",
    }),
    /** Whether the declaration came from the mob rather than the combatant. */
    inherited: new BooleanField({ initial: false }),
    /**
     * Which side this combatant fights for, and its colour.
     *
     * Unused in blocks mode, where the block above the member already says both.
     * On a ladder there is no such block -- sides interleave, which is the reason
     * the ladder exists -- so each row carries its own colour, and telling
     * "monster, monster, PC, monster" apart is a matter of glancing down a
     * column rather than reading four names.
     */
    side: new StringField({ required: true, blank: true, initial: "" }),
    color: new ColorField(),
  })

/**
 * One rolling unit's block on the card.
 * @returns {SchemaField} The unit schema.
 */
const unitField = () =>
  new SchemaField({
    name: new StringField({ required: true, blank: true, initial: "" }),
    side: new StringField({ required: true, blank: true, initial: "" }),
    color: new ColorField(),
    /** Null until the unit has rolled. */
    initiative: new NumberField({ required: false, nullable: true }),
    members: new ArrayField(memberField(), { initial: [] }),
  })

/**
 * One segment of a round, and everyone who acts on it.
 * @returns {SchemaField} The segment schema.
 */
const segmentField = () =>
  new SchemaField({
    segment: new NumberField({
      required: true,
      nullable: false,
      integer: true,
      initial: 1,
    }),
    members: new ArrayField(memberField(), { initial: [] }),
  })

/**
 * How a card draws itself.
 *
 * **Stored, never re-resolved.** `captureRound` reads the rules in force when it
 * captures, but the template runs whenever anyone scrolls back -- so a GM who
 * switches rulesets mid-campaign would otherwise re-render every old card
 * through the new mode, and a card describing a B/X fight would try to draw
 * itself as a segment ladder it has no data for.
 * @readonly
 * @enum {string}
 */
export const ROUND_CARD_MODE = Object.freeze({
  /** One block per side, each carrying its roll. The Basic/Expert family. */
  BLOCKS: "blocks",
  /** Segments in ascending order, each listing who acts on it. AD&D. */
  LADDER: "ladder",
})

/**
 * The data model for a round summary chat card.
 */
export default class BAGSChatRoundDataModel extends foundry.abstract
  .TypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      /** Which encounter, so the card can tell whether it is still current. */
      combatId: new StringField({ required: true, blank: true, initial: "" }),
      round: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 1,
      }),
      /** Whether declarations were being used, so the card knows to invite one. */
      declarationsOpen: new BooleanField({ initial: false }),
      /**
       * Which of the two layouts below holds this card's data. Defaults to
       * blocks, which is what every card written before the ladder existed is.
       */
      mode: new StringField({
        required: true,
        blank: false,
        initial: ROUND_CARD_MODE.BLOCKS,
        choices: Object.values(ROUND_CARD_MODE),
      }),
      /** Blocks mode: the turn order, in the order units act. */
      units: new ArrayField(unitField(), { initial: [] }),
      /**
       * Ladder mode: the round's segments, ascending.
       *
       * A combatant appears once per attack, so a fighter acting on segments 3
       * and 8 is on the ladder twice. That costs nothing here -- this is captured
       * display data, with no bearing on the turn cursor -- and it is the only
       * place a second attack is visible at all (§10.3).
       */
      segments: new ArrayField(segmentField(), { initial: [] }),
      /**
       * Ladder mode: combatants with no segment yet.
       *
       * A combatant who has not declared cannot be placed, because their action
       * is what decides when they act. They wait at the foot of the card, which
       * is also the natural home for the invitation to declare -- and it makes
       * the initiative gating legible, since the ladder stays empty and this
       * stays full until the table has committed.
       */
      pending: new ArrayField(memberField(), { initial: [] }),
    }
  }

  template = `${SYSTEM_TEMPLATE_PATH}/chat-cards/round.hbs`
}
