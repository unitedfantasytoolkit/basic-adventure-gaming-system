/**
 * @file Shared fixtures and utilities for BAGS' Quench test batches.
 *
 * Quench tests run inside a live Foundry world, which means they create real
 * documents in the GM's world and roll real dice. That buys us coverage no unit
 * test can reach -- settings-driven schemas, derived getters, chat cards, sheet
 * rendering -- but it comes with two obligations:
 *
 * 1. Everything a test creates has to be cleaned up, or a test run slowly fills
 *    the world with junk. {@link trackDocument} and {@link cleanUpDocuments}
 *    handle that; every suite that creates documents should call
 *    `cleanUpDocuments()` from an `after` hook.
 * 2. Anything a test changes globally -- a system setting, the dice RNG -- has to
 *    be put back, even when the test fails. The `with*` helpers here all use
 *    `try/finally` so a failed assertion can't leak state into the next test.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"
import PartySidebar from "../party/sidebar.mjs"
import { LEDGER_SETTING } from "../rewards/ledger.mjs"

// === Registry and settings ===================================================

/**
 * The ability score keys the selected ability score system defines.
 * @returns {string[]} Ability score keys, e.g. ["str", "int", ...]
 */
export function getAbilityScoreKeys() {
  const settings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.ABILITY_SCORES,
  )
  return Array.from(settings?.abilityScores?.keys() ?? [])
}

/**
 * The saving throw keys the selected saving throw system defines.
 * @returns {string[]} Saving throw keys, e.g. ["death", "wands", ...]
 */
export function getSavingThrowKeys() {
  const settings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
  )
  return Object.keys(settings?.savingThrows ?? {})
}

/**
 * Run a callback with a system setting temporarily changed.
 *
 * Restores the previous value even if the callback throws, so one failing
 * assertion can't leave a world running the wrong ruleset.
 * @template T
 * @param {string} key - The setting key, without the system namespace
 * @param {*} value - The value to use for the duration of the callback
 * @param {() => Promise<T>|T} callback - The work to do
 * @returns {Promise<T>} Whatever the callback returned
 */
export async function withSetting(key, value, callback) {
  const original = game.settings.get(SYSTEM_NAME, key)

  await game.settings.set(SYSTEM_NAME, key, value)

  try {
    return await callback()
  } finally {
    await game.settings.set(SYSTEM_NAME, key, original)
  }
}

/**
 * Run a callback with a rules module selected for one registry category.
 * @template T
 * @param {string} category - A `SystemRegistry.categories` value
 * @param {string} id - The rules module ID to select
 * @param {() => Promise<T>|T} callback - The work to do
 * @returns {Promise<T>} Whatever the callback returned
 */
export function withRulesModule(category, id, callback) {
  return withSetting(`selected${category}`, id, callback)
}

// === Party and rewards =======================================================

/**
 * Run a callback with nobody in the party, then put the roster back.
 *
 * Party membership is a flag on world Actors, so a GM who actually uses the Party
 * tab has a roster that outlives any test run. A test that asserts on "the party"
 * has to start from a known state, and it has to hand the referee's own party back
 * afterwards.
 *
 * Members are restored by id rather than by document, so a test that deleted one of
 * them doesn't fail here on the way out.
 * @template T
 * @param {() => Promise<T>|T} callback - The work to do
 * @returns {Promise<T>} Whatever the callback returned
 */
export async function withEmptyParty(callback) {
  const memberIds = PartySidebar.members.map((member) => member.id)

  await Promise.all(memberIds.map((id) => PartySidebar.removeFromParty(id)))

  try {
    return await callback()
  } finally {
    await Promise.all(memberIds.map((id) => PartySidebar.addToParty(id)))
  }
}

/**
 * Run a callback with an empty rewards ledger, then put the ledger back.
 *
 * The ledger is a world setting holding rewards the referee has not handed out
 * yet, so a test must not simply clear it -- that would throw away real unawarded
 * experience.
 * @template T
 * @param {() => Promise<T>|T} callback - The work to do
 * @returns {Promise<T>} Whatever the callback returned
 */
export async function withEmptyLedger(callback) {
  return withSetting(LEDGER_SETTING, [], callback)
}

// === Document fixtures =======================================================

