/**
 * @file Tests for the turn-ordering engine.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"
import {
  DEFAULT_CONFIG,
  DIRECTIONS,
  effectiveInitiativeOf,
  orderEntries,
  phaseIndexOf,
  toTurnOrderConfig,
  unitKeyOf,
} from "../src/rules-engines/turn-order.mjs"

// ============================================================================
// Helpers
// ============================================================================

let nextStableIndex = 0

/**
 * Build an entry without spelling out every field at every call site.
 * @param {object} overrides - The fields this particular test cares about.
 * @returns {object} A complete OrderableEntry.
 */
const entry = (overrides = {}) => {
  const stableIndex = nextStableIndex
  nextStableIndex += 1

  return {
    combatantId: `c${stableIndex}`,
    groupId: null,
    base: null,
    offset: 0,
    phaseIndex: 0,
    stableIndex,
    ...overrides,
  }
}

/**
 * Reset the shared counter so each test's stable indices start from zero.
 * @returns {void}
 */
const resetIndices = () => {
  nextStableIndex = 0
}

/**
 * Pull the combatant ids out of a sorted result, which is what assertions
 * about ordering actually care about.
 * @param {object[]} entries - Sorted entries.
 * @returns {string[]} Their combatant ids, in order.
 */
const idsOf = (entries) => entries.map((e) => e.combatantId)

const HIGH_FIRST = { direction: "high", perMemberOffsets: false }
const LOW_FIRST = { direction: "low", perMemberOffsets: false }

// ============================================================================
// unitKeyOf
// ============================================================================

test("unitKeyOf: a grouped combatant is keyed by its group", () => {
  resetIndices()
  assert.is(unitKeyOf(entry({ combatantId: "pc1", groupId: "party" })), "party")
})

test("unitKeyOf: an ungrouped combatant is its own unit", () => {
  resetIndices()
  assert.is(unitKeyOf(entry({ combatantId: "pc1", groupId: null })), "pc1")
})

test("unitKeyOf: two ungrouped combatants are different units", () => {
  // Regression guard. Keying on groupId alone would make both null, treating
  // every ungrouped combatant as one unit -- which would collapse an entire
  // individual-initiative combat into a single turn.
  resetIndices()
  const a = unitKeyOf(entry({ combatantId: "pc1", groupId: null }))
  const b = unitKeyOf(entry({ combatantId: "pc2", groupId: null }))
  assert.is.not(a, b)
})

test("unitKeyOf: two members of one group are the same unit", () => {
  resetIndices()
  const a = unitKeyOf(entry({ combatantId: "orc1", groupId: "warband" }))
  const b = unitKeyOf(entry({ combatantId: "orc2", groupId: "warband" }))
  assert.is(a, b)
})

// ============================================================================
// effectiveInitiativeOf
// ============================================================================

test("effectiveInitiativeOf: adds the offset to the base", () => {
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: 4, offset: 3 })), 7)
})

test("effectiveInitiativeOf: a base with no offset is the base", () => {
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: 5, offset: 0 })), 5)
})

test("effectiveInitiativeOf: negative offsets subtract", () => {
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: 4, offset: -2 })), 2)
})

test("effectiveInitiativeOf: an unrolled unit has no initiative", () => {
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: null, offset: 3 })), null)
})

test("effectiveInitiativeOf: a rolled zero is not the same as unrolled", () => {
  // The distinction matters: zero is a place in the order, null is not.
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: 0, offset: 0 })), 0)
})

test("effectiveInitiativeOf: an explicit segment beats the sum", () => {
  // AD&D's spacing strategies choose a position outright -- "first attack on
  // segment 1" holds whatever the side rolled -- and no sum of a roll and an
  // adjustment can express that.
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: 4, offset: 3, segment: 1 })), 1)
})

test("effectiveInitiativeOf: a segment places a row even with no roll", () => {
  // A segment is not derived from a roll, so a row carrying one is placed. No
  // shipped ruleset assigns segments without rolling, but one legitimately could.
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: null, segment: 6 })), 6)
})

test("effectiveInitiativeOf: a null segment defers to the sum", () => {
  // Every ruleset that derives its ordering leaves this absent or null, which is
  // most of them -- so the fallback is the common path, not the exception.
  resetIndices()
  assert.is(
    effectiveInitiativeOf(entry({ base: 4, offset: 2, segment: null })),
    6,
  )
  assert.is(effectiveInitiativeOf(entry({ base: 4, offset: 2 })), 6)
})

