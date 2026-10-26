/**
 * @file Integration tests for the character sheet.
 *
 * A sheet is the one part of the system that can't be unit tested at all. It
 * reads a document, asks the SystemRegistry which rules are in play, hands the
 * result to Handlebars, then mutates the window frame Foundry built for it. Every
 * step of that needs a real document, real settings and a real DOM.
 *
 * These tests are deliberately shallow on appearance and specific about
 * behaviour: they check that the sheet renders without throwing, and that the
 * pieces driven by document data actually reflect that data. What a sheet *looks*
 * like isn't something a test should be asserting on.
 *
 * Editing a character from its sheet lives in `./edit.test.mjs`, and the gate that
 * keeps a brand new character's sheet shut lives in `./creation-offer.test.mjs`.
 */

import {
  cleanUpDocuments,
  createTestCharacter,
  createTestClass,
  createTestItem,
  withRenderedApplication,
} from "../helpers.mjs"

/**
 * Register the character sheet test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerCharacterViewTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.character.view",
    (context) => {
      const { describe, it, assert, after } = context

      describe("The character sheet", function characterSheet() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("renders for a character with nothing on them", async () => {
          const actor = await createTestCharacter()

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isTrue(sheet.rendered)
            assert.instanceOf(sheet.element, HTMLElement)
            assert.isOk(
              sheet.element.querySelector(".left-rail"),
              "the left rail carries every derived stat",
            )
          })
        })

        it("renders for a fully equipped, classed character", async () => {
          const actor = await createTestCharacter({
            abilityScores: { str: 18, dex: 16 },
          })
          await createTestClass({ levels: 5, level: 3, actor })
          const sword = await createTestItem(
            { type: "weapon", name: "Sword", system: { damageBonus: 1 } },
            actor,
          )
          const mail = await createTestItem(
            { type: "armor", name: "Chain Mail", system: { armorBonus: 4 } },
            actor,
          )
          await createTestItem({ type: "item", name: "Rations" }, actor)
          await createTestItem({ type: "ability", name: "Tracking" }, actor)
          await sword.equip()
          await mail.equip()

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isTrue(sheet.rendered)
            assert.lengthOf(
              sheet.element.querySelectorAll(
                ".character-classes .character-class",
              ),
              1,
              "the character's one class should be listed once",
            )
          })
        })

        it("titles the window with the character's name", async () => {
          const actor = await createTestCharacter({
            data: { name: "Fenwick the Unready" },
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.strictEqual(sheet.title, "Fenwick the Unready")
            assert.strictEqual(
              sheet.element.querySelector(".window-title").textContent,
              "Fenwick the Unready",
            )
          })
        })

        it("puts a tile in the inventory for each carried item", async () => {
          const actor = await createTestCharacter()
          await createTestItem({ type: "item", name: "Rope" }, actor)
          await createTestItem({ type: "weapon", name: "Dagger" }, actor)
          await createTestItem({ type: "armor", name: "Shield" }, actor)
          // Non-physical items belong to other tabs, not the inventory.
          await createTestItem({ type: "ability", name: "Listening" }, actor)

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.lengthOf(
              sheet.element.querySelectorAll(
                ".item-grid--inventory uft-item-tile",
              ),
              3,
            )
          })
        })

        it("leaves items inside a container out of the inventory", async () => {
          const actor = await createTestCharacter()
          const bag = await createTestItem(
            {
              type: "item",
              name: "Sack",
              system: { container: { isContainer: true } },
            },
            actor,
          )
          const rope = await createTestItem(
            { type: "item", name: "Rope" },
            actor,
          )

          await rope.addToContainer(bag)

          await withRenderedApplication(actor.sheet, (sheet) => {
            const tiles = sheet.element.querySelectorAll(
              ".item-grid--inventory uft-item-tile",
            )

            assert.lengthOf(
              tiles,
              1,
              "only the sack itself should be on the top level",
            )
            assert.strictEqual(tiles[0].dataset.itemId, bag.id)
          })
        })

        it("offers the spellcasting tab only to a character with spells", async () => {
          const mundane = await createTestCharacter()
          const caster = await createTestCharacter()
          await createTestItem({ type: "spell", name: "Sleep" }, caster)

          // Scoped to the tab bar on purpose. The spells *part* renders either
          // way -- it's the button that appears or doesn't -- so an unscoped
          // `[data-tab="spells"]` matches the empty panel and proves nothing.
          const tabButton = (sheet) =>
            sheet.element.querySelector(
              '.application__tab-navigation [data-tab="spells"]',
            )

          await withRenderedApplication(mundane.sheet, (sheet) => {
            assert.isNull(
              tabButton(sheet),
              "a fighter has no use for a spellcasting tab",
            )
          })

          await withRenderedApplication(caster.sheet, (sheet) => {
            assert.isOk(tabButton(sheet))
          })
        })

        it("renders the ability scores the character actually has", async () => {
          const actor = await createTestCharacter({
            abilityScores: { str: 17 },
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const strength = sheet.element.querySelector(
              '[data-ability-score="str"] .number-showcase__value',
            )

            assert.isOk(strength, "strength should be on the sheet somewhere")
            assert.strictEqual(strength.textContent.trim(), "17")
          })
        })

        it("shows current and maximum hit points on the meter", async () => {
          const actor = await createTestCharacter({
            data: { system: { hp: { value: 4, max: 9 } } },
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const meter = sheet.element.querySelector(
              "uft-character-info-meter.hp",
            )

            assert.isOk(meter)
            assert.strictEqual(meter.getAttribute("value"), "4")
            assert.strictEqual(meter.getAttribute("max"), "9")
          })
        })

        it("picks up a change to the document on re-render", async () => {
          const actor = await createTestCharacter()

          await withRenderedApplication(actor.sheet, async (sheet) => {
            await createTestItem({ type: "item", name: "Lantern" }, actor)
            await sheet.render()

            assert.lengthOf(
              sheet.element.querySelectorAll(
                ".item-grid--inventory uft-item-tile",
              ),
              1,
            )
          })
        })
      })
    },
    { displayName: "BAGS: Character sheet" },
  )
}