/**
 * Documents created by the current test run, newest first.
 *
 * Kept newest first so cleanup deletes children before parents, which keeps
 * Foundry from complaining about deleting a document that has already gone away
 * with its parent.
 * @type {Array<foundry.abstract.Document>}
 */
const tracked = []

/**
 * A name prefix that makes test leftovers obvious in the sidebar, on the rare
 * occasion cleanup doesn't run (a hard reload mid-test, say).
 * @type {string}
 */
export const TEST_PREFIX = "[Quench]"

/**
 * Remember a document so it gets deleted when the suite finishes.
 * @template {foundry.abstract.Document} T
 * @param {T} document - The document to clean up later
 * @returns {T} The same document, for chaining
 */
export function trackDocument(document) {
  if (document) tracked.unshift(document)
  return document
}

/**
 * Delete the chat cards belonging to some encounters.
 * @param {Set<string>} combatIds - The encounters whose cards should go.
 * @returns {Promise<void>} Resolves once they are deleted.
 */
async function removeCardsFor(combatIds) {
  const ids = game.messages
    .filter((message) => combatIds.has(message.system?.combatId))
    .map((message) => message.id)
  if (!ids.length) return

  try {
    await ChatMessage.implementation.deleteDocuments(ids)
  } catch {
    // Already gone. Not worth failing a suite over.
  }
}

/**
 * Delete everything this test run created.
 *
 * Failures are swallowed on purpose: a document that has already been deleted by
 * the test itself, or removed along with its parent, is not a problem worth
 * failing a suite over.
 * @returns {Promise<void>}
 */
export async function cleanUpDocuments() {
  const toDelete = tracked.splice(0, tracked.length)

  /**
   * Delete one document, ignoring anything that goes wrong.
   * @param {foundry.abstract.Document} document - The document to delete
   * @returns {Promise<void>} Resolves once the attempt is over
   */
  const deleteQuietly = async (document) => {
    try {
      // A document the test already deleted, or one removed along with its
      // parent, is out of its collection and has nothing left to delete.
      if (!document.collection?.has(document.id)) return
      await document.delete()
    } catch {
      // Never made it into the database, or went away between the check and the
      // delete. Neither is worth failing a suite over.
    }
  }

  // Sequential rather than parallel, so a parent is never deleted out from under
  // a child that is still being removed.
  const deleteAll = () =>
    toDelete.reduce(
      (chain, document) => chain.then(() => deleteQuietly(document)),
      Promise.resolve(),
    )

  const combatIds = new Set(
    toDelete
      .filter((document) => document.documentName === "Combat")
      .map((document) => document.id),
  )
  if (!combatIds.size) {
    await deleteAll()
    return
  }

  // Deleting an encounter posts a closing card, and running one posts a card
  // per round. Without this, every combat test leaves its chat cards behind.
  // The closing card is switched off rather than deleted afterwards, because
  // it is posted without being awaited and could arrive after the sweep.
  await withSetting("postRoundCard", false, deleteAll)
  await removeCardsFor(combatIds)
}

/**
 * Create a world Actor that will be cleaned up after the suite.
 *
 * Careful with characters that have no ability scores: those look exactly like a
 * character somebody just made in the sidebar, so the `createActor` hook offers to
 * build them with the creation flow. In the default "offer" mode that means a
 * modal dialog nothing is going to dismiss. Use {@link createBlankCharacter} for a
 * scoreless character, or {@link createTestCharacter} for one with scores.
 * @param {object} [data] - Actor creation data, merged over the defaults
 * @returns {Promise<Actor>} The created Actor
 */
export async function createTestActor(data = {}) {
  const actor = await Actor.create({
    name: `${TEST_PREFIX} Actor`,
    type: "character",
    ...data,
  })

  return trackDocument(actor)
}

/**
 * Create an encounter pinned to plain B/X side initiative.
 *
 * Combat tests describe B/X behaviour unless they say otherwise. An encounter
 * left on the world's own rules runs whatever the development world happens to
 * be set to, which is how a whole batch of these once failed under AD&D 1e for
 * reasons that had nothing to do with the code.
 * @param {object} [data] - Combat creation data, merged over the defaults
 * @returns {Promise<Combat>} The created combat
 */
export async function createTestCombat(data = {}) {
  const combat = await Combat.implementation.create(
    foundry.utils.mergeObject(
      { system: { initiativePreset: "bx-group" } },
      data,
      { inplace: false },
    ),
  )

  return trackDocument(combat)
}