test("orderEntries: a chosen segment overrides a better roll", () => {
  // The visible consequence of the `spread` strategy: a multi-attack fighter
  // leads the order regardless of what their side rolled.
  resetIndices()
  const fighter = entry({ combatantId: "fighter", base: 9, segment: 1 })
  const rival = entry({ combatantId: "rival", base: 2 })

  assert.equal(
    orderEntries([rival, fighter], { direction: "low" }).map(
      (e) => e.combatantId,
    ),
    ["fighter", "rival"],
  )
})

test("effectiveInitiativeOf: a non-finite base counts as unrolled", () => {
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: NaN })), null)
  assert.is(effectiveInitiativeOf(entry({ base: Infinity })), null)
  assert.is(effectiveInitiativeOf(entry({ base: undefined })), null)
})

test("effectiveInitiativeOf: a non-finite offset counts as zero", () => {
  resetIndices()
  assert.is(effectiveInitiativeOf(entry({ base: 4, offset: NaN })), 4)
  assert.is(effectiveInitiativeOf(entry({ base: 4, offset: undefined })), 4)
})

// ============================================================================
// toTurnOrderConfig
// ============================================================================

test("toTurnOrderConfig: nothing declared falls back to B/X's rules", () => {
  assert.equal(toTurnOrderConfig(undefined), DEFAULT_CONFIG)
  assert.equal(toTurnOrderConfig({}), DEFAULT_CONFIG)
})

test("toTurnOrderConfig: accepts every declared direction", () => {
  DIRECTIONS.forEach((direction) => {
    assert.is(toTurnOrderConfig({ direction }).direction, direction)
  })
})

test("toTurnOrderConfig: an unrecognised direction falls back", () => {
  assert.is(toTurnOrderConfig({ direction: "lowest" }).direction, "high")
  assert.is(toTurnOrderConfig({ direction: null }).direction, "high")
})

test("toTurnOrderConfig: perMemberOffsets must be exactly true", () => {
  assert.is(
    toTurnOrderConfig({ perMemberOffsets: true }).perMemberOffsets,
    true,
  )
  assert.is(
    toTurnOrderConfig({ perMemberOffsets: "yes" }).perMemberOffsets,
    false,
  )
  assert.is(toTurnOrderConfig({}).perMemberOffsets, false)
})

test("toTurnOrderConfig: ignores fields that do not affect ordering", () => {
  const config = toTurnOrderConfig({
    id: "bx-group",
    formula: "1d6",
    rollingUnit: "group",
    decimals: 0,
  })
  assert.equal(Object.keys(config).sort(), ["direction", "perMemberOffsets"])
})

test("toTurnOrderConfig: is idempotent", () => {
  // orderEntries relies on this to normalise whatever it is handed.
  const once = toTurnOrderConfig({ direction: "low", perMemberOffsets: true })
  assert.equal(toTurnOrderConfig(once), once)
})

// ============================================================================
// orderEntries -- direction
// ============================================================================

test("orderEntries: high-first puts the highest roll first", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "a", base: 2 }),
    entry({ combatantId: "b", base: 6 }),
    entry({ combatantId: "c", base: 4 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), ["b", "c", "a"])
})

test("orderEntries: low-first puts the lowest roll first", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "a", base: 2 }),
    entry({ combatantId: "b", base: 6 }),
    entry({ combatantId: "c", base: 4 }),
  ]
  assert.equal(idsOf(orderEntries(entries, LOW_FIRST)), ["a", "c", "b"])
})

test("orderEntries: defaults to high-first when given no config", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "a", base: 2 }),
    entry({ combatantId: "b", base: 6 }),
  ]
  assert.equal(idsOf(orderEntries(entries)), ["b", "a"])
})

test("orderEntries: negative initiative still sorts correctly", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "a", base: -1 }),
    entry({ combatantId: "b", base: 3 }),
    entry({ combatantId: "c", base: 0 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), ["b", "c", "a"])
  assert.equal(idsOf(orderEntries(entries, LOW_FIRST)), ["a", "c", "b"])
})

// ============================================================================
// orderEntries -- unrolled combatants
// ============================================================================

test("orderEntries: unrolled sorts last under high-first", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "unrolled", base: null }),
    entry({ combatantId: "rolled", base: 3 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), ["rolled", "unrolled"])
})

test("orderEntries: unrolled sorts last under low-first too", () => {
  // The one that bites. Under a low-acts-first ruleset, treating an unrolled
  // combatant as a small number would put it at the very front of the round.
  resetIndices()
  const entries = [
    entry({ combatantId: "unrolled", base: null }),
    entry({ combatantId: "rolled", base: 3 }),
  ]
  assert.equal(idsOf(orderEntries(entries, LOW_FIRST)), ["rolled", "unrolled"])
})

