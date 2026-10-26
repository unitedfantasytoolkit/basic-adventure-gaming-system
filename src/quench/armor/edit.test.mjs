/**
 * @file Integration tests for editing armor.
 *
 * Armor stores an *offset* from the rules module's base AC, but nobody thinks
 * about armor that way -- a player knows chain mail is "AC 5" (or 16), not "four
 * better than nothing". So the editor converts on the way in and out, and which
 * direction it converts in depends on whether the selected combat module counts AC
 * up or down.
 *
 * These tests are written to be direction-agnostic on purpose: they assert that
 * what the field shows is what the datamodel computes, and that what you type is
 * what the wearer's AC becomes. That holds whichever way the rules count, and it
 * doesn't bake either module's base AC into the expectation.
 */

import {
  changeFormField,
  cleanUpDocuments,
  createTestItem,
  withRulesModule,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the armor editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerArmorEditTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.armor.edit",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor } = editorTools(context)

      // === Local fixtures ====================================================

      /** @returns {string} The SystemRegistry's combat category key */
      const combatCategory = () => CONFIG.BAGS.SystemRegistry.categories.COMBAT

      /**
       * Run a callback with each AC direction selected in turn.
       * @param {(id: string) => Promise<void>} callback - The work to do
       * @returns {Promise<void>} Resolves once both have run
       */
      const withEachDirection = async (callback) => {
        await withRulesModule(combatCategory(), "bx-descending", () =>
          callback("bx-descending"),
        )
        await withRulesModule(combatCategory(), "bx-ascending", () =>
          callback("bx-ascending"),
        )
      }

      describe("The Armor Class field", function armorClass() {
        this.timeout(25000)

        after(() => cleanUpDocuments())

        it("shows the wearer's Armor Class, not the stored offset", async () => {
          await withEachDirection(async (id) => {
            const armor = await createTestItem({
              type: "armor",
              name: "Chain Mail",
              system: { armorClassOffset: 3 },
            })

            await withEditor(armor, "itemEditor", (editor) => {
              const field = editor.element.querySelector('[name="tempAC"]')

              assert.isOk(field, "the editor should offer an AC to edit")
              assert.strictEqual(
                Number(field.value),
                armor.system.armorClass,
                `under ${id} the field should agree with the item`,
              )
              assert.notStrictEqual(
                Number(field.value),
                armor.system.armorClassOffset,
                "an offset of 3 is not an Armor Class of 3",
              )
            })
          })
        })

        it("saves an Armor Class back as the right offset", async () => {
          await withEachDirection(async (id) => {
            const armor = await createTestItem({
              type: "armor",
              name: "Plate Mail",
              system: { armorClassOffset: 0 },
            })

            // Two points better than wearing nothing, whichever way that counts.
            const target =
              armor.system.armorClass +
              (CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
                combatCategory(),
              ).descending
                ? -2
                : 2)

            await withEditor(armor, "itemEditor", async (editor) => {
              await changeFormField(
                editor,
                "tempAC",
                String(target),
                () => armor.system.armorClass === target,
              )

              assert.strictEqual(
                armor.system.armorClass,
                target,
                `under ${id} typing an AC should produce that AC`,
              )
              assert.strictEqual(
                armor.system.armorClassOffset,
                2,
                "and store it as two points of improvement",
              )
            })
          })
        })

        it("keeps the other fields it was saved alongside", async () => {
          const armor = await createTestItem({
            type: "armor",
            name: "Leather",
            system: { armorClassOffset: 2, cost: 20 },
          })

          await withEditor(armor, "itemEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.cost",
              "25",
              () => armor.system.cost === 25,
            )

            assert.strictEqual(armor.system.cost, 25)
            assert.strictEqual(
              armor.system.armorClassOffset,
              2,
              "saving a cost should not disturb the Armor Class",
            )
          })
        })
      })
    },
    { displayName: "BAGS: Armor editing" },
  )
}
