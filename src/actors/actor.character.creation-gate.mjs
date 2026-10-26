/**
 * @file Keeps a character sheet shut while we decide whether to build that
 * character with the creation flow instead.
 *
 * The obvious way to do this would be a `preCreateActor` hook setting
 * `renderSheet: false` on the database operation. That doesn't work, because the
 * sidebar's create dialog never uses that flag. `ClientDocument.createDialog`
 * hardcodes `renderSheet: false` and then opens the sheet itself:
 *
 *     const doc = await cls.create(data, { renderSheet: false, ...createOptions })
 *     doc.sheet.render(true, renderOptions)
 *
 * So there's nothing to switch off -- the sheet is going to be told to render no
 * matter what we ask for. And because that call lands *after* `create()` resolves,
 * it's also after the `createActor` hooks have run, so a hook can neither pre-empt
 * it nor reliably close what it opens. That race is why the creation window used
 * to appear behind the sheet.
 *
 * So instead of arguing with the caller, the sheet declines. We own the character
 * sheet class, and a held sheet turns `render()` into a no-op until the hold is
 * lifted. That covers every route to opening a sheet, not just the create dialog.
 *
 * Holds are keyed by Actor ID and are deliberately in-memory only: a hold that
 * outlived a page reload would be a character sheet that never opens again.
 */

/** IDs of Actors whose sheets are currently held shut. */
const held = new Set()

/**
 * Hold an Actor's sheet shut.
 *
 * Call this synchronously, before awaiting anything. The sheet is told to render
 * very shortly after `createActor` fires, and a hold placed after that point is
 * too late to do any good.
 * @param {Actor} actor - The Actor whose sheet should stay closed
 */
export const holdSheet = (actor) => {
  if (actor?.id) held.add(actor.id)
}

/**
 * Let an Actor's sheet open again.
 *
 * Every path that takes a hold has to release it, including the ones where the
 * player backs out, or the character is left with a sheet that can't be opened.
 * @param {Actor} actor - The Actor to release
 */
export const releaseSheet = (actor) => {
  if (actor?.id) held.delete(actor.id)
}

/**
 * Whether an Actor's sheet is currently being held shut.
 * @param {Actor} actor - The Actor to check
 * @returns {boolean} True while the sheet should refuse to render
 */
export const isSheetHeld = (actor) => !!actor?.id && held.has(actor.id)
