/**
 * @file A worked example of a party, built from code, for exercising the system.
 *
 * Every feature in BAGS is easy to test in isolation and hard to *look* at
 * together. A character sheet only tells you whether the Actions tab reads well
 * once there's a class with banded abilities on it, a couple of weapons, a wand
 * with charges left and a wand with none. Building that by hand every time the
 * schema changes is the sort of chore that quietly stops happening.
 *
 * So this file builds it. `game.bags.createSampleData()` drops a complete,
 * deliberately awkward set of documents into the world: classes whose abilities
 * arrive and expire at different levels, gear that is and isn't in use, spells
 * on class lists, a spent ability next to an unspent one, and characters wearing
 * all of it. `game.bags.deleteSampleData()` takes it all back out again.
 *
 * Everything created is tagged with a flag rather than a name prefix, so the
 * documents can be named the way real content would be and still be found and
 * removed as a set.
 *
 * This is development-only: `src/index.mjs` registers it inside `devOnly`, so
 * rollup drops the whole module from a production build.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"

/**
 * The flag that marks a document as ours to clean up.
 * @type {string}
 */
const SAMPLE_FLAG = "isSampleData"

/**
 * Creation data marking a document as sample data.
 * @type {object}
 */
const flagged = { flags: { [SYSTEM_NAME]: { [SAMPLE_FLAG]: true } } }

// === Schema helpers ==========================================================

/**
 * Build a complete action from the handful of fields a sample cares about.
 *
 * Actions are a deep schema with a lot of required structure. Rather than write
 * that out a dozen times, this starts from the real schema's own initial value,
 * so a sample can never drift away from what the system actually stores.
 * @param {object} overrides - The parts of the action worth spelling out
 * @returns {object} A complete action
 */
function action(overrides = {}) {
  const initial =
    CONFIG.Item.dataModels.item.schema.fields.actions.element.getInitialValue()

  return foundry.utils.mergeObject(
    { ...initial, id: foundry.utils.randomID() },
    overrides,
    { inplace: false },
  )
}

/**
 * An action gated to a band of levels.
 *
 * This is how a class ability that changes as you advance is modelled: not one
 * action that rewrites itself, but several, each covering the levels it applies
 * to. An assassin's chance to assassinate and a cleric's turning table both work
 * this way, and only the band matching the class's current level is offered.
 * @param {object} options - The action's details
 * @param {string} options.name - What the ability is called
 * @param {string} options.description - What it does at this band
 * @param {number} [options.min] - The lowest level it applies at
 * @param {number} [options.max] - The highest
 * @param {number} options.target - The number the roll is measured against
 * @param {string} [options.formula] - The roll, if not a d20
 * @returns {object} The action
 */
function bandedAction({
  name,
  description,
  min,
  max,
  target,
  formula = "1d20",
}) {
  return action({
    name,
    description,
    level: { min, max },
    flags: { usesAttempt: true, usesEffect: false, usesRestrictions: true },
    attempt: {
      flags: { isLikeAttack: false },
      roll: { formula, operator: ">=", target },
    },
  })
}

/**
 * An action with a limited number of uses.
 * @param {object} options - The action's details
 * @param {string} options.name - What it's called
 * @param {string} options.description - What it does
 * @param {number} options.max - How many uses it has when full
 * @param {number} options.value - How many are left
 * @param {string} [options.rechargesOn] - When they come back
 * @returns {object} The action
 */
function limitedAction({
  name,
  description,
  max,
  value,
  rechargesOn = "perDay",
}) {
  return action({
    name,
    description,
    flags: { usesAttempt: false, usesEffect: false, usesConsumption: true },
    uses: { value, max, rechargesOn },
    consumption: { type: "actionUse" },
  })
}

/**
 * Build an experience table of the given length.
 *
 * Real classes have hand-tuned tables; a sample only needs one that advances
 * sensibly, so this doubles the requirement each level, improves THAC0 by one
 * every other level, and improves every save by one every three.
 * @param {object} options - Options for the table
 * @param {number} options.levels - How many rows
 * @param {number} options.firstLevelCost - Experience to reach 2nd level
 * @param {number} [options.hitDiceStopAt] - The level hit dice stop being rolled
 * @returns {object[]} The experience table
 */
