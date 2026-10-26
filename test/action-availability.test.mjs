/**
 * @file Unit tests for level restrictions on actions.
 *
 * Two callers depend on these answers matching: the Actions tab, which uses them
 * to decide what to offer, and the resolver, which uses them to decide whether to
 * go ahead. If they ever disagree the player gets a control that refuses to work,
 * so the logic lives in one place and is tested here rather than twice over.
 */

import { test } from "uvu"
import * as assert from "uvu/assert"

import {
  levelForAction,
  meetsLevelRestrictions,
  isActionAvailable,
  isActionExhausted,
} from "../src/utils/action-availability.mjs"

/**
 * An action with level restrictions switched on.
 * @param {object} level - The `level` schema value
 * @returns {object} The action
 */
const restricted = (level) => ({
  name: "Backstab",
  level,
  flags: { usesRestrictions: true },
})

// === levelForAction ==========================================================

test("levelForAction: prefers the source's own level", () => {
  const thiefClass = { system: { actionLevel: 1 } }
  const actor = { system: { level: 5 } }

  assert.is(levelForAction(thiefClass, actor), 1)
})

test("levelForAction: falls back to the actor when the source has no level", () => {
  const wand = { system: {} }
  const actor = { system: { level: 4 } }

  assert.is(levelForAction(wand, actor), 4)
})

test("levelForAction: falls back to the actor when there is no source at all", () => {
  assert.is(levelForAction(null, { system: { level: 2 } }), 2)
})

test("levelForAction: is null when nobody knows a level", () => {
  assert.is(levelForAction(null, null), null)
  assert.is(levelForAction({ system: {} }, { system: {} }), null)
  assert.is(levelForAction(null, { system: { level: null } }), null)
})

test("levelForAction: takes a source level of zero seriously", () => {
  // Zero is a real answer -- it must not fall through to the actor the way
  // undefined does.
  const source = { system: { actionLevel: 0 } }

  assert.is(levelForAction(source, { system: { level: 9 } }), 0)
})

// === meetsLevelRestrictions ==================================================

test("meetsLevelRestrictions: allows anything when restrictions are off", () => {
  const action = { level: { min: 10 }, flags: { usesRestrictions: false } }

  assert.is(meetsLevelRestrictions(action, 1), true)
})

test("meetsLevelRestrictions: allows anything when the flag is missing entirely", () => {
  assert.is(meetsLevelRestrictions({ level: { min: 10 } }, 1), true)
})

test("meetsLevelRestrictions: enforces a minimum", () => {
  const action = restricted({ min: 5 })

  assert.is(meetsLevelRestrictions(action, 4), false)
  assert.is(meetsLevelRestrictions(action, 5), true)
  assert.is(meetsLevelRestrictions(action, 6), true)
})

test("meetsLevelRestrictions: enforces a maximum", () => {
  const action = restricted({ max: 4 })

  assert.is(meetsLevelRestrictions(action, 4), true)
  assert.is(meetsLevelRestrictions(action, 5), false)
})

test("meetsLevelRestrictions: enforces a band from both ends", () => {
  const action = restricted({ min: 2, max: 4 })

  assert.is(meetsLevelRestrictions(action, 1), false)
  assert.is(meetsLevelRestrictions(action, 3), true)
  assert.is(meetsLevelRestrictions(action, 5), false)
})

test("meetsLevelRestrictions: permits everything at an unknown level", () => {
  // Better to let an action through than to refuse it because we couldn't
  // work out whose level to check.
  assert.is(meetsLevelRestrictions(restricted({ min: 5 }), null), true)
})

test("meetsLevelRestrictions: copes with an empty level range", () => {
  assert.is(meetsLevelRestrictions(restricted({}), 1), true)
  assert.is(meetsLevelRestrictions(restricted(undefined), 1), true)
})

// === isActionAvailable =======================================================

test("isActionAvailable: measures a class ability by its class", () => {
  const action = restricted({ min: 5 })
  const thiefClass = { system: { actionLevel: 1 } }
  const fighterLevel = { system: { level: 9 } }

  assert.is(
    isActionAvailable(action, thiefClass, fighterLevel),
    false,
    "nine levels of fighter don't buy a thief's fifth-level trick",
  )
})

test("isActionAvailable: measures a wand by the character", () => {
  const action = restricted({ min: 5 })
  const wand = { system: {} }

  assert.is(isActionAvailable(action, wand, { system: { level: 5 } }), true)
  assert.is(isActionAvailable(action, wand, { system: { level: 4 } }), false)
})

// === isActionExhausted =======================================================

test("isActionExhausted: an unlimited action is never spent", () => {
  assert.is(isActionExhausted({ uses: { max: 0, value: 0 } }), false)
  assert.is(isActionExhausted({ uses: {} }), false)
  assert.is(isActionExhausted({}), false)
})

test("isActionExhausted: a limited action is spent at zero", () => {
  assert.is(isActionExhausted({ uses: { max: 3, value: 1 } }), false)
  assert.is(isActionExhausted({ uses: { max: 3, value: 0 } }), true)
})

test("isActionExhausted: being spent is not the same as being unavailable", () => {
  // The tab keeps spent actions and greys them; it drops unavailable ones. The
  // two must stay separate questions.
  const spent = {
    uses: { max: 1, value: 0 },
    flags: { usesRestrictions: true },
  }

  assert.is(isActionExhausted(spent), true)
  assert.is(isActionAvailable(spent, null, { system: { level: 1 } }), true)
})

test.run()
