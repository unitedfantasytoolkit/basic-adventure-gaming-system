/**
 * @file The system configuration file for the Basic/Expert Adventure Game.
 *
 * You can use this configuration file as a template for other Basic/Expert
 * derived systems..
 */

import abilityScores from "./bx.ability-scores.mjs"

/**
 * @typedef SystemDefinition
 * @property {unknown} abilityScores Configuration for this system's core
 * stats. For most games in the B/X lineage, you'll have six stats here.
 * @property {unknown} savingThrows Configuration for this system's saving
 * throws. For most games in the B/X lineage, you'll have five saving throws.
 * @property {SystemSettingsCharacterClass} characterClass System-specific
 * character class config
 * @property {unknown} recommendedSettings A recommended set of Foundry system
 * configuration changes, used to provide defaults.
 */

/**
 * Configuration for how this system handles
 * character classes -- including whether XP bonuses/penalties from prime
 * requisites are applied (and at what rate), how many classes a character can
 * have, and how XP is distributed between classes. For most games in the B/X
 * lineage, you'll use prime requisites for bonuses and penalties to XP, and
 * multiclassing isn't allowed.
 * @typedef SystemSettingsCharacterClass
 * @property {number} count How many classes can a character have?
 * @property {unknown} xpShareType How is XP shared between classes?
 * @property {boolean} canTransferXP If the character changes classes, is their
 * XP transferred to the new class?
 */

/**
 * The system definition for the Basic/Expert Adventure Game.
 * @type {SystemDefinition}
 */
const BXSystem = {
  name: "bx",
  title: "BAGS.BX.Name",
  abilityScores,
  savingThrows: {
    categories: {
      deathPoison: {
        displayName: "BAGS.BX.Saves.DeathPoison.Label",
        description: "BAGS.BX.Saves.DeathPoison.Description",
      },
      wands: {
        displayName: "BAGS.BX.Saves.Wands.Label",
        description: "BAGS.BX.Saves.Wands.Description",
      },
      paralysis: {
        displayName: "BAGS.BX.Saves.Paralysis.Label",
        description: "BAGS.BX.Saves.Paralysis.Description",
      },
      breath: {
        displayName: "BAGS.BX.Saves.Breath.Label",
        description: "BAGS.BX.Saves.Breath.Description",
      },
      spells: {
        displayName: "BAGS.BX.Saves.Spells.Label",
        description: "BAGS.BX.Saves.Spells.Description",
      },
    },
    /**
     * Mappings are specific relationships between known systems' types of
     * saving throws. For example, a Death save in BX might be a Doom or
     * Physical save in another system.
     *
     * We use this mapping to help smooth out converting saving throws from one
     * system to another.
     *
     * If a mapping doesn't exist, we'll fall back to asking the GM to pick
     * which saving throw to use.
     */
    mappings: {
      wwn: {
        deathPoison: ["physical"],
        wands: ["mental"],
        paralysis: ["physical"],
        breath: ["evasion"],
        spells: ["mental"],
      },
    },
  },
}

export default BXSystem