function xpTable({ levels, firstLevelCost, hitDiceStopAt = Infinity }) {
  const saveKeys = Object.keys(
    CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
      CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
    ).savingThrows,
  )

  return Array.from({ length: levels }, (_, index) => {
    const level = index + 1

    return {
      // First level always costs nothing to reach.
      value: index === 0 ? 0 : firstLevelCost * 2 ** (index - 1),
      attackBonus: Math.floor(index / 2),
      thac0: 19 - Math.floor(index / 2),
      hd: {
        count: Math.min(level, hitDiceStopAt),
        modifier: level > hitDiceStopAt ? (level - hitDiceStopAt) * 2 : 0,
        canUseConMod: level <= hitDiceStopAt,
      },
      saves: saveKeys.reduce(
        (obj, key) => ({ ...obj, [key]: 14 - Math.floor(index / 3) }),
        {},
      ),
    }
  })
}

/**
 * Spell slots as the class schema wants them: slot counts by spell level, each
 * an array indexed by character level.
 * @param {number[][]} rows - One row per spell level
 * @returns {number[][]} The same thing, for readability at the call site
 */
const slots = (rows) => rows

/**
 * A weapon's default attack, rolling the given damage.
 *
 * The whole default attack has to be spelled out rather than just the damage,
 * because `system.attack` is a SchemaField with a hand-built `initial` -- a
 * partial value doesn't merge into that default, it gets filled in from each
 * own initial for each field instead, which quietly renames "Attack" to "New
 * Action"
 * and drops the sword icon. Starting from the schema's own initial value keeps
 * the sample honest without hardcoding either.
 * @param {string} formula - The damage dice
 * @returns {object} A complete attack action
 */
function weaponAttack(formula) {
  const initial =
    CONFIG.Item.dataModels.weapon.schema.fields.attack.getInitialValue()

  return foundry.utils.mergeObject(
    initial,
    { effects: [{ ...initial.effects[0], formula }] },
    { inplace: false },
  )
}

// === The content =============================================================

/**
 * The classes. Each one exists to exercise something different.
 * @returns {object[]} Item creation data
 */