test("orderEntries: a rolled zero still beats an unrolled combatant", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "unrolled", base: null }),
    entry({ combatantId: "zero", base: 0 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), ["zero", "unrolled"])
  assert.equal(idsOf(orderEntries(entries, LOW_FIRST)), ["zero", "unrolled"])
})

test("orderEntries: several unrolled keep a stable order among themselves", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "a", base: null }),
    entry({ combatantId: "b", base: null }),
    entry({ combatantId: "c", base: 5 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), ["c", "a", "b"])
})

// ============================================================================
// orderEntries -- offsets
// ============================================================================

test("orderEntries: offsets move a combatant within the order", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "slow", base: 5, offset: -4 }),
    entry({ combatantId: "quick", base: 2, offset: 0 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), ["quick", "slow"])
})

test("orderEntries: members of one group can be split by their offsets", () => {
  // AD&D 1e: one side rolls, and each caster adds their casting time. The
  // party's caster legitimately resolves between two of the warband's members.
  resetIndices()
  const entries = [
    entry({ combatantId: "caster", groupId: "party", base: 3, offset: 2 }),
    entry({ combatantId: "orcA", groupId: "warband", base: 4, offset: 0 }),
    entry({ combatantId: "orcB", groupId: "warband", base: 4, offset: 3 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), [
    "orcB",
    "caster",
    "orcA",
  ])
})

// ============================================================================
// orderEntries -- group contiguity
// ============================================================================

test("orderEntries: tied groups do not interleave", () => {
  // Two sides tying on 1d6 happens one round in six. Without a unit tiebreak
  // the two sides' members would shuffle together.
  resetIndices()
  const entries = [
    entry({ combatantId: "pc1", groupId: "aaa-party", base: 4 }),
    entry({ combatantId: "orc1", groupId: "zzz-warband", base: 4 }),
    entry({ combatantId: "pc2", groupId: "aaa-party", base: 4 }),
    entry({ combatantId: "orc2", groupId: "zzz-warband", base: 4 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), [
    "pc1",
    "pc2",
    "orc1",
    "orc2",
  ])
})

test("orderEntries: a whole group stays contiguous against a tied loner", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "mmm-loner", groupId: null, base: 4 }),
    entry({ combatantId: "pc1", groupId: "aaa-party", base: 4 }),
    entry({ combatantId: "pc2", groupId: "aaa-party", base: 4 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), [
    "pc1",
    "pc2",
    "mmm-loner",
  ])
})

test("orderEntries: tied ungrouped combatants sort by id, not input order", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "zzz", groupId: null, base: 4 }),
    entry({ combatantId: "aaa", groupId: null, base: 4 }),
  ]
  // Each is its own unit, so the unit tiebreak orders them by id, keeping the
  // result deterministic rather than dependent on input order.
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), ["aaa", "zzz"])
})

// ============================================================================
// orderEntries -- tiebreaks and determinism
// ============================================================================

test("orderEntries: identical rows fall back to their original order", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "same", groupId: "g", base: 4, stableIndex: 1 }),
    entry({ combatantId: "same", groupId: "g", base: 4, stableIndex: 0 }),
  ]
  assert.equal(
    orderEntries(entries, HIGH_FIRST).map((e) => e.stableIndex),
    [0, 1],
  )
})

test("orderEntries: phase orders the members of one unit", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "fighter", groupId: "g", base: 4, phaseIndex: 3 }),
    entry({ combatantId: "mover", groupId: "g", base: 4, phaseIndex: 0 }),
    entry({ combatantId: "caster", groupId: "g", base: 4, phaseIndex: 2 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), [
    "mover",
    "caster",
    "fighter",
  ])
})

test("orderEntries: phase never outranks initiative", () => {
  // B/X plays every phase of the winning side's turn before the other side
  // begins, so the losing side's movers still wait for the winners' fighters.
  resetIndices()
  const entries = [
    entry({ combatantId: "loser-mover", groupId: "b", base: 2, phaseIndex: 0 }),
    entry({
      combatantId: "winner-fighter",
      groupId: "a",
      base: 5,
      phaseIndex: 3,
    }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), [
    "winner-fighter",
    "loser-mover",
  ])
})

test("orderEntries: phase never splits tied units", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "a-fighter", groupId: "a", base: 4, phaseIndex: 3 }),
    entry({ combatantId: "b-mover", groupId: "b", base: 4, phaseIndex: 0 }),
    entry({ combatantId: "a-mover", groupId: "a", base: 4, phaseIndex: 0 }),
  ]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), [
    "a-mover",
    "a-fighter",
    "b-mover",
  ])
})

