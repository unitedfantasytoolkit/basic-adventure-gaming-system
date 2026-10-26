/**
 * @file Integration tests for editing a spell.
 *
 * The editor asks for whatever the world's spell rules print and nothing else,
 * splits comma-separated schools and spheres back into arrays on save, and
 * offers the world's harvested vocabulary as suggestions without enforcing it.
 */

import {
  changeFormField,
  cleanUpDocuments,
  createTestItem,
  withRulesModule,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the spell editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerSpellEditTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.spell.edit",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor } = editorTools(context)

      const { SPELLS } = CONFIG.BAGS.SystemRegistry.categories

      describe("Editing a spell", function editing() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("saves an entry field", async () => {
          const spell = await createTestItem({ type: "spell", name: "Web" })

          await withEditor(spell, "itemEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.entry.range",
              "10 yds./level",
              () => spell.system.entry.range === "10 yds./level",
            )

            assert.strictEqual(spell.system.entry.range, "10 yds./level")
          })
        })

        it("only offers the fields this world prints", async () => {
          const spell = await createTestItem({ type: "spell", name: "Haste" })

          await withRulesModule(SPELLS, "basic", async () => {
            await withEditor(spell, "itemEditor", (editor) => {
              assert.isOk(
                editor.element.querySelector('[name="system.entry.range"]'),
                "Basic prints a range",
              )
              assert.isNull(
                editor.element.querySelector(
                  '[name="system.entry.castingTime"]',
                ),
                "Basic has no casting time to offer",
              )
              assert.isNull(
                editor.element.querySelector('[name="schoolsText"]'),
                "Basic doesn't classify spells",
              )
            })
          })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withEditor(spell, "itemEditor", (editor) => {
              assert.isOk(
                editor.element.querySelector(
                  '[name="system.entry.castingTime"]',
                ),
                "the Advanced games print a casting time",
              )
              assert.isOk(editor.element.querySelector('[name="schoolsText"]'))
            })
          })
        })

        it("offers spheres only to a divine spell", async () => {
          const divine = await createTestItem({
            type: "spell",
            name: "Bless",
            system: { traditionId: "divine" },
          })
          const arcane = await createTestItem({
            type: "spell",
            name: "Shield",
            system: { traditionId: "arcane" },
          })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withEditor(divine, "itemEditor", (editor) => {
              assert.isOk(editor.element.querySelector('[name="spheresText"]'))
            })

            await withEditor(arcane, "itemEditor", (editor) => {
              assert.isNull(
                editor.element.querySelector('[name="spheresText"]'),
              )
            })
          })
        })

        it("splits comma-separated schools into an array", async () => {
          const spell = await createTestItem({ type: "spell", name: "Haste" })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withEditor(spell, "itemEditor", async (editor) => {
              await changeFormField(
                editor,
                "schoolsText",
                "Alteration, Necromancy , Water",
                () => spell.system.schools.length === 3,
              )

              assert.deepEqual(Array.from(spell.system.schools), [
                "Alteration",
                "Necromancy",
                "Water",
              ])
            })
          })
        })

        it("drops blank entries from a trailing comma", async () => {
          const spell = await createTestItem({ type: "spell", name: "Shield" })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withEditor(spell, "itemEditor", async (editor) => {
              await changeFormField(
                editor,
                "schoolsText",
                "Evocation, ,",
                () => spell.system.schools.length === 1,
              )

              assert.deepEqual(Array.from(spell.system.schools), ["Evocation"])
            })
          })
        })

        it("takes a school the rules module never heard of", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Starfall",
          })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withEditor(spell, "itemEditor", async (editor) => {
              await changeFormField(
                editor,
                "schoolsText",
                "Cosmic",
                () => spell.system.schools.length === 1,
              )

              assert.deepEqual(Array.from(spell.system.schools), ["Cosmic"])
            })
          })
        })

        it("suggests the rules module's schools without enforcing them", async () => {
          const spell = await createTestItem({ type: "spell", name: "Haste" })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withEditor(spell, "itemEditor", (editor) => {
              const options = Array.from(
                editor.element.querySelectorAll(
                  "#spell-school-suggestions option",
                ),
              ).map((option) => option.value)

              assert.include(options, "Necromancy")
              assert.include(options, "Illusion/Phantasm")

              assert.strictEqual(
                editor.element
                  .querySelector('[name="schoolsText"]')
                  .getAttribute("list"),
                "spell-school-suggestions",
                "the field should be a suggestion box, not a select",
              )
            })
          })
        })

        it("saves the spell's tradition", async () => {
          const spell = await createTestItem({ type: "spell", name: "Bless" })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withEditor(spell, "itemEditor", async (editor) => {
              await changeFormField(
                editor,
                "system.traditionId",
                "divine",
                () => spell.system.traditionId === "divine",
              )

              assert.strictEqual(spell.system.traditionId, "divine")
              assert.strictEqual(spell.system.tradition.id, "divine")
            })
          })
        })

        it("saves a component and its material", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Fireball",
          })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withEditor(spell, "itemEditor", async (editor) => {
              await changeFormField(
                editor,
                "system.entry.components.material",
                true,
                () => spell.system.entry.components.material === true,
              )

              assert.isTrue(spell.system.entry.components.material)

              await changeFormField(
                editor,
                "system.entry.materials",
                "bat guano",
                () => spell.system.entry.materials === "bat guano",
              )

              assert.strictEqual(spell.system.entry.materials, "bat guano")
            })
          })
        })
      })
    },
    { displayName: "BAGS: Spell editing" },
  )
}