/**
 * Create a character with no ability scores, without being offered the character
 * creation flow.
 *
 * A scoreless character is what `system.canRollAbilityScores` reports on, so it's
 * the fixture for anything that tests what happens *before* a character is built.
 * The creation offer is suppressed for the duration of the create, because
 * otherwise the hook would open a modal dialog in the middle of the test.
 * @param {object} [data] - Actor creation data, merged over the defaults
 * @returns {Promise<Actor>} The created character
 */
export function createBlankCharacter(data = {}) {
  return withSetting("characterCreationMode", "never", () =>
    createTestActor({
      name: `${TEST_PREFIX} Blank Character`,
      type: "character",
      ...data,
    }),
  )
}

/**
 * Create a character with ability scores already filled in.
 *
 * Scores default to 10 (no modifier under B/X) so a test only has to name the
 * scores it actually cares about, and every other score stays neutral.
 * @param {object} [options] - Options for the character
 * @param {Record<string, number>} [options.abilityScores] - Scores to override
 * @param {object} [options.data] - Extra Actor creation data
 * @returns {Promise<Actor>} The created character
 */
export async function createTestCharacter({
  abilityScores = {},
  data = {},
} = {}) {
  const scoreKeys = getAbilityScoreKeys()
  const scores = scoreKeys.reduce(
    (obj, key) => ({ ...obj, [key]: abilityScores[key] ?? 10 }),
    {},
  )

  return createTestActor(
    foundry.utils.mergeObject(
      {
        name: `${TEST_PREFIX} Character`,
        type: "character",
        system: { base: { abilityScores: scores } },
      },
      data,
    ),
  )
}

/**
 * Create a monster with a known Armor Class, for use as an attack target.
 *
 * `armorClassOffset` is an offset from the combat system's base AC rather than an
 * absolute number, which is what lets the same fixture work under both ascending
 * and descending AC.
 * @param {object} [options] - Options for the monster
 * @param {number} [options.armorClassOffset] - Offset from the base AC
 * @param {number} [options.hp] - Current and maximum hit points
 * @param {object} [options.data] - Extra Actor creation data
 * @returns {Promise<Actor>} The created monster
 */
export async function createTestMonster({
  armorClassOffset = 0,
  hp = 10,
  data = {},
} = {}) {
  return createTestActor(
    foundry.utils.mergeObject(
      {
        name: `${TEST_PREFIX} Monster`,
        type: "monster",
        system: {
          base: { armorClassOffset },
          hp: { value: hp, max: hp },
        },
      },
      data,
    ),
  )
}

/**
 * Create an Item, either in the world or owned by an Actor.
 *
 * Owned Items are tracked too, so a test that creates gear on a shared Actor
 * doesn't have to remember to tidy up after itself.
 * @param {object} data - Item creation data (must include `type`)
 * @param {Actor|null} [actor] - The owning Actor, or null for a world Item
 * @returns {Promise<Item>} The created Item
 */
export async function createTestItem(data, actor = null) {
  const itemData = { name: `${TEST_PREFIX} Item`, ...data }

  if (!actor) return trackDocument(await Item.create(itemData))

  const [item] = await actor.createEmbeddedDocuments("Item", [itemData])
  return trackDocument(item)
}

/**
 * Create a class Item with a usable XP table.
 *
 * The XP table is the part of a class that everything else reads -- level, THAC0,
 * saves, hit dice, XP thresholds -- so a class without one breaks most character
 * getters. This builds `levels` rows with predictable values: THAC0 improves by
 * one per level, attack bonus rises by one, and saves improve by one.
 * @param {object} [options] - Options for the class
 * @param {number} [options.levels] - How many rows the XP table gets
 * @param {number} [options.level] - The level to set the class to
 * @param {number} [options.xp] - Current experience points
 * @param {number} [options.hitDieSize] - Hit die size
 * @param {number[][]} [options.spellSlots] - Slots as [spellLevel][charLevel]
 * @param {Actor|null} [options.actor] - The Actor to own the class
 * @param {object} [options.data] - Extra Item creation data
 * @returns {Promise<Item>} The created class Item
 */
