/**
 * @file Integration tests for the spell sheet.
 *
 * The sheet reads like a spell entry, and which parts of that entry it shows is
 * the world's business rather than the spell's: a Basic game prints a range and
 * a duration, and the Advanced games print the rest. A spell keeps everything it
 * was imported with either way, so the same spell has to render correctly under
 * both.
 */

import {
  cleanUpDocuments,
  createTestClass,
  createTestItem,
  withRenderedApplication,
  withRulesModule,
} from "../helpers.mjs"

/**
 * Register the spell sheet test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerSpellViewTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.spell.view",
    (context) => {
      const { describe, it, assert, after } = context

      const { SPELLS } = CONFIG.BAGS.SystemRegistry.categories

      /**
       * Read every label/value pair out of the sheet's aside.
       *
       * The entry and the classification are separate lists under separate
       * headings, but a test asking "does this sheet show a casting time"
       * doesn't care which list it landed in.
       * @param {object} sheet - The rendered spell sheet
       * @returns {Map<string, string>} The rows, keyed by label
       */
      const readStatBlock = (sheet) => {
        const rows = new Map()

        sheet.element.querySelectorAll("aside dl").forEach((list) => {
          const labels = list.querySelectorAll("dt")
          const values = list.querySelectorAll("dd")

          labels.forEach((label, index) => {
            rows.set(
              label.textContent.trim(),
              values[index]?.textContent.trim() ?? "",
            )
          })
        })

        return rows
      }

      /**
       * A spell with a full Advanced-shaped entry filled in.
       * @param {object} [overrides] - Extra system data
       * @returns {Promise<Item>} The created spell
       */
      const createFullSpell = (overrides = {}) =>
        createTestItem({
          type: "spell",
          name: "Fireball",
          system: foundry.utils.mergeObject(
            {
              level: 3,
              schools: ["Evocation", "Fire"],
              source: "Wizard's Companion",
              entry: {
                range: "10 yds. + 10 yds./level",
                duration: "Instantaneous",
                castingTime: "3 segments",
                areaOfEffect: "20-ft. radius",
                savingThrow: "1/2",
                components: { verbal: true, somatic: true, material: true },
                materials: "a tiny ball of bat guano and sulphur",
              },
            },
            overrides,
          ),
        })

      describe("The spell sheet", function spellSheet() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("always shows the spell's level", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Magic Missile",
            system: { level: 1 },
          })

          await withRenderedApplication(spell.sheet, (sheet) => {
            assert.strictEqual(
              sheet.element
                .querySelector(".spell-level__value")
                .textContent.trim(),
              "1",
            )
          })
        })

        it("shows only what the Basic rules print", async () => {
          const spell = await createFullSpell()

          await withRulesModule(SPELLS, "basic", async () => {
            await withRenderedApplication(spell.sheet, (sheet) => {
              const stats = readStatBlock(sheet)

              assert.strictEqual(stats.get("Range"), "10 yds. + 10 yds./level")
              assert.strictEqual(stats.get("Duration"), "Instantaneous")

              assert.isFalse(
                stats.has("Casting Time"),
                "Basic doesn't print a casting time",
              )
              assert.isFalse(
                stats.has("Area of Effect"),
                "Basic doesn't print an area of effect",
              )
              assert.isFalse(
                stats.has("Saving Throw"),
                "Basic doesn't print a saving throw",
              )
              assert.isFalse(
                stats.has("Components"),
                "Basic has no spell components",
              )
              assert.isFalse(
                stats.has("Schools"),
                "Basic doesn't classify spells",
              )
            })
          })
        })

        it("shows the whole entry under the Advanced rules", async () => {
          const spell = await createFullSpell()

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withRenderedApplication(spell.sheet, (sheet) => {
              const stats = readStatBlock(sheet)

              assert.strictEqual(stats.get("Casting Time"), "3 segments")
              assert.strictEqual(stats.get("Area of Effect"), "20-ft. radius")
              assert.strictEqual(stats.get("Saving Throw"), "1/2")
              assert.strictEqual(stats.get("Components"), "V, S, M")
              assert.strictEqual(stats.get("Schools"), "Evocation, Fire")
            })
          })
        })

        it("keeps a spell's Advanced data through a Basic world", async () => {
          const spell = await createFullSpell()

          await withRulesModule(SPELLS, "basic", async () => {
            await withRenderedApplication(spell.sheet, () => {})
          })

          assert.strictEqual(
            spell.system.entry.castingTime,
            "3 segments",
            "a Basic world hides the casting time, it doesn't eat it",
          )
        })

        it("leaves out entry rows the spell never filled in", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Charm Person",
            system: { level: 1, entry: { range: "120 ft" } },
          })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withRenderedApplication(spell.sheet, (sheet) => {
              const stats = readStatBlock(sheet)

              assert.strictEqual(stats.get("Range"), "120 ft")
              assert.isFalse(stats.has("Duration"))
              assert.isFalse(stats.has("Saving Throw"))
            })
          })
        })

        it("shows spheres only for a divine spell in 2nd Edition", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Cure Light Wounds",
            system: {
              level: 1,
              traditionId: "divine",
              schools: ["Necromancy"],
              spheres: ["Healing"],
            },
          })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withRenderedApplication(spell.sheet, (sheet) => {
              const stats = readStatBlock(sheet)

              assert.strictEqual(stats.get("Schools"), "Necromancy")
              assert.strictEqual(stats.get("Spheres"), "Healing")
            })
          })
        })

        it("keeps spheres off an arcane spell", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Fireball",
            system: {
              level: 3,
              traditionId: "arcane",
              schools: ["Evocation"],
              spheres: ["Combat"],
            },
          })

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withRenderedApplication(spell.sheet, (sheet) => {
              const stats = readStatBlock(sheet)

              assert.strictEqual(stats.get("Schools"), "Evocation")
              assert.isFalse(
                stats.has("Spheres"),
                "spheres belong to the divine list",
              )
            })
          })
        })

        it("keeps spheres off 1st Edition entirely", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Cure Light Wounds",
            system: {
              level: 1,
              traditionId: "divine",
              spheres: ["Healing"],
            },
          })

          await withRulesModule(SPELLS, "advanced-1e", async () => {
            await withRenderedApplication(spell.sheet, (sheet) => {
              assert.isFalse(readStatBlock(sheet).has("Spheres"))
            })
          })
        })

        it("shows the material component under the Advanced rules", async () => {
          const spell = await createFullSpell()

          await withRulesModule(SPELLS, "advanced-2e", async () => {
            await withRenderedApplication(spell.sheet, (sheet) => {
              assert.include(
                sheet.element
                  .querySelector(".spell-materials")
                  .textContent.trim(),
                "bat guano",
              )
            })
          })
        })

        it("keeps the material component out of a Basic world", async () => {
          const spell = await createFullSpell()

          await withRulesModule(SPELLS, "basic", async () => {
            await withRenderedApplication(spell.sheet, (sheet) => {
              assert.isNull(sheet.element.querySelector(".spell-materials"))
            })
          })
        })

        it("lists the classes whose lists carry the spell", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Light",
            system: { level: 1 },
          })

          const elf = await createTestClass({
            data: {
              name: "Elf",
              system: { spellList: [{ uuid: spell.uuid, level: 1 }] },
            },
          })
          const cleric = await createTestClass({
            data: {
              name: "Cleric",
              system: { spellList: [{ uuid: spell.uuid, level: 2 }] },
            },
          })

          assert.isOk(elf && cleric)

          await withRenderedApplication(spell.sheet, (sheet) => {
            const list = sheet.element.querySelector(".spell-class-lists")

            assert.isOk(list, "the class list section should render")
            assert.lengthOf(list.querySelectorAll("dt"), 2)

            const text = list.textContent.replace(/\s+/g, " ").trim()

            assert.include(text, "Elf")
            assert.include(text, "Cleric")
            assert.include(text, "Lv. 1")
            assert.include(text, "Lv. 2")
          })
        })

        it("leaves the class list section off a spell no class lists", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Read Magic",
            system: { level: 1 },
          })

          await withRenderedApplication(spell.sheet, (sheet) => {
            assert.isNull(sheet.element.querySelector(".spell-class-lists"))
          })
        })

        it("links a reversible spell to the spell it reverses into", async () => {
          const darkness = await createTestItem({
            type: "spell",
            name: "Darkness",
            system: { level: 1 },
          })
          const light = await createTestItem({
            type: "spell",
            name: "Light",
            system: {
              level: 1,
              isReversible: true,
              reversedSpellUUID: darkness.uuid,
            },
          })

          await withRenderedApplication(light.sheet, (sheet) => {
            const link = sheet.element.querySelector(
              ".spell-reversal .content-link",
            )

            assert.isOk(link, "a reversible spell should link its pair")
            assert.strictEqual(link.dataset.uuid, darkness.uuid)
            assert.include(link.textContent, "Darkness")
          })
        })

        it("says so when a reversible spell has no pair yet", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Bless",
            system: { level: 1, isReversible: true },
          })

          await withRenderedApplication(spell.sheet, (sheet) => {
            assert.isOk(sheet.element.querySelector(".spell-reversal .empty"))
          })
        })

        it("leaves the reversal section off a spell that isn't reversible", async () => {
          const spell = await createTestItem({
            type: "spell",
            name: "Sleep",
            system: { level: 1, isReversible: false },
          })

          await withRenderedApplication(spell.sheet, (sheet) => {
            assert.isNull(sheet.element.querySelector(".spell-reversal"))
          })
        })
      })
    },
    { displayName: "BAGS: Spell sheet" },
  )
}
