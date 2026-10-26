/**
 * @file Initiative rules modules for the Basic/Expert family of games -- B/X,
 * BECMI, and the Rules Cyclopedia, which all handle initiative the same way.
 *
 * Both modules below are the same rules with one axis flipped: does a side roll
 * once, or does everyone roll for themselves? Moldvay presents individual
 * initiative as an option rather than a separate game, and modelling it that way
 * means a table can switch between them from the settings menu.
 *
 * See docs/design/combat-turn-sequence.md for what each field is for.
 */

import { SURPRISE_EFFECT } from "../rules-engines/surprise.mjs"

/**
 * Fields both Basic/Expert modules share.
 *
 * `ruleset` is the tag that declarable action types match against, so a module
 * adding a B/X house rule can name "bx" and have it appear under both modules
 * without touching either. It is deliberately not the module id: "bx-group" and
 * "bx-individual" are two ways of playing one game.
 */
const BASIC_EXPERT = {
  ruleset: "bx",
  /**
   * High roll acts first, and initiative is a whole number -- Foundry's own
   * default of two decimal places would render a d6 result as "4.00".
   */
  direction: "high",
  decimals: 0,
  /**
   * B/X has nothing that shifts one combatant's place within their side: no
   * weapon speed factors, no casting times measured in segments. Every member of
   * a side acts on the side's roll, which is what lets the tracker draw a side
   * as a single block and step past it in one click.
   */
  perMemberOffsets: false,
  /**
   * B/X's one weapon-level initiative rule: a slow weapon loses ties. It is far
   * coarser than the Advanced games' segment counts, and deliberately unrelated
   * to them -- a weapon written for one family is silent in the other rather
   * than half-translated into it.
   *
   * Declared here so the weapon sheet can offer the field only to tables whose
   * rules read it, instead of showing every game every edition's properties.
   */
  usesSlowWeapons: true,
  /**
   * Each side rolls 1d6 when a fight begins, and a 1 or 2 means it was caught
   * off guard. A surprised side does nothing in the first round.
   */
  surprise: { formula: "1d6", surprisedOn: 2, effect: SURPRISE_EFFECT.ROUND },
  /**
   * Each monster rolls 2d6 against its morale rating, and flees or surrenders
   * when the roll is higher.
   */
  morale: { formula: "2d6" },
  /**
   * The steps of a side's turn, in order: B/X has the side that won initiative
   * move, then fire missiles, then cast spells, then fight hand to hand, before
   * the next side does any of it. Each lists the declarations that act in it.
   * A combatant who declared nothing, or something no phase lists, goes last.
   *
   * A combatant who closes and then swings really acts in two phases. The
   * tracker places them once, by what they declared; that is the price of one
   * row per combatant.
   */
  phases: [
    {
      id: "movement",
      label: "BAGS.Combat.Phases.Movement",
      declarations: ["bags.move", "bags.withdraw"],
    },
    {
      id: "missile",
      label: "BAGS.Combat.Phases.Missile",
      declarations: ["bags.missile"],
    },
    {
      id: "magic",
      label: "BAGS.Combat.Phases.Magic",
      declarations: ["bags.cast"],
    },
    {
      id: "melee",
      label: "BAGS.Combat.Phases.Melee",
      declarations: ["bags.melee"],
    },
  ],
}

/**
 * Side initiative: each side rolls 1d6, and the high side acts first.
 *
 * This is the default because it is what the books actually say, and because it
 * is the faster way to run a fight with a dozen goblins in it.
 */
export const bxGroupInitiative = {
  ...BASIC_EXPERT,
  id: "bx-group",
  name: "BX, Group",
  default: true,
  formula: "1d6",
  rollingUnit: "group",
}

/**
 * Individual initiative: everyone rolls 1d6 and adds their Dexterity
 * adjustment.
 *
 * Moldvay offers this as an optional rule. The formula references
 * `@initiative`, which resolves to the combatant's own modifier.
 * @todo `@initiative` does not resolve yet -- `Actor#getRollData` returns
 * `system`, which has no `initiative` property, so Foundry's parser substitutes
 * a zero and the modifier is silently dropped. Wiring it up is document work
 * rather than rules work, and is scheduled with the rest of the document layer.
 */
export const bxIndividualInitiative = {
  ...BASIC_EXPERT,
  id: "bx-individual",
  name: "BX, Individual",
  formula: "1d6+@initiative",
  rollingUnit: "individual",
}

export default [bxGroupInitiative, bxIndividualInitiative]