function classData() {
  return [
    {
      ...flagged,
      name: "Fighter",
      type: "class",
      system: {
        description:
          "<p>Fighters are the front line: the best armour, the best weapons, and the most hit points to spend on being wrong about a corridor.</p>",
        flavorText: "Nothing fancy. Nothing left standing.",
        hitDieSize: 8,
        manuallySetLevel: 6,
        xp: 42000,
        weapons: "Any",
        armor: "Any, including shields",
        fullPrimeRequisites: { str: 13, isAnd: true },
        halfPrimeRequisites: { str: 9, isAnd: true },
        xpTable: xpTable({ levels: 9, firstLevelCost: 2000, hitDiceStopAt: 9 }),
        actions: [
          // A single unbanded ability, so the tab has something that is simply
          // always there to compare the banded ones against.
          action({
            name: "Press the Attack",
            description:
              "<p>Give up your movement to attack a second time this round.</p>",
            flags: { usesAttempt: true, usesEffect: false },
            attempt: {
              flags: { isLikeAttack: true },
              attack: { type: "melee", bonus: 0 },
            },
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Thief",
      type: "class",
      system: {
        description:
          "<p>Thieves get into places other people have sensibly locked, and out of them again before anyone counts the silver.</p>",
        flavorText: "The lock was already open. Probably.",
        hitDieSize: 4,
        manuallySetLevel: 3,
        xp: 3000,
        weapons: "Dagger, sling, short sword",
        armor: "Leather only, no shields",
        fullPrimeRequisites: { dex: 13, isAnd: true },
        xpTable: xpTable({ levels: 9, firstLevelCost: 1200 }),
        actions: [
          action({
            name: "Pick Locks",
            description: "<p>One attempt per lock, per thief.</p>",
            flags: { usesAttempt: true, usesEffect: false },
            attempt: { roll: { formula: "1d100", operator: "<=", target: 25 } },
          }),
          // Arrives partway up the table, so a 3rd-level thief can't see it.
          bandedAction({
            name: "Read Scrolls",
            description:
              "<p>Cast from a magic-user scroll, with a chance of catastrophe.</p>",
            min: 10,
            target: 10,
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Assassin",
      type: "class",
      system: {
        description:
          "<p>An assassin strikes once, from behind, and is somewhere else by the time anyone looks up.</p>",
        flavorText: "Paid in advance.",
        hitDieSize: 6,
        manuallySetLevel: 5,
        xp: 22000,
        weapons: "Any",
        armor: "Leather, studded leather",
        fullPrimeRequisites: { dex: 12, isAnd: true },
        xpTable: xpTable({ levels: 9, firstLevelCost: 1500 }),
        actions: [
          // The example the whole level-band mechanism exists for: one ability
          // whose target number improves as the assassin advances, modelled as
          // one action per band so only the current one is ever offered.
          bandedAction({
            name: "Assassinate",
            description:
              "<p>A surprise strike from behind kills outright rather than dealing damage.</p>",
            min: 1,
            max: 4,
            target: 50,
            formula: "1d100",
          }),
          bandedAction({
            name: "Assassinate",
            description:
              "<p>A surprise strike from behind kills outright rather than dealing damage. The assassin's practised eye finds the gap faster.</p>",
            min: 5,
            max: 8,
            target: 35,
            formula: "1d100",
          }),
          bandedAction({
            name: "Assassinate",
            description:
              "<p>A surprise strike from behind kills outright rather than dealing damage. Few survive an assassin of this standing.</p>",
            min: 9,
            target: 20,
            formula: "1d100",
          }),
          action({
            name: "Disguise",
            description: "<p>Pass as someone else for as long as it holds.</p>",
            flags: { usesAttempt: true, usesEffect: false },
            attempt: { roll: { formula: "1d100", operator: "<=", target: 92 } },
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Cleric",
      type: "class",
      system: {
        description:
          "<p>Clerics hold the line between the living and whatever is trying to stop being dead.</p>",
        flavorText: "Faith, and a very heavy mace.",
        hitDieSize: 6,
        manuallySetLevel: 4,
        xp: 6000,
        weapons: "Blunt weapons only",
        armor: "Any, including shields",
        fullPrimeRequisites: { wis: 13, isAnd: true },
        traditionId: "divine",
        xpTable: xpTable({ levels: 9, firstLevelCost: 1500 }),
        // No 1st-level slots until 2nd level, which is the usual B/X shape.
        spellSlots: slots([
          [0, 1, 2, 2, 3, 3, 4],
          [0, 0, 0, 1, 2, 2, 2],
        ]),
        actions: [
          // The other banded case: turning improves in steps, and the step you
          // are on is the only one you should be looking at.
          bandedAction({
            name: "Turn Undead",
            description:
              "<p>Drive off the lesser undead. Skeletons and zombies only.</p>",
            min: 1,
            max: 3,
            target: 10,
          }),
          bandedAction({
            name: "Turn Undead",
            description:
              "<p>Drive off undead up to and including ghouls and wights.</p>",
            min: 4,
            max: 6,
            target: 7,
          }),
          bandedAction({
            name: "Turn Undead",
            description:
              "<p>Drive off, and sometimes destroy outright, undead of real standing.</p>",
            min: 7,
            target: 4,
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Magic-User",
      type: "class",
      system: {
        description:
          "<p>Magic-users are weak, poorly armoured, and the reason the party survives past the second room.</p>",
        flavorText: "One spell. Make it count.",
        hitDieSize: 4,
        manuallySetLevel: 3,
        xp: 5000,
        weapons: "Dagger only",
        armor: "None",
        fullPrimeRequisites: { int: 13, isAnd: true },
        traditionId: "arcane",
        xpTable: xpTable({ levels: 9, firstLevelCost: 2500 }),
        spellSlots: slots([
          [1, 2, 2, 3, 3, 4],
          [0, 0, 1, 2, 2, 3],
          [0, 0, 0, 0, 1, 2],
        ]),
      },
    },
  ]
}

/**
 * The spells. Enough to fill a couple of levels of two different traditions.
 * @returns {object[]} Item creation data
 */
function spellData() {
  const spell = (name, level, traditionId, extra = {}) => ({
    ...flagged,
    name,
    type: "spell",
    system: {
      level,
      traditionId,
      source: "Sample Data",
      ...extra,
    },
  })

  return [
    spell("Magic Missile", 1, "arcane", {
      description:
        "<p>A dart of force streaks unerringly to a target within range.</p>",
      entry: { range: "150'", duration: "Instantaneous", castingTime: "1" },
      schools: ["Evocation"],
    }),
    spell("Sleep", 1, "arcane", {
      description:
        "<p>Up to 2d8 hit dice of creatures fall asleep, no save.</p>",
      entry: {
        range: "240'",
        duration: "4d4 turns",
        savingThrow: "None",
        areaOfEffect: "40' square",
      },
      schools: ["Enchantment"],
    }),
    spell("Charm Person", 1, "arcane", {
      description: "<p>The target regards the caster as a trusted friend.</p>",
      entry: { range: "120'", duration: "Special", savingThrow: "Spells" },
      schools: ["Enchantment"],
    }),
    spell("Fireball", 3, "arcane", {
      description: "<p>A roaring sphere of flame, 1d6 damage per level.</p>",
      entry: {
        range: "240'",
        duration: "Instantaneous",
        savingThrow: "Spells for half",
        areaOfEffect: "20' radius",
      },
      schools: ["Evocation"],
    }),
    spell("Cure Light Wounds", 1, "divine", {
      description:
        "<p>Restores 1d6+1 hit points, or cures paralysis. Reversible.</p>",
      entry: { range: "Touch", duration: "Instantaneous" },
      isReversible: true,
    }),
    spell("Protection from Evil", 1, "divine", {
      description:
        "<p>A ward that hostile creatures must push through to reach you.</p>",
      entry: { range: "Caster", duration: "12 turns" },
    }),
    spell("Hold Person", 2, "divine", {
      description: "<p>Up to four humanoids are held rigid.</p>",
      entry: { range: "180'", duration: "9 turns", savingThrow: "Paralysis" },
    }),
  ]
}

/**
 * The gear. Deliberately uneven: some of it has actions, some doesn't, some is
 * in use and some is in the pack.
 * @returns {object[]} Item creation data
 */
function gearData() {
  return [
    // --- Weapons -------------------------------------------------------------
    {
      ...flagged,
      name: "Longsword",
      type: "weapon",
      system: {
        description: "<p>An arming sword, well kept.</p>",
        cost: 10,
        weight: 60,
        isEquipped: true,
        attack: weaponAttack("1d8"),
      },
    },
    {
      ...flagged,
      name: "Halberd",
      type: "weapon",
      system: {
        description: "<p>Long, heavy, and awkward indoors.</p>",
        cost: 7,
        weight: 150,
        isSlow: true,
        attack: weaponAttack("1d10"),
        // The multi-action weapon: proof that a weapon isn't always one row.
        actions: [
          action({
            name: "Set Against Charge",
            description:
              "<p>Brace the haft. Double damage against anything that closes with you.</p>",
            flags: { usesAttempt: true, usesEffect: false },
            attempt: {
              flags: { isLikeAttack: true },
              attack: { type: "melee", bonus: 0 },
            },
          }),
          action({
            name: "Hook and Trip",
            description:
              "<p>Put an opponent on the floor instead of hurting them.</p>",
            flags: { usesAttempt: true, usesEffect: false },
            attempt: {
              flags: { isLikeAttack: true },
              attack: { type: "melee", bonus: -2 },
            },
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Short Bow",
      type: "weapon",
      system: {
        description: "<p>Needs both hands and a clear line.</p>",
        cost: 25,
        weight: 30,
        attack: foundry.utils.mergeObject(
          weaponAttack("1d6"),
          { attempt: { attack: { type: "missile", bonus: 0 } } },
          { inplace: false },
        ),
        range: { short: 50, medium: 100, long: 150 },
      },
    },
    {
      ...flagged,
      name: "Dagger +1",
      type: "weapon",
      system: {
        description: "<p>Faintly warm to the touch.</p>",
        cost: 3,
        weight: 10,
        isEquipped: true,
        isMagical: true,
        damageBonus: 1,
        attack: weaponAttack("1d4"),
      },
    },

    // --- Armor ---------------------------------------------------------------
    {
      ...flagged,
      name: "Chain Mail",
      type: "armor",
      system: {
        description: "<p>Riveted rings over a padded coat.</p>",
        cost: 40,
        weight: 400,
        armorBonus: 4,
        isEquipped: true,
      },
    },
    {
      ...flagged,
      name: "Shield",
      type: "armor",
      system: {
        description: "<p>A banded round shield.</p>",
        cost: 10,
        weight: 100,
        armorBonus: 1,
        shouldTreatAsBonus: true,
        isEquipped: true,
        // Armour with an action -- the case the Actions tab used to ignore.
        actions: [
          action({
            name: "Shield Bash",
            description:
              "<p>Drive the boss of the shield into someone's face. No damage bonus.</p>",
            flags: { usesAttempt: true, usesEffect: true },
            attempt: {
              flags: { isLikeAttack: true },
              attack: { type: "melee", bonus: -1 },
            },
            effects: [
              {
                id: foundry.utils.randomID(),
                name: "Impact",
                type: "attack",
                formula: "1d3",
              },
            ],
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Leather Armor",
      type: "armor",
      system: {
        description: "<p>Boiled and shaped. Quiet, at least.</p>",
        cost: 20,
        weight: 200,
        armorBonus: 2,
      },
    },

    // --- Items ---------------------------------------------------------------
    {
      ...flagged,
      name: "Backpack",
      type: "item",
      system: {
        description: "<p>Canvas, with too many straps.</p>",
        cost: 5,
        weight: 20,
        container: { isContainer: true },
      },
    },
    {
      ...flagged,
      name: "Iron Rations",
      type: "item",
      system: {
        description: "<p>A week of it. Nobody enjoys this.</p>",
        cost: 15,
        weight: 70,
        quantity: 2,
      },
    },
    {
      ...flagged,
      name: "Rope, 50'",
      type: "item",
      system: { description: "<p>Hemp.</p>", cost: 1, weight: 50 },
    },
    {
      ...flagged,
      name: "Wand of Sparks",
      type: "item",
      system: {
        description: "<p>Yew, and slightly scorched at the tip.</p>",
        cost: 500,
        weight: 10,
        isMagical: true,
        // Usable without being "worn" -- the flag nothing read until now.
        areActionsAvailableWhenUnequipped: true,
        actions: [
          limitedAction({
            name: "Zap",
            description: "<p>A spark leaps out for 1d6 damage.</p>",
            max: 7,
            value: 4,
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Horn of Blasting",
      type: "item",
      system: {
        description: "<p>Brass, dented, and far too loud.</p>",
        cost: 1200,
        weight: 20,
        isEquipped: true,
        isMagical: true,
        actions: [
          // Spent, so the tab has something to grey out.
          limitedAction({
            name: "Sound the Horn",
            description:
              "<p>A blast of thunder for 2d6 damage in a 100' cone.</p>",
            max: 2,
            value: 0,
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Potion of Healing",
      type: "item",
      system: {
        description: "<p>Tastes of iron and mint.</p>",
        cost: 200,
        weight: 10,
        quantity: 2,
        isMagical: true,
        actions: [
          action({
            name: "Drink",
            description: "<p>Restores 1d6+1 hit points.</p>",
            flags: {
              usesAttempt: false,
              usesEffect: true,
              usesConsumption: true,
            },
            consumption: { type: "selfQuantity" },
            effects: [
              {
                id: foundry.utils.randomID(),
                name: "Healing",
                type: "healing",
                formula: "1d6+1",
              },
            ],
          }),
        ],
      },
    },
  ]
}

/**
 * The ancestries and loose abilities that hang off a character.
 * @returns {object[]} Item creation data
 */
function abilityData() {
  return [
    {
      ...flagged,
      name: "Halfling",
      type: "identity",
      system: {
        description:
          "<p>Small, sure-footed, and much harder to hit than they look.</p>",
        actions: [
          action({
            name: "Hide in Undergrowth",
            description:
              "<p>Vanish outdoors with 90% reliability, if there's cover.</p>",
            flags: { usesAttempt: true, usesEffect: false },
            attempt: { roll: { formula: "1d100", operator: "<=", target: 90 } },
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Human",
      type: "identity",
      system: {
        description:
          "<p>No special tricks. Advances without limit, which turns out to be the trick.</p>",
      },
    },
    {
      ...flagged,
      name: "Berserker Rage",
      type: "ability",
      system: {
        description: "<p>Once a day, stop being careful.</p>",
        actions: [
          limitedAction({
            name: "Rage",
            description:
              "<p>+2 to hit and damage for one turn. No retreating, no spellcasting.</p>",
            max: 1,
            value: 1,
          }),
        ],
      },
    },
    {
      ...flagged,
      name: "Keen Hearing",
      type: "ability",
      system: {
        description:
          "<p>You hear noise on a 1-3 rather than a 1-2. Nothing to activate -- this one is an Active Effect's job.</p>",
      },
    },
    {
      ...flagged,
      name: "Veteran's Instinct",
      type: "ability",
      system: {
        description:
          "<p>A trick that only makes sense once you've been at it a while.</p>",
        actions: [
          // Not yet earned -- proof that a restricted action stays off the tab
          // rather than showing up and refusing.
          bandedAction({
            name: "Read the Room",
            description: "<p>Know how many are waiting on the other side.</p>",
            min: 8,
            target: 12,
          }),
        ],
      },
    },
  ]
}

// === Assembly ================================================================

/**
 * Create every sample document and dress two characters and a monster in them.
 *
 * Items are created in the world first, then copied onto the actors, which is
 * how a referee would actually do it -- the world copies stay behind as the
 * library you drag from.
 * @returns {Promise<{actors: Actor[], items: Item[]}>} What was created
 */
export async function createSampleData() {
  const items = await Item.createDocuments([
    ...classData(),
    ...spellData(),
    ...gearData(),
    ...abilityData(),
  ])

  const byName = new Map(items.map((item) => [item.name, item]))

  /**
   * The creation data for a world item, ready to be copied onto an actor.
   * @param {string} name - The item's name
   * @param {object} [overrides] - System data to change for this copy
   * @returns {object} Item creation data
   */
  const copy = (name, overrides = {}) =>
    foundry.utils.mergeObject(byName.get(name).toObject(), overrides, {
      inplace: false,
    })

  // Put spells on the two casters' lists, so the class sheets have something to
  // show and the spell sheets have somebody to belong to.
  const spellsFor = (tradition, level) =>
    items
      .filter(
        (item) =>
          item.type === "spell" &&
          item.system.traditionId === tradition &&
          item.system.level === level,
      )
      .map((item) => ({ uuid: item.uuid, level }))

  await byName.get("Magic-User").update({
    "system.spellList": [...spellsFor("arcane", 1), ...spellsFor("arcane", 3)],
  })
  await byName.get("Cleric").update({
    "system.spellList": [...spellsFor("divine", 1), ...spellsFor("divine", 2)],
  })

  const abilityScores = (scores) => ({ base: { abilityScores: scores } })

  const actors = await Actor.createDocuments([
    {
      ...flagged,
      name: "Ysolde Vane",
      type: "character",
      system: {
        ...abilityScores({
          str: 16,
          int: 11,
          wis: 9,
          dex: 15,
          con: 14,
          cha: 12,
        }),
        hp: { value: 28, max: 34 },
      },
    },
    {
      ...flagged,
      name: "Brother Aldric",
      type: "character",
      system: {
        ...abilityScores({
          str: 12,
          int: 10,
          wis: 16,
          dex: 9,
          con: 13,
          cha: 14,
        }),
        hp: { value: 15, max: 19 },
      },
    },
    {
      ...flagged,
      name: "Sable Quist",
      type: "character",
      system: {
        ...abilityScores({
          str: 13,
          int: 14,
          wis: 10,
          dex: 17,
          con: 11,
          cha: 8,
        }),
        hp: { value: 19, max: 22 },
      },
    },
    {
      ...flagged,
      name: "Perrin Ashgrove",
      type: "character",
      system: {
        ...abilityScores({
          str: 8,
          int: 17,
          wis: 12,
          dex: 13,
          con: 9,
          cha: 11,
        }),
        hp: { value: 6, max: 8 },
      },
    },
    {
      ...flagged,
      name: "Medusa",
      type: "monster",
      system: {
        description:
          "<p>Do not look at her. This is easier said than done.</p>",
        hp: { value: 22, max: 22, hitDice: { count: 6, size: 8 } },
        xp: 725,
        actions: [
          action({
            name: "Snakebite",
            description: "<p>1d4 damage and a save against poison.</p>",
            flags: { usesAttempt: true, usesEffect: true },
            attempt: {
              flags: { isLikeAttack: true },
              attack: { type: "melee", bonus: 0 },
            },
            effects: [
              {
                id: foundry.utils.randomID(),
                name: "Venom",
                type: "attack",
                formula: "1d4",
              },
            ],
          }),
        ],
      },
    },
  ])

  // By name, not by position: `createDocuments` does not promise to hand them
  // back in the order they went in, and dressing the cleric in the fighter's
  // kit is exactly the sort of thing that looks like a bug in the sheet.
  const actorNamed = (name) => actors.find((actor) => actor.name === name)

  const ysolde = actorNamed("Ysolde Vane")
  const aldric = actorNamed("Brother Aldric")
  const sable = actorNamed("Sable Quist")
  const perrin = actorNamed("Perrin Ashgrove")
  const medusa = actorNamed("Medusa")

  // Ysolde: a multiclass fighter/thief, which is what makes level bands
  // interesting -- six levels of fighting buy her nothing as a thief.
  await ysolde.createEmbeddedDocuments("Item", [
    copy("Fighter"),
    copy("Thief"),
    copy("Human"),
    copy("Berserker Rage"),
    copy("Veteran's Instinct"),
    copy("Longsword"),
    copy("Dagger +1"),
    copy("Halberd", { system: { isEquipped: true } }),
    copy("Short Bow"),
    copy("Chain Mail"),
    copy("Shield"),
    copy("Horn of Blasting"),
    copy("Wand of Sparks"),
    copy("Backpack"),
    copy("Iron Rations"),
    copy("Rope, 50'"),
    copy("Potion of Healing"),
  ])

  // Aldric: a 4th-level cleric, which is the middle band of turning, with the
  // spells his class list offers him.
  await aldric.createEmbeddedDocuments("Item", [
    copy("Cleric"),
    copy("Halfling"),
    copy("Keen Hearing"),
    copy("Chain Mail", { system: { isEquipped: true } }),
    copy("Shield"),
    copy("Potion of Healing"),
    copy("Cure Light Wounds"),
    copy("Protection from Evil"),
    copy("Hold Person"),
  ])

  // Sable: a 5th-level assassin, which lands squarely in the middle band of
  // Assassinate. The other two bands are on the class and stay off her sheet.
  await sable.createEmbeddedDocuments("Item", [
    copy("Assassin"),
    copy("Human"),
    copy("Veteran's Instinct"),
    copy("Dagger +1", { system: { isEquipped: true } }),
    copy("Short Bow", { system: { isEquipped: true } }),
    copy("Leather Armor", { system: { isEquipped: true } }),
    copy("Longsword"),
    copy("Backpack"),
    copy("Rope, 50'"),
    copy("Potion of Healing"),
  ])

  // Perrin: a 3rd-level magic-user, for the arcane half of the spell rules --
  // a repertoire, slots at two levels, and a Fireball he can't cast yet.
  await perrin.createEmbeddedDocuments("Item", [
    copy("Magic-User"),
    copy("Halfling"),
    copy("Wand of Sparks", { system: { isEquipped: true } }),
    copy("Backpack"),
    copy("Iron Rations"),
    copy("Magic Missile"),
    copy("Sleep"),
    copy("Charm Person"),
    copy("Fireball"),
  ])

  await medusa.createEmbeddedDocuments("Item", [
    copy("Short Bow", { system: { isEquipped: true } }),
  ])

  ui.notifications.info(
    `Created ${items.length} sample Items and ${actors.length} sample Actors.`,
  )

  return { actors, items }
}

/**
 * Delete everything {@link createSampleData} made.
 *
 * Found by flag rather than by name, so a sample document that has since been
 * renamed still gets cleaned up, and a real document that happens to share a
 * name never does.
 * @returns {Promise<number>} How many documents were deleted
 */
export async function deleteSampleData() {
  const isSample = (doc) => doc.getFlag(SYSTEM_NAME, SAMPLE_FLAG)

  const actors = game.actors.filter(isSample)
  const items = game.items.filter(isSample)

  // Actors first: their embedded copies go with them, so nothing is left
  // pointing at an Item that has already gone.
  await Actor.deleteDocuments(actors.map((actor) => actor.id))
  await Item.deleteDocuments(items.map((item) => item.id))

  const count = actors.length + items.length
  ui.notifications.info(`Deleted ${count} sample documents.`)

  return count
}
