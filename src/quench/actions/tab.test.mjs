/**
 * @file Integration tests for the Actions tab on an actor's sheet.
 *
 * The Actions tab is where an actor is actually *played*, and it is assembled
 * from three places. Exploration skills come from the SystemRegistry -- they
 * belong to the ruleset rather than to the character, and no document stores
 * them. Gear actions come off whatever the actor is using. Innate abilities come
 * off the Items that describe who they are: their class, their ancestry, and any
 * loose abilities they've collected.
 *
 * The middle group is the one worth guarding hardest, because it is the only one
 * that filters. `usableActions.gear` decides what reaches the tab, so a sword in
 * the pack has to stay off it while the sword in hand stays on it, and a change
 * to either has to survive a re-render. Every fixture here therefore carries gear
 * the character is *not* using alongside the gear they are, so "the tab lists two
 * actions" is a claim about filtering rather than a coincidence of only having
 * made two.
 *
 * The tab is shared: a monster sheet renders the same left rail from the same
 * template. The one difference is exploration skills, which are a character's
 * alone, so that difference is asserted rather than assumed.
 *
 * What an action *does* once resolved is `./resolution.test.mjs`. What's tested
 * here is the wiring -- that the tab offers the right actions, and that what it
 * puts in a control's dataset is something the actor can actually resolve.
 */

import {
  buildAction,
  captureChatMessages,
  captureNotifications,
  cleanUpDocuments,
  createTestCharacter,
  createTestClass,
  createTestItem,
  createTestMonster,
  withRenderedApplication,
} from "../helpers.mjs"

