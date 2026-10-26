/**
 * @file Integration tests for editing a weapon.
 *
 * The weapon editor is the only per-type editor that edits an action. Its Attack
 * tab writes straight into `system.attack` -- the same action schema the action
 * editor works on, but flattened into a handful of form fields for the common case
 * of "a sword that does 1d8". Everything it saves has to come back out of
 * `system.actionList` as a usable action, which is what these tests check: the
 * field is written, and the assembled attack agrees with it.
 *
 * How that assembly works is `./attack.test.mjs`. The parts of this window every
 * item editor shares are `applications/item-editor.test.mjs`.
 */

import {
  changeFormField,
  cleanUpDocuments,
  closeApplication,
  createTestItem,
  renderApplication,
  waitFor,
} from "../helpers.mjs"
import editorTools from "../editor-tools.mjs"

/**
 * Register the weapon editing test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerWeaponEditTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.weapon.edit",
    (context) => {
      const { describe, it, assert, after } = context
      const { withEditor, invokeAction } = editorTools(context)

      // === Local fixtures ====================================================

      /**
       * A weapon, and the assembled attack currently on it.
       * @param {Item} weapon - The weapon
       * @returns {object} The first action in its action list
       */
      const attackOf = (weapon) => weapon.system.actionList[0]

      // === The sheet's editors ===============================================

      describe("Opening an editor from the sheet", function opening() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("opens the action editor from an item sheet", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })
          const { sheet } = item

          await renderApplication(sheet)

          try {
            await invokeAction(sheet, "edit-actions")

            await waitFor(
              () => sheet.subApps.actionEditor.rendered,
              "the action editor to open",
            )
          } finally {
            await closeApplication(sheet.subApps.actionEditor)
            await closeApplication(sheet)
          }
        })

        it("declares an action for every editor a sheet owns", async () => {
          const item = await createTestItem({ type: "weapon", name: "Sword" })
          const { sheet } = item

          // A sub-app nothing can open is dead weight, and the two lists drifting
          // apart is an easy mistake to make.
          assert.hasAllKeys(sheet.subApps, [
            "actionEditor",
            "itemEditor",
            "activeEffectEditor",
          ])
          assert.containsAllKeys(sheet.options.actions, [
            "edit-actions",
            "edit-item",
            "edit-active-effects",
          ])
        })
      })

      // === The attack tab ====================================================

      describe("Editing the attack", function attack() {
        this.timeout(25000)

        after(() => cleanUpDocuments())

        it("saves the damage formula onto the stored attack", async () => {
          const weapon = await createTestItem({
            type: "weapon",
            name: "Longsword",
          })

          await withEditor(weapon, "itemEditor", async (editor) => {
            // Note the array index in the field name: the form writes one element
            // of the attack's effects array, not the whole array.
            await changeFormField(
              editor,
              "system.attack.effects.0.formula",
              "1d8",
              () => weapon.system.attack.effects[0].formula === "1d8",
            )

            assert.strictEqual(weapon.system.attack.effects[0].formula, "1d8")
            assert.strictEqual(
              attackOf(weapon).effects[0].formula,
              "1d8",
              "the assembled attack should use the formula that was just saved",
            )
          })
        })

        it("folds a damage bonus saved here into the assembled attack", async () => {
          const weapon = await createTestItem({
            type: "weapon",
            name: "Longsword",
          })

          await withEditor(weapon, "itemEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.damageBonus",
              "2",
              () => weapon.system.damageBonus === 2,
            )

            assert.match(
              attackOf(weapon).effects[0].formula,
              /\+2$/,
              "a damage bonus should show up in the formula the attack rolls",
            )
          })
        })

        it("saves the attack bonus and the attack type", async () => {
          const weapon = await createTestItem({ type: "weapon", name: "Bow" })

          await withEditor(weapon, "itemEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.attack.attempt.attack.bonus",
              "1",
              () => weapon.system.attack.attempt.attack.bonus === 1,
            )
            await changeFormField(
              editor,
              "system.attack.attempt.attack.type",
              "missile",
              () => weapon.system.attack.attempt.attack.type === "missile",
            )

            assert.strictEqual(weapon.system.attack.attempt.attack.bonus, 1)
            assert.strictEqual(
              attackOf(weapon).attempt.attack.type,
              "missile",
              "the attack type decides which of the actor's bonuses apply",
            )
          })
        })

        it("offers the range fields only to a missile weapon", async () => {
          const weapon = await createTestItem({ type: "weapon", name: "Bow" })

          await withEditor(weapon, "itemEditor", async (editor) => {
            const rangeField = () =>
              editor.element.querySelector('[name="system.attack.range.short"]')

            assert.isNull(
              rangeField(),
              "a melee weapon has no range to configure",
            )

            await changeFormField(
              editor,
              "system.attack.attempt.attack.type",
              "missile",
              () => weapon.system.attack.attempt.attack.type === "missile",
            )
            await renderApplication(editor)

            assert.isOk(rangeField(), "a missile weapon does")
          })
        })

        it("takes the whole attack away when the default is turned off", async () => {
          const weapon = await createTestItem({
            type: "weapon",
            name: "Cudgel",
          })

          await withEditor(weapon, "itemEditor", async (editor) => {
            await changeFormField(
              editor,
              "system.usesDefaultAttack",
              false,
              () => weapon.system.usesDefaultAttack === false,
            )
            await renderApplication(editor)

            assert.lengthOf(
              weapon.system.actionList,
              0,
              "a weapon with no default attack has no actions of its own",
            )
            assert.isNull(
              editor.element.querySelector(
                '[name="system.attack.effects.0.formula"]',
              ),
              "and nothing left to configure about one",
            )
          })
        })
      })
    },
    { displayName: "BAGS: Weapon editing" },
  )
}
