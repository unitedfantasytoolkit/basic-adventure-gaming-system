/**
 * @file Integration tests for whether a new character gets the creation flow.
 *
 * Foundry opens a new Actor's sheet by itself, in a way no hook can head off, so
 * the system holds the sheet shut instead while it works out whether the player
 * wants to build that character step by step. Two things have to be true for that
 * to work, and both of them are timing: the hold has to be taken before the sheet
 * is asked to render, and it has to be released on every path out -- including the
 * ones where the player backs out.
 *
 * A character left with a sheet that refuses to open is the failure this batch
 * exists to catch.
 */

import {
  cleanUpDocuments,
  closeApplication,
  createTestActor,
  createTestCharacter,
  createTestItem,
  createTestMonster,
  settle,
  waitFor,
  withRenderedApplication,
  withSetting,
} from "../helpers.mjs"
import BAGSCharacterCreation from "../../actors/actor.character.creation.mjs"
import {
  holdSheet,
  isSheetHeld,
  releaseSheet,
} from "../../actors/actor.character.creation-gate.mjs"

/**
 * Register the character creation offer test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerCreationOfferTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.character.creation-offer",
    (context) => {
      const { describe, it, assert, after } = context

      // === Local fixtures ====================================================

      /**
       * The open creation window for an Actor, if there is one.
       * @param {Actor} actor - The Actor being built
       * @returns {BAGSCharacterCreation|undefined} The window, if open
       */
      const creationWindowFor = (actor) =>
        Array.from(BAGSCharacterCreation.instances()).find(
          (app) => app.document?.id === actor.id,
        )

      // === The createActor hook ==============================================

      describe("Offering creation to a new character", function offering() {
        this.timeout(25000)

        after(() => cleanUpDocuments())

        it("says nothing when the mode is never", async () => {
          await withSetting("characterCreationMode", "never", async () => {
            const actor = await createTestActor({
              name: "[Quench] Untouched",
              type: "character",
            })

            assert.isFalse(isSheetHeld(actor))

            await settle()

            assert.isUndefined(creationWindowFor(actor))
          })
        })

        it("opens the flow straight away when the mode is always", async () => {
          await withSetting("characterCreationMode", "always", async () => {
            const actor = await createTestActor({
              name: "[Quench] Recruit",
              type: "character",
            })

            // The hold is taken synchronously inside the hook, because the sheet
            // is told to render a moment later.
            assert.isTrue(
              isSheetHeld(actor),
              "the sheet must be held before it is asked to render",
            )

            await waitFor(
              () => creationWindowFor(actor),
              "the creation window to open",
            )

            const flow = creationWindowFor(actor)

            try {
              assert.strictEqual(flow.document.id, actor.id)

              // The window is in the instance registry from the moment rendering
              // starts, so wait for it to finish before closing it: `close()` on
              // an application that has no element yet returns without running
              // `_onClose`, which is what releases the sheet.
              await waitFor(
                () => flow.rendered,
                "the creation window to render",
              )
            } finally {
              await closeApplication(flow)
              if (actor.sheet?.rendered) await closeApplication(actor.sheet)
            }

            assert.isFalse(
              isSheetHeld(actor),
              "closing the flow has to release the sheet",
            )
          })
        })

        it("asks first when the mode is offer, and takes no for an answer", async () => {
          await withSetting("characterCreationMode", "offer", async () => {
            const actor = await createTestActor({
              name: "[Quench] Undecided",
              type: "character",
            })

            const { DialogV2 } = foundry.applications.api

            await waitFor(
              () => Array.from(DialogV2.instances()).length > 0,
              "the offer dialog to open",
            )

            const [dialog] = Array.from(DialogV2.instances())

            // Dismissing the dialog is a "no", which should leave the player
            // looking at an ordinary character sheet.
            await dialog.close({ animate: false })

            await waitFor(
              () => !isSheetHeld(actor),
              "the sheet hold to be released",
            )

            assert.isUndefined(
              creationWindowFor(actor),
              "declining the offer should not open the flow anyway",
            )

            await settle()
            if (actor.sheet?.rendered) await closeApplication(actor.sheet)
          })
        })

        it("leaves an already-built character alone", async () => {
          await withSetting("characterCreationMode", "always", async () => {
            const actor = await createTestCharacter({
              data: { name: "[Quench] Veteran" },
            })

            await settle()

            assert.isFalse(
              isSheetHeld(actor),
              "a character with ability scores has already been built",
            )
            assert.isUndefined(creationWindowFor(actor))
          })
        })

        it("leaves monsters alone", async () => {
          await withSetting("characterCreationMode", "always", async () => {
            const monster = await createTestMonster()

            await settle()

            assert.isFalse(isSheetHeld(monster))
            assert.isUndefined(creationWindowFor(monster))
          })
        })
      })

      // === The gate ==========================================================

      describe("The character creation gate", function creationGate() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("refuses to render a held sheet", async () => {
          const actor = await createTestCharacter()

          holdSheet(actor)

          try {
            const result = await actor.sheet.render(true)

            assert.isTrue(isSheetHeld(actor))
            assert.strictEqual(
              result,
              actor.sheet,
              "render should still resolve to the sheet",
            )
            assert.isFalse(
              actor.sheet.rendered,
              "a held sheet must not appear in front of the creation window",
            )
          } finally {
            releaseSheet(actor)
          }
        })

        it("renders again once the hold is released", async () => {
          const actor = await createTestCharacter()

          holdSheet(actor)
          await actor.sheet.render(true)
          releaseSheet(actor)

          assert.isFalse(isSheetHeld(actor))

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isTrue(sheet.rendered)
          })
        })

        it("holds one character's sheet without holding another's", async () => {
          const held = await createTestCharacter()
          const free = await createTestCharacter()

          holdSheet(held)

          try {
            assert.isTrue(isSheetHeld(held))
            assert.isFalse(isSheetHeld(free))

            await withRenderedApplication(free.sheet, (sheet) => {
              assert.isTrue(sheet.rendered)
            })
          } finally {
            releaseSheet(held)
          }
        })

        it("leaves item sheets alone", async () => {
          const actor = await createTestCharacter()
          const item = await createTestItem(
            { type: "item", name: "Chalk" },
            actor,
          )

          holdSheet(actor)

          try {
            await withRenderedApplication(item.sheet, (sheet) => {
              assert.isTrue(
                sheet.rendered,
                "the gate is only about the character sheet",
              )
            })
          } finally {
            releaseSheet(actor)
          }
        })
      })
    },
    { displayName: "BAGS: Character creation offer" },
  )
}
