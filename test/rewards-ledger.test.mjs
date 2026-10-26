/**
 * @file Unit tests for the rewards ledger's arithmetic.
 *
 * How a reward divides between the characters receiving it is the part of the
 * ledger that has to be right, and it's pure arithmetic -- so it's tested here
 * rather than in a running world.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"

import {
  computeAwards,
  computeEntryAwards,
  getTotalXP,
  xpPerRecipient,
} from "../src/rewards/ledger.mjs"

/**
 * Build a reward entry for a test.
 * @param {object} overrides - Fields to override on the entry
 * @returns {object} A reward entry
 */
const entry = (overrides = {}) => ({
  id: "test",
  kind: "treasure",
  label: "Test reward",
  xp: 100,
  recipients: "all",
  split: true,
  ...overrides,
})

test("xpPerRecipient: divides a split reward between the recipients", () => {
  assert.is(xpPerRecipient(entry({ xp: 1200 }), 4), 300)
})

test("xpPerRecipient: rounds a split that doesn't divide evenly down", () => {
  // Rounding down keeps the party from earning more than the reward was worth.
  assert.is(xpPerRecipient(entry({ xp: 100 }), 3), 33)
})

test("xpPerRecipient: gives each recipient the full amount when not split", () => {
  // This is the case for something like a bonus for recapping last session --
  // two players who both wrote one should each get the whole award.
  assert.is(xpPerRecipient(entry({ xp: 50, split: false }), 2), 50)
})

test("xpPerRecipient: awards nothing when there is nobody to award it to", () => {
  assert.is(xpPerRecipient(entry({ xp: 500 }), 0), 0)
  assert.is(xpPerRecipient(entry({ xp: 500, split: false }), 0), 0)
})

test("getTotalXP: sums the entries", () => {
  assert.is(getTotalXP([entry({ xp: 1200 }), entry({ xp: 176 })]), 1376)
})

test("getTotalXP: treats an entry with no experience as zero", () => {
  assert.is(getTotalXP([entry({ xp: 100 }), entry({ xp: undefined })]), 100)
})

test("getTotalXP: totals an empty ledger as zero", () => {
  assert.is(getTotalXP([]), 0)
})

// === Awards ==================================================================

/**
 * Build a recipient for a test.
 * @param {string} id - The recipient's id, also used as their name
 * @param {object} overrides - Fields to override
 * @returns {object} A reward recipient
 */
const who = (id, overrides = {}) => ({
  id,
  name: id,
  share: 100,
  bonus: 0,
  ...overrides,
})

test("computeEntryAwards: splits evenly between full shares", () => {
  const awards = computeEntryAwards(entry({ xp: 1200 }), [
    who("alric"),
    who("bel"),
    who("cade"),
    who("dis"),
  ])

  assert.equal(
    awards.map((award) => award.total),
    [300, 300, 300, 300],
  )
})

test("computeEntryAwards: agrees with xpPerRecipient when every share is full", () => {
  // The two are different routes to the same answer, and they should not drift.
  const reward = entry({ xp: 1000 })
  const recipients = [who("a"), who("b"), who("c")]

  computeEntryAwards(reward, recipients).forEach((award) => {
    assert.is(award.total, xpPerRecipient(reward, recipients.length))
  })
})

test("computeEntryAwards: gives a half share half as much", () => {
  // A retainer customarily takes half a share, so 1200 between two characters and
  // one retainer divides into 2.5 shares of 480.
  const awards = computeEntryAwards(entry({ xp: 1200 }), [
    who("alric"),
    who("bel"),
    who("hireling", { share: 50 }),
  ])

  assert.equal(
    awards.map((award) => award.total),
    [480, 480, 240],
  )
})

test("computeEntryAwards: gives nothing to a share of zero", () => {
  const awards = computeEntryAwards(entry({ xp: 1000 }), [
    who("alric"),
    who("onlooker", { share: 0 }),
  ])

  assert.equal(
    awards.map((award) => award.total),
    [1000, 0],
  )
})

test("computeEntryAwards: awards nothing when no recipient holds a share", () => {
  // Would be a division by zero if the total weren't checked first.
  const awards = computeEntryAwards(entry({ xp: 1000 }), [
    who("a", { share: 0 }),
    who("b", { share: 0 }),
  ])

  assert.equal(
    awards.map((award) => award.total),
    [0, 0],
  )
})

test("computeEntryAwards: applies a character's bonus to their portion alone", () => {
  const awards = computeEntryAwards(entry({ xp: 1000 }), [
    who("alric", { bonus: 10 }),
    who("bel"),
  ])

  // 500 each, and Alric's 10% is added on top rather than taken from Bel.
  assert.equal(awards[0], {
    id: "alric",
    name: "alric",
    base: 500,
    bonus: 50,
    total: 550,
  })
  assert.is(awards[1].total, 500)
})

test("computeEntryAwards: gives each recipient the whole amount when not split", () => {
  const awards = computeEntryAwards(entry({ xp: 50, split: false }), [
    who("alric"),
    who("hireling", { share: 50 }),
  ])

  // Not one pot being divided, so the share has nothing to divide.
  assert.equal(
    awards.map((award) => award.total),
    [50, 50],
  )
})

test("computeEntryAwards: rounds each portion down", () => {
  const awards = computeEntryAwards(entry({ xp: 100 }), [
    who("a"),
    who("b"),
    who("c"),
  ])

  assert.equal(
    awards.map((award) => award.total),
    [33, 33, 33],
  )
})

test("computeEntryAwards: awards nothing when nobody is receiving", () => {
  assert.equal(computeEntryAwards(entry({ xp: 500 }), []), [])
})

test("computeAwards: adds up what a character earns across entries", () => {
  const alric = who("alric")
  const bel = who("bel")

  const awards = computeAwards(
    [
      entry({ id: "hoard", xp: 1000 }),
      entry({ id: "goblins", xp: 100 }),
      // Only Alric wrote the session recap, so only Alric gets the bonus.
      entry({ id: "recap", xp: 50, split: false, recipients: ["alric"] }),
    ],
    (reward) =>
      reward.recipients === "all"
        ? [alric, bel]
        : [alric, bel].filter((r) => reward.recipients.includes(r.id)),
  )

  assert.equal(awards, [
    { id: "alric", name: "alric", base: 600, bonus: 0, total: 600 },
    { id: "bel", name: "bel", base: 550, bonus: 0, total: 550 },
  ])
})

test("computeAwards: leaves out a character who would earn nothing", () => {
  // An entry too small to divide leaves someone with zero, and there's no reason
  // to write a zero onto their sheet or list them in the summary.
  const awards = computeAwards([entry({ xp: 1 })], () => [
    who("a"),
    who("b"),
    who("c"),
  ])

  assert.is(awards.length, 0)
})

test("computeAwards: totals an empty ledger as no awards", () => {
  assert.equal(
    computeAwards([], () => [who("alric")]),
    [],
  )
})

test.run()
