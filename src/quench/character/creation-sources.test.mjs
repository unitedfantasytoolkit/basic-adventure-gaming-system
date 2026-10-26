/**
 * @file Integration tests for where character creation gets its choices from.
 *
 * The creation flow offers the player classes, equipment, spells and identity
 * details drawn from wherever the GM pointed it -- world folders, compendium packs,
 * or nothing at all. Resolving those sources means reading real Folders and real
 * packs, which is why it can't be unit tested; what it does with the result once
 * it has it is `./creation.test.mjs`' business.
 */

import { cleanUpDocuments, createTestItem, trackDocument } from "../helpers.mjs"
import getItemsFromSources from "../../common/get-items-from-sources.mjs"

/** An Item compendium that ships with the system, for the happy path. */
const SYSTEM_ITEM_PACK = "basic-adventure-gaming-system.common-items"

/**
 * Register the character creation sources test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerCreationSourceTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.character.creation-sources",
    (context) => {
      const { describe, it, assert, after } = context

      // === Local fixtures ====================================================

      /**
       * Create a Folder that will be cleaned up after the suite.
       * @param {string} [name] - The folder's name
       * @returns {Promise<Folder>} The created Folder
       */
      const createItemFolder = async (name = "[Quench] Sources") =>
        trackDocument(
          await getDocumentClass("Folder").create({ name, type: "Item" }),
        )

      // === Sources ===========================================================

      describe("Reading items from sources", function sources() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("reads the items in a folder", async () => {
          const folder = await createItemFolder()
          await createTestItem({
            type: "class",
            name: "Fighter",
            folder: folder.id,
          })
          await createTestItem({
            type: "class",
            name: "Cleric",
            folder: folder.id,
          })

          const items = await getItemsFromSources([
            { id: folder.id, type: "folder" },
          ])

          assert.lengthOf(items, 2)
        })

        it("keeps only the requested type", async () => {
          const folder = await createItemFolder()
          await createTestItem({
            type: "class",
            name: "Fighter",
            folder: folder.id,
          })
          await createTestItem({
            type: "spell",
            name: "Sleep",
            folder: folder.id,
          })

          const items = await getItemsFromSources(
            [{ id: folder.id, type: "folder" }],
            { type: "class" },
          )

          assert.lengthOf(items, 1)
          assert.strictEqual(items[0].name, "Fighter")
        })

        it("accepts a list of types", async () => {
          const folder = await createItemFolder()
          await createTestItem({
            type: "weapon",
            name: "Sword",
            folder: folder.id,
          })
          await createTestItem({
            type: "armor",
            name: "Shield",
            folder: folder.id,
          })
          await createTestItem({
            type: "spell",
            name: "Sleep",
            folder: folder.id,
          })

          const items = await getItemsFromSources(
            [{ id: folder.id, type: "folder" }],
            { type: ["weapon", "armor"] },
          )

          assert.lengthOf(items, 2)
        })

        it("sorts by name", async () => {
          const folder = await createItemFolder()
          await createTestItem({
            type: "item",
            name: "Zither",
            folder: folder.id,
          })
          await createTestItem({
            type: "item",
            name: "Anvil",
            folder: folder.id,
          })

          const items = await getItemsFromSources([
            { id: folder.id, type: "folder" },
          ])

          assert.deepEqual(
            items.map((item) => item.name),
            ["Anvil", "Zither"],
          )
        })

        it("leaves the order alone when asked not to sort", async () => {
          const folder = await createItemFolder()
          await createTestItem({
            type: "item",
            name: "Zither",
            folder: folder.id,
          })
          await createTestItem({
            type: "item",
            name: "Anvil",
            folder: folder.id,
          })

          const items = await getItemsFromSources(
            [{ id: folder.id, type: "folder" }],
            { sort: false },
          )

          assert.lengthOf(items, 2)
        })

        it("combines several folders", async () => {
          const first = await createItemFolder("[Quench] Sources A")
          const second = await createItemFolder("[Quench] Sources B")
          await createTestItem({
            type: "class",
            name: "Fighter",
            folder: first.id,
          })
          await createTestItem({
            type: "class",
            name: "Thief",
            folder: second.id,
          })

          const items = await getItemsFromSources([
            { id: first.id, type: "folder" },
            { id: second.id, type: "folder" },
          ])

          assert.lengthOf(items, 2)
        })

        it("skips a folder that has gone away and keeps the rest", async () => {
          const folder = await createItemFolder()
          await createTestItem({
            type: "class",
            name: "Fighter",
            folder: folder.id,
          })

          const items = await getItemsFromSources([
            { id: "definitelynotafolder", type: "folder" },
            { id: folder.id, type: "folder" },
          ])

          assert.lengthOf(
            items,
            1,
            "one stale entry should not empty the whole list",
          )
        })

        it("skips a compendium that isn't there", async () => {
          const items = await getItemsFromSources([
            { id: "no-such-module.no-such-pack", type: "compendium" },
          ])

          assert.deepEqual(items, [])
        })

        it("reads a compendium source", async () => {
          const items = await getItemsFromSources(
            [{ id: SYSTEM_ITEM_PACK, type: "compendium" }],
            { type: "item" },
          )

          assert.isArray(items)
          assert.isTrue(
            items.every((item) => item.type === "item"),
            "the type filter should apply to compendium sources too",
          )
        })

        it("returns nothing for nothing", async () => {
          assert.deepEqual(await getItemsFromSources([]), [])
          assert.deepEqual(await getItemsFromSources(null), [])
        })
      })
    },
    { displayName: "BAGS: Character creation sources" },
  )
}