// ============================================================================
// phaseIndexOf
// ============================================================================

const PHASES = [
  { id: "movement", declarations: ["bags.move", "bags.withdraw"] },
  { id: "missile", declarations: ["bags.missile"] },
  { id: "magic", declarations: ["bags.cast"] },
  { id: "melee", declarations: ["bags.melee"] },
]

test("phaseIndexOf: finds the phase a declaration acts in", () => {
  assert.is(phaseIndexOf("bags.withdraw", PHASES), 0)
  assert.is(phaseIndexOf("bags.cast", PHASES), 2)
  assert.is(phaseIndexOf("bags.melee", PHASES), 3)
})

test("phaseIndexOf: anything unlisted acts after every phase", () => {
  assert.is(phaseIndexOf("bags.delay", PHASES), 4)
  assert.is(phaseIndexOf("bags.none", PHASES), 4)
  assert.is(phaseIndexOf(null, PHASES), 4)
})

test("phaseIndexOf: a ruleset without phases puts everyone in one", () => {
  assert.is(phaseIndexOf("bags.melee", []), 0)
  assert.is(phaseIndexOf("bags.melee"), 0)
})

test("orderEntries: the same input always gives the same output", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "a", groupId: "g1", base: 4 }),
    entry({ combatantId: "b", groupId: "g2", base: 4 }),
    entry({ combatantId: "c", groupId: "g1", base: 4 }),
    entry({ combatantId: "d", base: null }),
  ]
  const first = idsOf(orderEntries(entries, HIGH_FIRST))
  const shuffled = [entries[2], entries[0], entries[3], entries[1]]
  assert.equal(idsOf(orderEntries(shuffled, HIGH_FIRST)), first)
})

// ============================================================================
// orderEntries -- purity and edges
// ============================================================================

test("orderEntries: does not modify the array it is given", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "a", base: 2 }),
    entry({ combatantId: "b", base: 6 }),
  ]
  const before = idsOf(entries)
  orderEntries(entries, HIGH_FIRST)
  assert.equal(idsOf(entries), before)
})

test("orderEntries: returns a new array", () => {
  resetIndices()
  const entries = [entry({ combatantId: "a", base: 2 })]
  assert.is.not(orderEntries(entries, HIGH_FIRST), entries)
})

test("orderEntries: handles an empty combat", () => {
  assert.equal(orderEntries([], HIGH_FIRST), [])
})

test("orderEntries: handles a single combatant", () => {
  resetIndices()
  const entries = [entry({ combatantId: "only", base: 3 })]
  assert.equal(idsOf(orderEntries(entries, HIGH_FIRST)), ["only"])
})

// ============================================================================
// orderEntries -- whole-table scenarios
// ============================================================================

test("scenario: B/X, four PCs and six orcs, two rolls", () => {
  resetIndices()
  const party = ["pc1", "pc2", "pc3", "pc4"].map((id) =>
    entry({ combatantId: id, groupId: "party", base: 5 }),
  )
  const warband = ["orc1", "orc2", "orc3", "orc4", "orc5", "orc6"].map((id) =>
    entry({ combatantId: id, groupId: "warband", base: 3 }),
  )

  const ordered = orderEntries([...warband, ...party], HIGH_FIRST)

  // The party won initiative, so all four act before any orc does.
  assert.equal(idsOf(ordered).slice(0, 4), ["pc1", "pc2", "pc3", "pc4"])
  assert.is(ordered.length, 10)
  // And the tracker can draw two blocks, because each side is contiguous.
  assert.equal([...new Set(ordered.map(unitKeyOf))], ["party", "warband"])
})

test("scenario: AD&D 2e, everyone rolls, low acts first", () => {
  resetIndices()
  const entries = [
    entry({ combatantId: "fighter", base: 7, offset: 2 }),
    entry({ combatantId: "thief", base: 2, offset: 1 }),
    entry({ combatantId: "ogre", base: 5, offset: 4 }),
    entry({ combatantId: "mage", base: 4, offset: -1 }),
  ]
  // thief 3, mage 3, ogre 9, fighter 9. Ties break by unit key, which for
  // ungrouped combatants is their own id: "mage" before "thief", "fighter"
  // before "ogre".
  assert.equal(idsOf(orderEntries(entries, LOW_FIRST)), [
    "mage",
    "thief",
    "fighter",
    "ogre",
  ])
})

test.run()