export async function createTestClass({
  levels = 3,
  level = 1,
  xp = 0,
  hitDieSize = 8,
  spellSlots = [],
  actor = null,
  data = {},
} = {}) {
  const saveKeys = getSavingThrowKeys()

  const xpTable = Array.from({ length: levels }, (_, index) => ({
    // Row 0 is level 1, which always costs nothing to reach.
    value: index * 1000,
    attackBonus: index,
    thac0: 19 - index,
    hd: { count: index + 1, modifier: 0, canUseConMod: true },
    saves: saveKeys.reduce((obj, key) => ({ ...obj, [key]: 14 - index }), {}),
  }))

  return createTestItem(
    foundry.utils.mergeObject(
      {
        name: `${TEST_PREFIX} Class`,
        type: "class",
        system: {
          hitDieSize,
          manuallySetLevel: level,
          xp,
          xpTable,
          spellSlots,
        },
      },
      data,
    ),
    actor,
  )
}

/**
 * Create a Scene to hold test tokens.
 *
 * Tokens are the only thing Foundry hands to an action as a target --
 * `game.user.targets` is a set of placed Tokens, never Actors -- so anything that
 * tests targeting needs somewhere for them to stand.
 * @returns {Promise<Scene>} The created Scene
 */
export async function createTestScene() {
  return trackDocument(
    await Scene.create({
      name: `${TEST_PREFIX} Scene`,
      width: 1000,
      height: 1000,
    }),
  )
}

/**
 * Place a linked token for an Actor on a Scene.
 *
 * The token is linked, so its `actor` is the world Actor rather than a synthetic
 * copy. That matters for any test that expects damage or an effect to land
 * somewhere it can then read back.
 * @param {Scene} scene - The Scene to place the token on
 * @param {Actor} actor - The Actor the token represents
 * @returns {Promise<TokenDocument>} The created token
 */
export async function createTestToken(scene, actor) {
  const [token] = await scene.createEmbeddedDocuments("Token", [
    {
      name: actor.name,
      actorId: actor.id,
      actorLink: true,
      x: 0,
      y: 0,
    },
  ])

  return trackDocument(token)
}

// === Dice ====================================================================

/**
 * Turn a desired die face into a value for `CONFIG.Dice.randomUniform`.
 *
 * Foundry maps a uniform random number to a die face with
 * `Math.ceil((1 - u) * faces)`, so aiming at the middle of a face's slice gives
 * that face reliably without landing on a rounding boundary.
 * @param {number} face - The face to roll
 * @param {number} faces - How many faces the die has
 * @returns {number} A value in [0, 1) that produces `face`
 */
const uniformForFace = (face, faces) => 1 - (face - 0.5) / faces

/**
 * Run a callback with every die roll forced to a known result.
 *
 * `face` is applied per die size: a `face` of 20 rolls 20 on a d20 and 6 on a d6,
 * because it's clamped to the die's largest face. Pass a number to hit that face
 * on a d20-sized die and the nearest equivalent elsewhere.
 * @template T
 * @param {number|"max"|"min"} face - The face to roll, or an extreme
 * @param {() => Promise<T>|T} callback - The work to do
 * @returns {Promise<T>} Whatever the callback returned
 */
export async function withFixedDice(face, callback) {
  const original = CONFIG.Dice.randomUniform

  if (face === "max") CONFIG.Dice.randomUniform = () => 0
  // The interval is [0, 1), so this is as close to 1 as a face-1 result needs.
  else if (face === "min") CONFIG.Dice.randomUniform = () => 0.999999
  else
    CONFIG.Dice.randomUniform = () => {
      // Faces aren't known at this point, so aim at the requested face on a d20
      // and let smaller dice clamp to their own maximum.
      const uniform = uniformForFace(face, 20)
      return uniform < 0 ? 0 : uniform
    }

  try {
    return await callback()
  } finally {
    CONFIG.Dice.randomUniform = original
  }
}

// === Failure ================================================================

/**
 * Run a callback and hand back the error it threw, if any.
 *
 * Chai has no built-in assertion for a rejected promise, and the usual
 * `try { await x; assert.fail() }` shape swallows the failure it just raised.
 * This keeps the error as a value so a test can assert on it normally.
 * @param {() => Promise<unknown>|unknown} callback - The work expected to fail
 * @returns {Promise<Error|null>} The thrown error, or null if nothing threw
 */
export async function captureRejection(callback) {
  try {
    await callback()
  } catch (error) {
    return error
  }

  return null
}