/**
 * Register the Actions tab test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerActionsTabTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.actions.tab",
    (context) => {
      const { describe, it, assert, after } = context

      // === Reading the tab =====================================================

      /**
       * The Actions tab inside a rendered sheet's left rail.
       *
       * Scoped to the rail on purpose: the content area has tabs of its own, and
       * the summary tab there builds a second, unrelated action dashboard out of
       * the same `action-source` class names.
       *
       * `section` matters too. A tab's navigation button carries the same
       * `data-group` and `data-tab` as the panel it opens, and it comes first in
       * the document, so a selector that doesn't say which one it wants gets the
       * button -- which is present, empty, and quietly makes every assertion
       * below it pass for the wrong reason.
       * @param {object} sheet - The rendered actor sheet
       * @returns {HTMLElement} The tab's section element
       */
      const actionsTab = (sheet) => {
        const tab = sheet.element.querySelector(
          '.left-rail section.tab[data-group="leftRail"][data-tab="actions"]',
        )
        assert.isOk(tab, "the left rail should have an Actions tab")
        return tab
      }

      /**
       * The exploration skill buttons on the tab, in the order they appear.
       * @param {object} sheet - The rendered actor sheet
       * @returns {HTMLButtonElement[]} The skill buttons
       */
      const explorationSkillButtons = (sheet) =>
        Array.from(
          actionsTab(sheet).querySelectorAll(
            ".action-grid--exploration-skills .action-grid-item",
          ),
        )

      /**
       * The gear action buttons on the tab, in the order they appear.
       *
       * Filtered by `data-action` because the effects list uses the same button
       * class for something that isn't an action at all.
       * @param {object} sheet - The rendered actor sheet
       * @returns {HTMLButtonElement[]} The action buttons
       */
      const gearActionButtons = (sheet) =>
        Array.from(
          actionsTab(sheet).querySelectorAll(
            '.action-list-item[data-action="use-action"]',
          ),
        )

      /**
       * The innate ability tiles on the tab, in the order they appear.
       * @param {object} sheet - The rendered actor sheet
       * @returns {HTMLElement[]} The ability tiles
       */
      const abilityTiles = (sheet) =>
        Array.from(
          actionsTab(sheet).querySelectorAll(
            '.action-grid--abilities bags-action-tile[data-action="use-action"]',
          ),
        )

      /**
       * The exploration skills the selected ruleset defines.
       * @returns {object[]} The skill actions
       */
      const explorationSkills = () =>
        CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
          CONFIG.BAGS.SystemRegistry.categories.CHARACTER_ACTIONS,
        ).actions

      // === Fixtures ============================================================

      /**
       * Create a weapon, equipped or not, with a name to recognise it by.
       *
       * Weapons come with a default attack already on them, so this is a
       * one-action item unless `actions` is passed.
       * @param {object} options - Options for the weapon
       * @param {Actor} options.actor - The Actor to carry it
       * @param {string} options.name - The weapon's name
       * @param {boolean} [options.equipped] - Whether it starts in hand
       * @param {object[]} [options.actions] - Extra actions beyond the attack
       * @returns {Promise<Item>} The created weapon
       */
      const createWeapon = async ({
        actor,
        name,
        equipped = false,
        actions = [],
      }) =>
        createTestItem(
          {
            type: "weapon",
            name,
            system: { isEquipped: equipped, actions },
          },
          actor,
        )

      /**
       * Create an Item of any type carrying one named action.
       *
       * The action is built off the real schema, so an item type whose `actions`
       * field ever gains a required branch fails here rather than quietly
       * storing something the tab can't read.
       * @param {object} options - Options for the item
       * @param {Actor} options.actor - The Actor to carry it
       * @param {string} options.type - The Item type
       * @param {string} options.name - The item's name
       * @param {string} options.action - The action's name
       * @param {object} [options.system] - Extra system data
       * @returns {Promise<Item>} The created Item
       */
      const createItemWithAction = ({
        actor,
        type,
        name,
        action,
        system = {},
      }) =>
        createTestItem(
          {
            type,
            name,
            system: { ...system, actions: [buildAction({ name: action })] },
          },
          actor,
        )

      // === Exploration skills ==================================================

      describe("Exploration skills", function explorationSkillTests() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("gives a character a button for every skill the rules define", async () => {
          const actor = await createTestCharacter()

          await withRenderedApplication(actor.sheet, (sheet) => {
            const buttons = explorationSkillButtons(sheet)
            const skills = explorationSkills()

            assert.isNotEmpty(
              skills,
              "the selected ruleset should define some exploration skills",
            )
            assert.lengthOf(buttons, skills.length)
            assert.deepEqual(
              buttons.map((button) => button.dataset.actionId),
              skills.map((skill) => skill.id),
              "every skill should be offered, in the order the rules list them",
            )
          })
        })

        it("leaves the skills anonymous, so they resolve against the character", async () => {
          const actor = await createTestCharacter()

          await withRenderedApplication(actor.sheet, (sheet) => {
            explorationSkillButtons(sheet).forEach((button) => {
              assert.isUndefined(
                button.dataset.itemId,
                "an exploration skill belongs to nothing the character carries",
              )
            })
          })
        })

        it("does not offer them to a monster", async () => {
          const monster = await createTestMonster()

          await withRenderedApplication(monster.sheet, (sheet) => {
            assert.isNull(
              actionsTab(sheet).querySelector(
                ".action-grid--exploration-skills",
              ),
              "exploration skills are a character's, not a monster's",
            )
          })
        })

        it("resolves the skill a button asks for", async () => {
          const actor = await createTestCharacter({
            abilityScores: { str: 13 },
          })

          // Read the button's own dataset rather than the registry, because the
          // dataset is the contract: the sheet's click handler hands exactly
          // these two values to `resolveAction`, and nothing else checks that
          // what the template writes is something the actor can look up.
          const { actionId, itemId } = await withRenderedApplication(
            actor.sheet,
            (sheet) => ({ ...explorationSkillButtons(sheet)[0].dataset }),
          )

          const { messages } = await captureChatMessages(() =>
            actor.resolveAction(actionId, itemId),
          )

          assert.lengthOf(
            messages,
            1,
            "attempting an exploration skill should report to the table",
          )
        })
      })

      // === Equipped gear =======================================================

      describe("Actions from equipped gear", function equippedGearTests() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("lists an equipped weapon's attack", async () => {
          const actor = await createTestCharacter()
          const sword = await createWeapon({
            actor,
            name: "Longsword",
            equipped: true,
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const [button, ...rest] = gearActionButtons(sheet)

            assert.isOk(button, "the sword in hand should be usable")
            assert.isEmpty(rest, "a plain sword carries one action")
            assert.strictEqual(button.dataset.itemId, sword.id)
            assert.strictEqual(
              button.dataset.actionId,
              sword.system.actionList[0].id,
            )
          })
        })

        it("keeps a stowed weapon's actions off the tab", async () => {
          const actor = await createTestCharacter()
          await createWeapon({ actor, name: "Drawn Dagger", equipped: true })
          await createWeapon({ actor, name: "Spare Dagger" })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const buttons = gearActionButtons(sheet)

            assert.lengthOf(
              buttons,
              1,
              "only the dagger actually in hand should be listed",
            )
            assert.include(
              actionsTab(sheet).textContent,
              "Drawn Dagger",
              "the drawn dagger should be named on the tab",
            )
            assert.notInclude(
              actionsTab(sheet).textContent,
              "Spare Dagger",
              "the spare should not be",
            )
          })
        })

        it("ignores actions on gear that is carried but not worn", async () => {
          const actor = await createTestCharacter()

          // Every one of these carries an action, and none of them is in use.
          // A tab that lists any of them is reading the wrong collection.
          await createWeapon({
            actor,
            name: "Packed Axe",
            actions: [buildAction({ name: "Hew" })],
          })
          await createItemWithAction({
            actor,
            type: "armor",
            name: "Packed Shield",
            action: "Shield Bash",
          })
          await createItemWithAction({
            actor,
            type: "item",
            name: "Packed Horn",
            action: "Sound the Horn",
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isEmpty(
              gearActionButtons(sheet),
              "nothing the character is merely carrying should be usable",
            )
            assert.isOk(
              actionsTab(sheet).querySelector(".action-list .empty"),
              "the tab should say there is nothing to use",
            )
          })
        })

        it("lists worn armor and used items, not only weapons", async () => {
          const actor = await createTestCharacter()
          const shield = await createItemWithAction({
            actor,
            type: "armor",
            name: "Shield",
            action: "Shield Bash",
            system: { isEquipped: true },
          })
          const horn = await createItemWithAction({
            actor,
            type: "item",
            name: "Horn of Blasting",
            action: "Sound the Horn",
            system: { isEquipped: true },
          })
          const sword = await createWeapon({
            actor,
            name: "Sword",
            equipped: true,
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const owners = new Set(
              gearActionButtons(sheet).map((button) => button.dataset.itemId),
            )

            assert.deepEqual(
              owners,
              new Set([shield.id, horn.id, sword.id]),
              "everything in use should be usable, whatever type it is",
            )
          })
        })

        it("honours gear that stays usable while stowed", async () => {
          const actor = await createTestCharacter()
          const wand = await createItemWithAction({
            actor,
            type: "item",
            name: "Wand of Sparks",
            action: "Zap",
            system: {
              isEquipped: false,
              areActionsAvailableWhenUnequipped: true,
            },
          })
          // Same state, without the flag. It is what proves the flag is doing
          // the work rather than the tab having given up on filtering.
          await createItemWithAction({
            actor,
            type: "item",
            name: "Packed Lantern",
            action: "Light It",
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const buttons = gearActionButtons(sheet)

            assert.lengthOf(buttons, 1)
            assert.strictEqual(buttons[0].dataset.itemId, wand.id)
          })
        })

        it("lists every action a weapon carries, not only its attack", async () => {
          const actor = await createTestCharacter()
          const halberd = await createWeapon({
            actor,
            name: "Halberd",
            equipped: true,
            actions: [
              buildAction({ name: "Set Against Charge" }),
              buildAction({ name: "Hook and Trip" }),
            ],
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const buttons = gearActionButtons(sheet)

            assert.lengthOf(buttons, 3, "the attack plus its two manoeuvres")
            assert.deepEqual(
              buttons.map((button) => button.dataset.actionId),
              halberd.system.actionList.map((action) => action.id),
            )
            assert.deepEqual(
              buttons.map((button) => button.dataset.itemId),
              buttons.map(() => halberd.id),
              "every button should point back at the halberd",
            )
          })
        })

        it("lists each equipped weapon separately", async () => {
          const actor = await createTestCharacter()
          const sword = await createWeapon({
            actor,
            name: "Sword",
            equipped: true,
          })
          const dagger = await createWeapon({
            actor,
            name: "Offhand Dagger",
            equipped: true,
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const owners = new Set(
              gearActionButtons(sheet).map((button) => button.dataset.itemId),
            )

            assert.deepEqual(
              owners,
              new Set([sword.id, dagger.id]),
              "both weapons in hand should be represented",
            )
          })
        })

        it("names the source on every row", async () => {
          // Two weapons whose attacks are both called "Attack". Without the
          // source on the row there is nothing on screen to tell them apart.
          const actor = await createTestCharacter()
          await createWeapon({ actor, name: "Sword", equipped: true })
          await createWeapon({ actor, name: "Offhand Dagger", equipped: true })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const sources = gearActionButtons(sheet).map((button) =>
              button
                .querySelector(".action-list-item__parent")
                .textContent.trim(),
            )

            assert.deepEqual(
              new Set(sources),
              new Set(["Sword", "Offhand Dagger"]),
            )
          })
        })

        it("puts weapons before the rest of the pack", async () => {
          const actor = await createTestCharacter()
          // Created in the wrong order on purpose.
          await createItemWithAction({
            actor,
            type: "item",
            name: "Horn",
            action: "Sound the Horn",
            system: { isEquipped: true },
          })
          await createItemWithAction({
            actor,
            type: "armor",
            name: "Shield",
            action: "Shield Bash",
            system: { isEquipped: true },
          })
          const sword = await createWeapon({
            actor,
            name: "Sword",
            equipped: true,
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const [first] = gearActionButtons(sheet)

            assert.strictEqual(
              first.dataset.itemId,
              sword.id,
              "what you reach for in a fight should be at the top",
            )
          })
        })

        it("picks up a weapon being drawn and put away", async () => {
          const actor = await createTestCharacter()
          const sword = await createWeapon({ actor, name: "Sword" })

          await withRenderedApplication(actor.sheet, async (sheet) => {
            assert.isEmpty(
              gearActionButtons(sheet),
              "the sword starts in the pack",
            )

            await sword.equip()
            await sheet.render()
            assert.lengthOf(
              gearActionButtons(sheet),
              1,
              "drawing the sword should offer its attack",
            )

            await sword.unequip()
            await sheet.render()
            assert.isEmpty(
              gearActionButtons(sheet),
              "putting it away should take the attack back",
            )
          })
        })

        it("resolves the action a gear button asks for", async () => {
          const actor = await createTestCharacter()
          const sword = await createWeapon({
            actor,
            name: "Longsword",
            equipped: true,
          })

          const { actionId, itemId } = await withRenderedApplication(
            actor.sheet,
            (sheet) => ({ ...gearActionButtons(sheet)[0].dataset }),
          )

          const { result, messages } = await captureChatMessages(() =>
            actor.resolveAction(actionId, itemId),
          )

          assert.isOk(
            result,
            "the actor should be able to resolve what the tab offered",
          )
          assert.lengthOf(messages, 1)
          assert.strictEqual(
            messages[0].system.item,
            sword.uuid,
            "the card should credit the weapon the action came from",
          )
        })
      })

      // === Innate abilities ====================================================

      describe("Actions from who the actor is", function abilityTests() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        /**
         * A character carrying one action from each innate source, plus a
         * couple of things that should be ignored.
         * @param {Actor} actor - The Actor to equip
         * @returns {Promise<Record<string, Item>>} The created Items, by role
         */
        const createInnateFixture = async (actor) => {
          const characterClass = await createItemWithAction({
            actor,
            type: "class",
            name: "Thief",
            action: "Pick Pockets",
          })
          const ancestry = await createItemWithAction({
            actor,
            type: "identity",
            name: "Halfling",
            action: "Hide in Undergrowth",
          })
          const ability = await createItemWithAction({
            actor,
            type: "ability",
            name: "Berserker Rage",
            action: "Rage",
          })

          // A trait with nothing to do -- the sort of thing that grants its
          // benefit through an Active Effect. It has no place in a grid of
          // things you choose to do.
          await createTestItem({ type: "ability", name: "Keen Hearing" }, actor)
          // Spells have a tab, a preparation step and a manager of their own.
          await createItemWithAction({
            actor,
            type: "spell",
            name: "Magic Missile",
            action: "Cast",
          })

          return { characterClass, ancestry, ability }
        }

        it("gathers actions from a class, an ancestry and an ability alike", async () => {
          const actor = await createTestCharacter()
          const { characterClass, ancestry, ability } =
            await createInnateFixture(actor)

          await withRenderedApplication(actor.sheet, (sheet) => {
            const tiles = abilityTiles(sheet)

            assert.lengthOf(tiles, 3)
            assert.deepEqual(
              new Set(tiles.map((tile) => tile.dataset.itemId)),
              new Set([characterClass.id, ancestry.id, ability.id]),
              "all three innate sources should be represented, and nothing else",
            )
          })
        })

        it("keeps spells and passive traits out of the grid", async () => {
          const actor = await createTestCharacter()
          await createInnateFixture(actor)

          await withRenderedApplication(actor.sheet, (sheet) => {
            const named = actionsTab(sheet).textContent

            assert.notInclude(named, "Magic Missile")
            assert.notInclude(named, "Keen Hearing")
          })
        })

        it("lists every action a single source carries", async () => {
          const actor = await createTestCharacter()
          const thief = await createTestItem(
            {
              type: "class",
              name: "Thief",
              system: {
                actions: [
                  buildAction({ name: "Pick Pockets" }),
                  buildAction({ name: "Climb Sheer Surfaces" }),
                  buildAction({ name: "Hear Noise" }),
                ],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            const tiles = abilityTiles(sheet)

            assert.lengthOf(tiles, 3)
            assert.deepEqual(
              tiles.map((tile) => tile.dataset.actionId),
              thief.system.actionList.map((action) => action.id),
            )
          })
        })

        it("leaves the section out when there is nothing innate to do", async () => {
          const actor = await createTestCharacter()
          // Gear only. A character who can do nothing but swing a sword should
          // not get an empty heading with a blank space under it.
          await createWeapon({ actor, name: "Sword", equipped: true })

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isNull(
              actionsTab(sheet).querySelector(".action-grid--abilities"),
            )
          })
        })

        it("gives a monster its abilities too", async () => {
          const monster = await createTestMonster()
          const ability = await createItemWithAction({
            actor: monster,
            type: "ability",
            name: "Gaze",
            action: "Petrifying Gaze",
          })

          await withRenderedApplication(monster.sheet, (sheet) => {
            const tiles = abilityTiles(sheet)

            assert.lengthOf(tiles, 1)
            assert.strictEqual(tiles[0].dataset.itemId, ability.id)
          })
        })

        it("points each tile at the action it renders", async () => {
          const actor = await createTestCharacter()
          const ability = await createItemWithAction({
            actor,
            type: "ability",
            name: "Berserker Rage",
            action: "Rage",
          })

          await withRenderedApplication(actor.sheet, async (sheet) => {
            const [tile] = abilityTiles(sheet)

            // The tile resolves its own action out of the document it's given,
            // so a `uuid` the sheet writes wrongly leaves it blank rather than
            // throwing anywhere a test would notice.
            assert.strictEqual(tile.getAttribute("uuid"), ability.uuid)
            assert.strictEqual(
              tile.getAttribute("action-id"),
              ability.system.actionList[0].id,
            )
            assert.strictEqual(
              tile.getAttribute("aria-label"),
              "Rage",
              "the tile should have found its action and named itself for it",
            )
          })
        })

        it("resolves the action an ability tile asks for", async () => {
          const actor = await createTestCharacter()
          const ability = await createItemWithAction({
            actor,
            type: "ability",
            name: "Berserker Rage",
            action: "Rage",
          })

          const { actionId, itemId } = await withRenderedApplication(
            actor.sheet,
            (sheet) => ({ ...abilityTiles(sheet)[0].dataset }),
          )

          const { messages } = await captureChatMessages(() =>
            actor.resolveAction(actionId, itemId),
          )

          assert.lengthOf(messages, 1)
          assert.strictEqual(messages[0].system.item, ability.uuid)
        })
      })

      // === Spent actions =======================================================

      describe("Actions the actor has used up", function exhaustedTests() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        /**
         * An action with a limited number of uses.
         * @param {object} options - Options for the action
         * @param {string} options.name - The action's name
         * @param {number} options.max - Uses when full
         * @param {number} options.value - Uses left
         * @returns {object} The action
         */
        const limited = ({ name, max, value }) =>
          buildAction({ name, uses: { max, value } })

        it("keeps a spent gear action on the tab, greyed", async () => {
          const actor = await createTestCharacter()
          const horn = await createTestItem(
            {
              type: "item",
              name: "Horn of Blasting",
              system: {
                isEquipped: true,
                actions: [
                  limited({ name: "Sound the Horn", max: 2, value: 0 }),
                ],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            const [button, ...rest] = gearActionButtons(sheet)

            assert.isOk(button, "a spent action is still the character's")
            assert.isEmpty(rest)
            assert.strictEqual(button.dataset.itemId, horn.id)
            assert.isDefined(
              button.dataset.exhausted,
              "it should read as spent rather than disappear",
            )
            assert.strictEqual(button.getAttribute("aria-disabled"), "true")
          })
        })

        it("leaves an action with charges left alone", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "item",
              name: "Wand of Sparks",
              system: {
                isEquipped: true,
                actions: [limited({ name: "Zap", max: 7, value: 4 })],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            const [button] = gearActionButtons(sheet)

            assert.isUndefined(button.dataset.exhausted)
            assert.isNull(button.getAttribute("aria-disabled"))
          })
        })

        it("shows what's left of a limited action", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "item",
              name: "Wand of Sparks",
              system: {
                isEquipped: true,
                actions: [limited({ name: "Zap", max: 7, value: 4 })],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            const uses = gearActionButtons(sheet)[0].querySelector(
              ".action-list-item__uses",
            )

            assert.isOk(uses)
            assert.strictEqual(uses.textContent.trim(), "4/7")
          })
        })

        it("says nothing about uses for an unlimited action", async () => {
          const actor = await createTestCharacter()
          await createWeapon({ actor, name: "Sword", equipped: true })

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isNull(
              gearActionButtons(sheet)[0].querySelector(
                ".action-list-item__uses",
              ),
              "a sword doesn't run out",
            )
          })
        })

        it("greys a spent ability tile without removing it", async () => {
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "ability",
              name: "Berserker Rage",
              system: {
                actions: [
                  limited({ name: "Rage", max: 1, value: 0 }),
                  limited({ name: "Second Wind", max: 2, value: 1 }),
                ],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            const tiles = abilityTiles(sheet)

            assert.lengthOf(tiles, 2, "both stay on the tab")
            assert.isTrue(tiles[0].hasAttribute("exhausted"))
            assert.isFalse(tiles[1].hasAttribute("exhausted"))
          })
        })

        it("keeps a spent action usable enough to explain itself", async () => {
          // Spent, not disabled. Clicking is how the player finds out why it
          // won't go, so the resolver has to be reachable and has to refuse.
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "ability",
              name: "Berserker Rage",
              system: {
                actions: [limited({ name: "Rage", max: 1, value: 0 })],
              },
            },
            actor,
          )

          const { actionId, itemId } = await withRenderedApplication(
            actor.sheet,
            (sheet) => ({ ...abilityTiles(sheet)[0].dataset }),
          )

          const { result, errors } = await captureNotifications(() =>
            actor.resolveAction(actionId, itemId),
          )

          assert.isFalse(result, "the resolver should turn it down")
          assert.lengthOf(errors, 1)
          assert.include(errors[0], "No uses remaining")
        })
      })

      // === An actor's own actions ==============================================

      describe("Actions written on the actor itself", function innateTests() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("gives a monster its stat block's actions", async () => {
          const medusa = await createTestMonster({
            data: {
              name: "Medusa",
              system: { actions: [buildAction({ name: "Petrifying Gaze" })] },
            },
          })

          await withRenderedApplication(medusa.sheet, (sheet) => {
            const [tile, ...rest] = abilityTiles(sheet)

            assert.isOk(tile, "a monster's gaze is the point of the monster")
            assert.isEmpty(rest)
            assert.strictEqual(
              tile.getAttribute("uuid"),
              medusa.uuid,
              "the tile should point at the monster, not at an item",
            )
            assert.strictEqual(
              tile.dataset.itemId,
              "",
              "there is no item to look the action up in",
            )
          })
        })

        it("resolves what a monster's own tile asks for", async () => {
          const medusa = await createTestMonster({
            data: {
              name: "Medusa",
              system: { actions: [buildAction({ name: "Petrifying Gaze" })] },
            },
          })

          const { actionId, itemId } = await withRenderedApplication(
            medusa.sheet,
            (sheet) => ({ ...abilityTiles(sheet)[0].dataset }),
          )

          const { result, messages } = await captureChatMessages(() =>
            medusa.resolveAction(actionId, itemId),
          )

          assert.isOk(result)
          assert.lengthOf(messages, 1)
          assert.isNotOk(
            messages[0].system.item,
            "nothing but the monster is responsible for it",
          )
        })

        it("does not list a character's exploration skills twice", async () => {
          // A character's `system.actions` is the ruleset's exploration skills,
          // which already have a section of their own further up the tab.
          const actor = await createTestCharacter()

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isNotEmpty(explorationSkillButtons(sheet))
            assert.isNull(
              actionsTab(sheet).querySelector(".action-grid--abilities"),
              "the abilities grid should have nothing to show",
            )
          })
        })
      })

      // === Level restrictions ==================================================

      describe("Actions the actor hasn't earned yet", function levelTests() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        /**
         * An action restricted to a range of levels.
         * @param {object} options - Options for the action
         * @param {string} options.name - The action's name
         * @param {number} [options.min] - The lowest level it's available at
         * @param {number} [options.max] - The highest
         * @returns {object} The action
         */
        const restrictedAction = ({ name, min, max }) =>
          buildAction({
            name,
            level: { min, max },
            flags: { usesRestrictions: true },
          })

        it("keeps a class ability off the tab until its level", async () => {
          const actor = await createTestCharacter()
          const thief = await createTestClass({
            levels: 5,
            level: 1,
            actor,
            data: {
              name: "Thief",
              system: {
                actions: [
                  restrictedAction({ name: "Pick Pockets", min: 1 }),
                  restrictedAction({ name: "Read Scrolls", min: 10 }),
                ],
              },
            },
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            const tiles = abilityTiles(sheet)

            assert.lengthOf(tiles, 1)
            assert.strictEqual(
              tiles[0].dataset.actionId,
              thief.system.actionList[0].id,
              "only the trick a 1st-level thief actually has",
            )
          })
        })

        it("hands it over once the class gets there", async () => {
          const actor = await createTestCharacter()
          const thief = await createTestClass({
            levels: 10,
            level: 9,
            actor,
            data: {
              name: "Thief",
              system: {
                actions: [restrictedAction({ name: "Read Scrolls", min: 10 })],
              },
            },
          })

          await withRenderedApplication(actor.sheet, async (sheet) => {
            assert.isEmpty(abilityTiles(sheet), "not yet at 9th")

            await thief.update({ "system.manuallySetLevel": 10 })
            await sheet.render()

            assert.lengthOf(abilityTiles(sheet), 1, "10th level earns it")
          })
        })

        it("measures a class ability against that class, not the character", async () => {
          // The classic multiclass trap: plenty of levels, none of them in the
          // class that would grant the ability.
          const actor = await createTestCharacter()
          await createTestClass({
            levels: 9,
            level: 9,
            actor,
            data: { name: "Fighter" },
          })
          await createTestClass({
            levels: 5,
            level: 1,
            actor,
            data: {
              name: "Thief",
              system: {
                actions: [restrictedAction({ name: "Read Scrolls", min: 10 })],
              },
            },
          })

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isEmpty(
              abilityTiles(sheet),
              "nine levels of fighting don't make a better thief",
            )
          })
        })

        it("measures gear against the character's best class", async () => {
          const actor = await createTestCharacter()
          await createTestClass({
            levels: 9,
            level: 6,
            actor,
            data: { name: "Fighter" },
          })
          const wand = await createTestItem(
            {
              type: "item",
              name: "Wand of Sparks",
              system: {
                isEquipped: true,
                actions: [
                  restrictedAction({ name: "Zap", min: 5 }),
                  restrictedAction({ name: "Overload", min: 8 }),
                ],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            const buttons = gearActionButtons(sheet)

            assert.lengthOf(buttons, 1)
            assert.strictEqual(
              buttons[0].dataset.actionId,
              wand.system.actionList[0].id,
              "a 6th-level character gets the 5th-level charge, not the 8th",
            )
          })
        })

        it("retires an ability the character has outgrown", async () => {
          const actor = await createTestCharacter()
          await createTestClass({
            levels: 9,
            level: 5,
            actor,
            data: { name: "Fighter" },
          })
          await createTestItem(
            {
              type: "ability",
              name: "Apprentice Trick",
              system: {
                actions: [restrictedAction({ name: "Fumble About", max: 4 })],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.isEmpty(
              abilityTiles(sheet),
              "a 5th-level character is past a 4th-level-and-under trick",
            )
          })
        })

        it("ignores a level range the author turned off", async () => {
          const actor = await createTestCharacter()
          await createTestClass({ levels: 5, level: 1, actor })
          await createTestItem(
            {
              type: "ability",
              name: "Berserker Rage",
              system: {
                // Restrictions cleared, but the numbers linger the way the
                // editor leaves them.
                actions: [
                  buildAction({
                    name: "Rage",
                    level: { min: 10 },
                    flags: { usesRestrictions: false },
                  }),
                ],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.lengthOf(abilityTiles(sheet), 1)
          })
        })

        it("offers nothing the resolver would turn down", async () => {
          // The two have to agree. A control that appears and then refuses is
          // worse than one that never appeared.
          const actor = await createTestCharacter()
          await createTestClass({
            levels: 5,
            level: 1,
            actor,
            data: {
              name: "Thief",
              system: {
                actions: [
                  restrictedAction({ name: "Pick Pockets", min: 1 }),
                  restrictedAction({ name: "Read Scrolls", min: 10 }),
                ],
              },
            },
          })

          const offered = await withRenderedApplication(actor.sheet, (sheet) =>
            abilityTiles(sheet).map((tile) => ({ ...tile.dataset })),
          )

          const outcomes = await Promise.all(
            offered.map(({ actionId, itemId }) =>
              captureChatMessages(() => actor.resolveAction(actionId, itemId)),
            ),
          )

          outcomes.forEach(({ result }, index) => {
            assert.isOk(
              result,
              `the tab offered "${offered[index].actionId}", so it should resolve`,
            )
          })
        })

        it("leaves a classless character's abilities alone", async () => {
          // Nobody has a level yet. Refusing everything would make a character
          // mid-creation look broken.
          const actor = await createTestCharacter()
          await createTestItem(
            {
              type: "identity",
              name: "Halfling",
              system: {
                actions: [
                  restrictedAction({ name: "Hide in Undergrowth", min: 1 }),
                ],
              },
            },
            actor,
          )

          await withRenderedApplication(actor.sheet, (sheet) => {
            assert.lengthOf(abilityTiles(sheet), 1)
          })
        })

        it("measures a monster by its hit dice", async () => {
          const weak = await createTestMonster({
            data: { system: { hp: { hitDice: { count: 2 } } } },
          })
          const mighty = await createTestMonster({
            data: { system: { hp: { hitDice: { count: 8 } } } },
          })

          const giveGaze = (monster) =>
            createTestItem(
              {
                type: "ability",
                name: "Gaze",
                system: {
                  actions: [
                    restrictedAction({ name: "Petrifying Gaze", min: 6 }),
                  ],
                },
              },
              monster,
            )

          await giveGaze(weak)
          await giveGaze(mighty)

          await withRenderedApplication(weak.sheet, (sheet) => {
            assert.isEmpty(abilityTiles(sheet), "two hit dice isn't enough")
          })
          await withRenderedApplication(mighty.sheet, (sheet) => {
            assert.lengthOf(abilityTiles(sheet), 1, "eight hit dice is")
          })
        })
      })
    },
    { displayName: "BAGS: Actions tab" },
  )
}