// === Chat ====================================================================

/**
 * Run a callback and return the chat messages it created.
 *
 * The messages are deleted afterwards so a test run doesn't leave a wall of
 * attack cards in the log.
 * @template T
 * @param {() => Promise<T>|T} callback - The work to do
 * @returns {Promise<{result: T, messages: ChatMessage[]}>} The callback's return
 * value and the messages created while it ran
 */
export async function captureChatMessages(callback) {
  const before = new Set(game.messages.map((message) => message.id))

  const result = await callback()

  const messages = game.messages.filter((message) => !before.has(message.id))
  messages.forEach((message) => trackDocument(message))

  return { result, messages }
}

// === Notifications ===========================================================

/**
 * Run a callback with error and warning notifications collected instead of shown.
 *
 * Several code paths report failure by notifying the user and returning a falsy
 * value rather than throwing, so the notification *is* the observable behaviour.
 * This captures it without covering the screen in red toasts.
 * @template T
 * @param {() => Promise<T>|T} callback - The work to do
 * @returns {Promise<{result: T, errors: string[], warnings: string[]}>} The
 * callback's return value and everything it tried to report
 */
export async function captureNotifications(callback) {
  const originalError = ui.notifications.error
  const originalWarn = ui.notifications.warn

  const errors = []
  const warnings = []

  ui.notifications.error = (message) => {
    errors.push(message)
    return 0
  }
  ui.notifications.warn = (message) => {
    warnings.push(message)
    return 0
  }

  try {
    const result = await callback()
    return { result, errors, warnings }
  } finally {
    ui.notifications.error = originalError
    ui.notifications.warn = originalWarn
  }
}

// === Actions =================================================================

/**
 * The schema for a single action, taken from a registered data model.
 *
 * Reading it off a live data model rather than rebuilding it here means a fixture
 * can't drift away from what the system actually stores. The miscellaneous item
 * is used because its `actions` array is the plain action schema, with none of
 * the weapon's default-attack customisation.
 * @returns {foundry.data.fields.SchemaField} The action schema
 */
function actionSchema() {
  return CONFIG.Item.dataModels.item.schema.fields.actions.element
}

/**
 * Build a valid action object from a partial description.
 *
 * Actions are a deep schema with a lot of required structure, and a hand-written
 * literal that misses a branch fails in a confusing place. This runs the real
 * schema's initial value through `mergeObject`, so a test only writes the parts
 * it cares about and everything else is exactly what the system would have
 * created.
 * @param {object} [overrides] - Properties to merge over the schema defaults
 * @returns {object} A complete action object
 */
export function buildAction(overrides = {}) {
  const action = foundry.utils.mergeObject(
    actionSchema().getInitialValue(),
    { id: foundry.utils.randomID(), name: "Test Action" },
    { inplace: false },
  )

  return foundry.utils.mergeObject(action, overrides, { inplace: false })
}

/**
 * Build a valid action effect object from a partial description.
 * @param {object} [overrides] - Properties to merge over the schema defaults
 * @returns {object} A complete effect object
 */
export function buildActionEffect(overrides = {}) {
  const effect = foundry.utils.mergeObject(
    actionSchema().fields.effects.element.getInitialValue(),
    { id: foundry.utils.randomID() },
    { inplace: false },
  )

  return foundry.utils.mergeObject(effect, overrides, { inplace: false })
}

// === Waiting ================================================================

/**
 * Wait until a condition holds, or give up.
 *
 * Plenty of what these tests observe is started but not awaited by the code that
 * starts it: the `createActor` hook kicks off its work and returns, `close()`
 * dispatches `_onClose` without waiting, and a form change handler runs off an
 * event listener. Polling is the honest way to watch for the result.
 * @param {() => any} predicate - The condition to wait for
 * @param {string} description - What we're waiting for, used in the error
 * @param {number} [timeout] - How long to wait, in milliseconds
 * @returns {Promise<void>} Resolves as soon as the condition holds
 */
export function waitFor(predicate, description, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now()

    const check = () => {
      if (predicate()) {
        resolve()
        return
      }

      if (performance.now() - startedAt > timeout) {
        reject(new Error(`Timed out waiting for ${description}`))
        return
      }

      setTimeout(check, 25)
    }

    check()
  })
}

/**
 * Give work that nothing exposes a handle on a moment to finish.
 *
 * Prefer {@link waitFor} wherever there's something to watch. This is for the
 * cases where the only question is "has the event loop turned over", such as
 * letting an `_onClose` hook run.
 * @returns {Promise<void>} Resolves shortly
 */
export function settle() {
  return new Promise((resolve) => {
    setTimeout(resolve, 100)
  })
}

// === Applications ============================================================

/**
 * Render an application and wait until it's actually on screen.
 *
 * `BAGSApplication#render` doesn't return what `super.render()` gives it, so
 * awaiting it proves nothing -- the await resolves immediately and the window
 * arrives later. Every test that needs a rendered application goes through here
 * so that one missing `return` doesn't turn into a dozen flaky tests. The bug
 * itself is pinned by its own test in the sheets batch.
 * @param {object} application - The application to render
 * @returns {Promise<object>} The same application, now rendered
 */
export async function renderApplication(application) {
  await application.render(true)
  await waitFor(
    () => application.rendered && application.element,
    `${application.constructor.name} to render`,
  )

  return application
}

/**
 * Close an application and wait until it's gone.
 *
 * Also waits out `_onClose`, which ApplicationV2 dispatches without awaiting --
 * and which, in this system, is where a few things like releasing the character
 * sheet gate happen.
 * @param {object} application - The application to close
 * @returns {Promise<void>} Resolves once the window is closed
 */
export async function closeApplication(application) {
  if (!application) return

  await application.close({ animate: false })
  await waitFor(() => !application.rendered, "the application to close")
  await settle()
}

/**
 * Render an application, hand it to a callback, and always close it.
 *
 * A test that throws mid-assertion would otherwise leave its window on screen
 * for the rest of the run.
 * @template T
 * @param {foundry.applications.api.ApplicationV2} application - The app to render
 * @param {(app: object) => Promise<T>|T} callback - The work to do
 * @returns {Promise<T>} Whatever the callback returned
 */
export async function withRenderedApplication(application, callback) {
  await renderApplication(application)

  try {
    return await callback(application)
  } finally {
    await closeApplication(application)
  }
}

/**
 * Change a form field the way a user would, and wait for the result to land.
 *
 * Applications in this system submit on change: the application listens for a
 * `change` event on its form, reads the whole form, and hands it to the save
 * handler. Setting `input.value` on its own does none of that, so a test that
 * wants to prove editing works has to dispatch the event too -- and then wait,
 * because nothing awaits the listener.
 * @param {object} application - The rendered application
 * @param {string} name - The form field's `name` attribute
 * @param {string|boolean} value - The value to set
 * @param {() => any} [settled] - A condition that holds once the save has landed
 * @returns {Promise<void>} Resolves once the change has been applied
 */
export async function changeFormField(application, name, value, settled) {
  const field = application.element.querySelector(`[name="${name}"]`)

  if (!field) throw new Error(`No form field named "${name}" in this window`)

  if (typeof value === "boolean") field.checked = value
  else field.value = value

  field.dispatchEvent(new Event("change", { bubbles: true }))

  await waitFor(settled ?? (() => true), `the change to "${name}" to be saved`)
}

// === Dialogs =================================================================

/**
 * Answer the confirmation dialog that a destructive action is waiting on.
 *
 * These handlers `await DialogV2.confirm(...)` in the middle of their work, so a
 * test has to start the handler, answer the dialog, and only then await the
 * handler's promise:
 *
 *     const pending = ActionEditor.deleteAction.call(app, event)
 *     await answerDialog(true)
 *     await pending
 *
 * Declining is done by dismissing the window rather than clicking "No", because
 * every one of these dialogs is built with `rejectClose: false` -- dismissal and
 * "No" travel the same path, and dismissal needs no button wiring.
 * @param {boolean} accept - Whether to say yes
 * @returns {Promise<void>} Resolves once the dialog is gone
 */
export async function answerDialog(accept) {
  const { DialogV2 } = foundry.applications.api

  const open = () => Array.from(DialogV2.instances())

  await waitFor(() => open().length > 0, "a confirmation dialog to open")

  const [dialog] = open()

  if (accept) dialog.element.querySelector('[data-action="yes"]').click()
  else await dialog.close({ animate: false })

  await waitFor(
    () => !open().includes(dialog),
    "the confirmation dialog to close",
  )
}
