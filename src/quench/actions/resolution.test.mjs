/**
 * @file Integration tests for action resolution.
 *
 * The action resolver is the busiest crossroads in the system: it validates an
 * action, spends resources off real documents, asks the selected combat module for
 * an attack roll, rolls damage, applies effects to targets, and posts a chat card
 * describing all of it. The unit tests in `test/action-resolver.test.mjs` cover
 * the arithmetic through a fake adapter; these cover the parts that only exist in
 * a real world -- actual dice, actual document updates, actual chat messages.
 *
 * Dice are pinned with {@link withFixedDice} wherever the outcome matters, so
 * "this attack hits" is a fact rather than a one-in-twenty coincidence.
 *
 * Targets are handed to the resolver directly rather than through
 * `game.user.targets`, because targeting a token requires a rendered canvas.
 * The targets themselves are real placed tokens, which is what Foundry would have
 * put in that set.
 */

import ActionResolver from "../../rules-engines/action-resolver.mjs"
import {
  buildAction,
  buildActionEffect,
  captureChatMessages,
  captureNotifications,
  cleanUpDocuments,
  createTestCharacter,
  createTestClass,
  createTestItem,
  createTestMonster,
  createTestScene,
  createTestToken,
  withFixedDice,
  withRulesModule,
} from "../helpers.mjs"

/**
 * Register the action resolution test batch.
 * @param {object} quench - The Quench instance
 */
export default function registerActionResolutionTests(quench) {
  quench.registerBatch(
    "basic-adventure-gaming-system.actions.resolution",
    (context) => {
      const { describe, it, assert, after } = context

      const combatCategory = () => CONFIG.BAGS.SystemRegistry.categories.COMBAT

      /**
       * Resolve an action for real, capturing the chat card it posts.
       * @param {object} options - Resolution options
       * @param {object} options.action - The action to resolve
       * @param {Actor} options.actor - The actor performing it
       * @param {Item|null} [options.item] - The action's source Item
       * @param {Array} [options.targets] - Tokens being targeted
       * @returns {Promise<{result: unknown, messages: ChatMessage[]}>} The
       * outcome and any chat messages created
       */
      const resolve = ({ action, actor, item = null, targets = [] }) =>
        captureChatMessages(() =>
          new ActionResolver(action, item, actor, targets).resolve(),
        )

      /**
       * A plain attack action: roll to hit, then roll damage.
       * @param {object} [overrides] - Properties to merge into the action
       * @returns {object} The action
       */
      const attackAction = (overrides = {}) =>
        buildAction(
          foundry.utils.mergeObject(
            {
              name: "Sword Swing",
              flags: { usesAttempt: true, usesEffect: true },
              attempt: {
                flags: { isLikeAttack: true },
                // The schema defaults this to 1; a test that wants to reason
                // about totals needs it at zero.
                attack: { type: "melee", bonus: 0 },
              },
              effects: [
                buildActionEffect({
                  name: "Damage",
                  type: "attack",
                  formula: "1d6",
                  flags: { isLikeAttack: true },
                }),
              ],
            },
            overrides,
            { inplace: false },
          ),
        )

      /**
       * The single resolution from an untargeted action.
       * @param {Array} result - The resolver's result
       * @returns {object} The one and only outcome
       */
      const onlyOutcome = (result) => {
        assert.isArray(
          result,
          "the resolver should return an array of outcomes",
        )
        assert.lengthOf(result, 1)
        return result[0]
      }

      describe("Untargeted attacks", function untargeted() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("succeeds and rolls damage with nobody to hit", async () => {
          const actor = await createTestCharacter()

          const { result } = await withFixedDice("max", () =>
            resolve({ action: attackAction(), actor }),
          )

          const outcome = onlyOutcome(result)

          assert.strictEqual(outcome.target, ActionResolver.KEY_WITH_NO_TARGETS)
          assert.isTrue(
            outcome.attempt.success,
            "an attack with no target always lands",
          )
          assert.isFalse(outcome.attempt.hasTarget)
          assert.lengthOf(outcome.effects, 1)
          assert.strictEqual(outcome.effects[0].value, 6)
        })

        it("rolls real dice for damage", async () => {
          const actor = await createTestCharacter()
          const action = attackAction({
            effects: [buildActionEffect({ type: "attack", formula: "2d6+1" })],
          })

          const { result } = await withFixedDice("max", () =>
            resolve({ action, actor }),
          )

          const [effect] = onlyOutcome(result).effects

          assert.strictEqual(effect.value, 13)

          // The resolver rolls a real Roll, but by the time it hands the outcome
          // back, that Roll has been serialized. Posting the chat card puts the
          // outcome through an ObjectField, and Foundry's cleaning walks the
          // object *in place*, calling `toJSON()` on anything that has it. So a
          // caller of `resolveAction` gets Roll data, not a live Roll.
          assert.strictEqual(effect.roll.class, "Roll")
          assert.strictEqual(effect.roll.total, 13)
          assert.lengthOf(
            effect.roll.terms[0].results,
            2,
            "both dice should have been rolled",
          )
        })

        it("adds the actor's melee damage bonus to a melee attack", async () => {
          const strong = await createTestCharacter({
            abilityScores: { str: 18 },
          })

          const { result } = await withFixedDice("max", () =>
            resolve({ action: attackAction(), actor: strong }),
          )

          // 1d6 at its maximum, plus the +3 a strength of 18 grants.
          assert.strictEqual(onlyOutcome(result).effects[0].value, 9)
        })

        it("leaves an untyped attack's damage unmodified", async () => {
          const strong = await createTestCharacter({
            abilityScores: { str: 18 },
          })
          const action = attackAction({
            effects: [
              buildActionEffect({
                type: "attack",
                formula: "1d6",
                flags: { isLikeAttack: false },
              }),
            ],
          })

          const { result } = await withFixedDice("max", () =>
            resolve({ action, actor: strong }),
          )

          assert.strictEqual(onlyOutcome(result).effects[0].value, 6)
        })

        it("resolves an action with no attempt roll at all", async () => {
          const actor = await createTestCharacter()
          const action = buildAction({
            name: "Light a Torch",
            flags: { usesAttempt: false, usesEffect: true },
            effects: [
              buildActionEffect({ type: "misc", description: "It burns." }),
            ],
          })

          const { result } = await resolve({ action, actor })
          const outcome = onlyOutcome(result)

          assert.isTrue(outcome.attempt.success)
          assert.strictEqual(outcome.effects[0].type, "misc")
          assert.strictEqual(outcome.effects[0].message, "It burns.")
        })

        it("rolls against a static target for a non-attack action", async () => {
          const actor = await createTestCharacter()
          const action = buildAction({
            name: "Force a Door",
            flags: { usesAttempt: true, usesEffect: false },
            attempt: {
              flags: { isLikeAttack: false },
              roll: { formula: "1d6", operator: "<=", target: 2 },
            },
          })

          const passed = await withFixedDice("min", () =>
            resolve({ action, actor }),
          )
          assert.isTrue(onlyOutcome(passed.result).attempt.success)

          const failed = await withFixedDice("max", () =>
            resolve({ action, actor }),
          )
          assert.isFalse(onlyOutcome(failed.result).attempt.success)
        })

        it("skips effects when the attempt fails", async () => {
          const actor = await createTestCharacter()
          const action = buildAction({
            name: "Difficult Trick",
            flags: { usesAttempt: true, usesEffect: true },
            attempt: {
              flags: { isLikeAttack: false },
              roll: { formula: "1d20", operator: ">=", target: 20 },
            },
            effects: [buildActionEffect({ type: "attack", formula: "1d6" })],
          })

          const { result } = await withFixedDice("min", () =>
            resolve({ action, actor }),
          )
          const outcome = onlyOutcome(result)

          assert.isFalse(outcome.attempt.success)
          assert.lengthOf(
            outcome.effects,
            0,
            "a failed attempt should have no effects",
          )
        })
      })

      describe("Targeted attacks", function targeted() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("hits a target it can beat and reports a critical", async () => {
          const scene = await createTestScene()
          const attacker = await createTestCharacter()
          // Descending AC 10: an unarmoured, average monster.
          const defender = await createTestMonster({ armorClassOffset: 0 })
          const token = await createTestToken(scene, defender)

          await withRulesModule(combatCategory(), "bx-descending", async () => {
            const { result } = await withFixedDice(20, () =>
              resolve({
                action: attackAction(),
                actor: attacker,
                targets: [token],
              }),
            )

            const outcome = onlyOutcome(result)

            assert.strictEqual(outcome.target, defender.uuid)
            assert.isTrue(outcome.attempt.hasTarget)
            assert.isTrue(outcome.attempt.success)
            assert.isTrue(outcome.attempt.isCriticalHit)
            assert.isFalse(outcome.attempt.isCriticalMiss)
          })
        })

        it("misses on a natural one", async () => {
          const scene = await createTestScene()
          const attacker = await createTestCharacter()
          const defender = await createTestMonster({ armorClassOffset: 0 })
          const token = await createTestToken(scene, defender)

          await withRulesModule(combatCategory(), "bx-descending", async () => {
            const { result } = await withFixedDice(1, () =>
              resolve({
                action: attackAction(),
                actor: attacker,
                targets: [token],
              }),
            )

            const outcome = onlyOutcome(result)

            assert.isFalse(outcome.attempt.success)
            assert.isTrue(outcome.attempt.isCriticalMiss)
            assert.lengthOf(outcome.effects, 0)
          })
        })

        it("misses an armored target a middling roll can't reach", async () => {
          const scene = await createTestScene()
          const attacker = await createTestCharacter()
          // Descending AC 2 needs a 17 to hit with the default THAC0 of 19.
          const defender = await createTestMonster({ armorClassOffset: 8 })
          const token = await createTestToken(scene, defender)

          await withRulesModule(combatCategory(), "bx-descending", async () => {
            assert.strictEqual(defender.system.armorClass, 2)

            const { result } = await withFixedDice(10, () =>
              resolve({
                action: attackAction(),
                actor: attacker,
                targets: [token],
              }),
            )

            assert.isFalse(onlyOutcome(result).attempt.success)
          })
        })

        it("improves the odds with a better THAC0", async () => {
          const scene = await createTestScene()
          const veteran = await createTestCharacter()
          await createTestClass({ levels: 6, level: 6, actor: veteran })
          const defender = await createTestMonster({ armorClassOffset: 8 })
          const token = await createTestToken(scene, defender)

          await withRulesModule(combatCategory(), "bx-descending", async () => {
            // The fixture's table improves THAC0 by one per level: 19 - 5.
            assert.strictEqual(veteran.system.thac0, 14)

            const { result } = await withFixedDice(12, () =>
              resolve({
                action: attackAction(),
                actor: veteran,
                targets: [token],
              }),
            )

            // A 12 clears the 14 - 2 needed, where an average fighter's 12
            // would not have cleared 17.
            assert.isTrue(onlyOutcome(result).attempt.success)
          })
        })

        it("hits by meeting the target's AC under ascending AC", async () => {
          const scene = await createTestScene()
          const attacker = await createTestCharacter()
          const defender = await createTestMonster({ armorClassOffset: 5 })
          const token = await createTestToken(scene, defender)

          await withRulesModule(combatCategory(), "bx-ascending", async () => {
            // Ascending AC counts up from 9.
            assert.strictEqual(defender.system.armorClass, 14)

            const hit = await withFixedDice(15, () =>
              resolve({
                action: attackAction(),
                actor: attacker,
                targets: [token],
              }),
            )
            assert.isTrue(onlyOutcome(hit.result).attempt.success)

            const miss = await withFixedDice(13, () =>
              resolve({
                action: attackAction(),
                actor: attacker,
                targets: [token],
              }),
            )
            assert.isFalse(onlyOutcome(miss.result).attempt.success)
          })
        })

        it("resolves an attempt for every target", async () => {
          const scene = await createTestScene()
          const attacker = await createTestCharacter()
          const first = await createTestMonster({ armorClassOffset: 0 })
          const second = await createTestMonster({ armorClassOffset: 0 })
          const tokens = [
            await createTestToken(scene, first),
            await createTestToken(scene, second),
          ]

          const { result } = await withFixedDice(20, () =>
            resolve({
              action: attackAction(),
              actor: attacker,
              targets: tokens,
            }),
          )

          assert.lengthOf(result, 2)
          assert.sameMembers(
            result.map((outcome) => outcome.target),
            [first.uuid, second.uuid],
          )
        })

        it("names the target in a damage message", async () => {
          const scene = await createTestScene()
          const attacker = await createTestCharacter()
          const defender = await createTestMonster({ armorClassOffset: 0 })
          const token = await createTestToken(scene, defender)

          const { result } = await withFixedDice(20, () =>
            resolve({
              action: attackAction(),
              actor: attacker,
              targets: [token],
            }),
          )

          const [damage] = onlyOutcome(result).effects

          assert.include(damage.message, defender.name)
          assert.include(damage.message, "takes")
        })
      })

      describe("Healing", function healing() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("rolls healing and phrases it as healing", async () => {
          const actor = await createTestCharacter()
          const action = buildAction({
            name: "Cure Light Wounds",
            flags: { usesAttempt: false, usesEffect: true },
            effects: [buildActionEffect({ type: "healing", formula: "1d6+1" })],
          })

          const { result } = await withFixedDice("max", () =>
            resolve({ action, actor }),
          )
          const [effect] = onlyOutcome(result).effects

          assert.strictEqual(effect.type, "healing")
          assert.strictEqual(effect.value, 7)
          assert.include(effect.message, "Healing")
        })
      })

      describe("Resource consumption", function consumption() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("spends one of the item's own quantity", async () => {
          const actor = await createTestCharacter()
          const flask = await createTestItem(
            {
              type: "item",
              name: "Oil Flask",
              system: { quantity: 3 },
            },
            actor,
          )

          const action = attackAction({
            flags: {
              usesAttempt: true,
              usesEffect: true,
              usesConsumption: true,
            },
            consumption: { type: "selfQuantity" },
          })

          await withFixedDice("max", () =>
            resolve({ action, actor, item: flask }),
          )

          assert.strictEqual(flask.system.quantity, 2)
        })

        it("spends one of the item's charges", async () => {
          const actor = await createTestCharacter()
          const wand = await createTestItem(
            {
              type: "item",
              name: "Wand",
              system: { uses: { value: 5, max: 5 } },
            },
            actor,
          )

          const action = attackAction({
            flags: {
              usesAttempt: true,
              usesEffect: true,
              usesConsumption: true,
            },
            consumption: { type: "selfUses" },
          })

          await withFixedDice("max", () =>
            resolve({ action, actor, item: wand }),
          )

          assert.strictEqual(wand.system.uses.value, 4)
        })

        it("spends the action's own uses", async () => {
          const actor = await createTestCharacter()
          const item = await createTestItem(
            { type: "item", name: "Relic" },
            actor,
          )

          await item.createAction()
          const [stored] = item.system.actions

          await item.updateAction(stored.id, {
            flags: {
              ...stored.flags,
              usesAttempt: false,
              usesConsumption: true,
            },
            consumption: { ...stored.consumption, type: "actionUse" },
            uses: { ...stored.uses, value: 2, max: 2 },
          })

          await resolve({
            action: item.getAction(stored.id),
            actor,
            item,
          })

          assert.strictEqual(item.system.actions[0].uses.value, 1)
        })

        it("spends the actor's hit points", async () => {
          const actor = await createTestCharacter()
          await actor.update({ "system.hp.value": 10, "system.hp.max": 10 })

          const action = buildAction({
            name: "Blood Magic",
            flags: { usesAttempt: false, usesConsumption: true },
            consumption: { type: "hp", item: { quantity: 2 } },
          })

          await resolve({ action, actor })

          assert.strictEqual(actor.system.hp.value, 8)
        })

        it("spends the quantity of another item", async () => {
          const actor = await createTestCharacter()
          const arrows = await createTestItem(
            { type: "item", name: "Arrows", system: { quantity: 20 } },
            actor,
          )
          const bow = await createTestItem(
            { type: "weapon", name: "Bow" },
            actor,
          )

          const action = attackAction({
            flags: {
              usesAttempt: true,
              usesEffect: true,
              usesConsumption: true,
            },
            consumption: {
              type: "itemQuantity",
              item: { item: arrows.uuid, quantity: 1 },
            },
          })

          await withFixedDice("max", () =>
            resolve({ action, actor, item: bow }),
          )

          assert.strictEqual(arrows.system.quantity, 19)
        })

        it("refuses to act without the resources to pay for it", async () => {
          const actor = await createTestCharacter()
          await actor.update({ "system.hp.value": 1, "system.hp.max": 10 })

          const action = buildAction({
            name: "Blood Magic",
            flags: { usesAttempt: false, usesConsumption: true },
            consumption: { type: "hp", item: { quantity: 5 } },
          })

          const { result, errors } = await captureNotifications(() =>
            resolve({ action, actor }),
          )

          assert.isFalse(
            result.result,
            "an unaffordable action should not resolve",
          )
          assert.lengthOf(errors, 1)
          assert.include(errors[0], "Insufficient HP")
          assert.strictEqual(
            actor.system.hp.value,
            1,
            "a failed action should not have spent anything",
          )
          assert.lengthOf(
            result.messages,
            0,
            "a refused action should not post a card",
          )
        })

        it("refuses to fire without ammunition", async () => {
          const actor = await createTestCharacter()
          const arrows = await createTestItem(
            { type: "item", name: "Arrows", system: { quantity: 0 } },
            actor,
          )
          const bow = await createTestItem(
            { type: "weapon", name: "Bow" },
            actor,
          )

          const action = attackAction({
            flags: {
              usesAttempt: true,
              usesEffect: true,
              usesConsumption: true,
            },
            consumption: {
              type: "itemQuantity",
              item: { item: arrows.uuid, quantity: 1 },
            },
          })

          const { result, errors } = await captureNotifications(() =>
            resolve({ action, actor, item: bow }),
          )

          assert.isFalse(result.result)
          assert.lengthOf(errors, 1)
          assert.include(errors[0], "Insufficient quantity")
        })
      })

      describe("Validation", function validation() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("refuses an action with no uses left", async () => {
          const actor = await createTestCharacter()
          const action = buildAction({
            name: "Spent Ability",
            flags: { usesAttempt: false },
            uses: { value: 0, max: 3 },
          })

          const { result, errors } = await captureNotifications(() =>
            resolve({ action, actor }),
          )

          assert.isFalse(result.result)
          assert.include(errors[0], "No uses remaining")
        })

        it("allows an action that has never been limited", async () => {
          const actor = await createTestCharacter()
          const action = buildAction({
            name: "Unlimited Ability",
            flags: { usesAttempt: false },
            uses: { value: 0, max: 0 },
          })

          const { result } = await resolve({ action, actor })

          assert.isArray(result, "an unlimited action should resolve")
        })

        it("does not currently enforce a level requirement", async () => {
          const actor = await createTestCharacter()
          await createTestClass({ levels: 6, level: 1, actor })

          const action = buildAction({
            name: "High Level Trick",
            flags: { usesAttempt: false },
            level: { min: 5 },
          })

          const { result } = await resolve({ action, actor })

          // Characterisation test, not an endorsement. The validator reads
          // `system.details.level`, which BAGS characters don't have -- their
          // level lives on the class Item, reachable as `system.class.level` --
          // so the check passes for everyone. When the validator is pointed at
          // the right path, this test should start failing, and that failure is
          // the reminder to invert it.
          assert.isArray(
            result,
            "level restrictions are not enforced against the class's level",
          )
        })
      })

      describe("Chat reporting", function reporting() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("posts one action card describing the outcome", async () => {
          const actor = await createTestCharacter()
          const action = attackAction()

          const { result, messages } = await withFixedDice("max", () =>
            resolve({ action, actor }),
          )

          assert.lengthOf(messages, 1)

          const [message] = messages

          assert.strictEqual(message.type, "action")
          assert.strictEqual(message.system.action, action.id)
          assert.strictEqual(message.system.actor, actor.uuid)
          assert.deepEqual(
            message.system.outcome.map((outcome) => outcome.target),
            result.map((outcome) => outcome.target),
          )
        })

        it("records the source item on the card", async () => {
          const actor = await createTestCharacter()
          const sword = await createTestItem(
            { type: "weapon", name: "Longsword" },
            actor,
          )

          const { messages } = await withFixedDice("max", () =>
            resolve({ action: attackAction(), actor, item: sword }),
          )

          assert.strictEqual(messages[0].system.item, sword.uuid)
        })

        it("whispers a blind action to the gamemasters", async () => {
          const actor = await createTestCharacter()
          const action = attackAction({ flags: { isBlind: true } })

          const { messages } = await withFixedDice("max", () =>
            resolve({ action, actor }),
          )

          const [message] = messages
          const gmIds = game.users.filter((user) => user.isGM).map((u) => u.id)

          assert.isTrue(message.blind)
          assert.sameMembers(message.whisper, gmIds)
        })

        it("whispers a gamemaster-only action to the gamemasters", async () => {
          const actor = await createTestCharacter()
          const action = attackAction({
            attempt: { roll: { type: "gm" } },
          })

          const { messages } = await withFixedDice("max", () =>
            resolve({ action, actor }),
          )

          const gmIds = game.users.filter((user) => user.isGM).map((u) => u.id)

          assert.sameMembers(messages[0].whisper, gmIds)
          assert.isFalse(
            messages[0].blind,
            "a gamemaster-only card is hidden from the players, not from the GM",
          )
        })

        it("posts a public card by default", async () => {
          const actor = await createTestCharacter()

          const { messages } = await withFixedDice("max", () =>
            resolve({ action: attackAction(), actor }),
          )

          assert.isFalse(messages[0].blind)
          assert.lengthOf(messages[0].whisper, 0)
        })

        it("posts nothing when the action is refused", async () => {
          const actor = await createTestCharacter()
          const action = buildAction({
            name: "Spent Ability",
            flags: { usesAttempt: false },
            uses: { value: 0, max: 1 },
          })

          const { result } = await captureNotifications(() =>
            resolve({ action, actor }),
          )

          assert.lengthOf(result.messages, 0)
        })
      })

      describe("Effects applied to targets", function targetEffects() {
        this.timeout(20000)

        after(() => cleanUpDocuments())

        it("runs a script effect with the actor and action in scope", async () => {
          const actor = await createTestCharacter()
          const action = buildAction({
            name: "Scripted",
            flags: { usesAttempt: false, usesEffect: true },
            effects: [
              buildActionEffect({
                type: "script",
                // The resolver compiles the script with `actor`, `target` and
                // `action` in scope. Writing back onto the action object proves
                // it ran, and does so synchronously -- the script is compiled
                // with `new Function`, so it can't use `await`.
                script: "action.ranWithActor = actor.name",
              }),
            ],
          })

          const { result } = await resolve({ action, actor })

          assert.strictEqual(onlyOutcome(result).effects[0].type, "script")
          assert.strictEqual(
            action.ranWithActor,
            actor.name,
            "the script should have run against the acting actor",
          )
        })

        it("applies a condition to the target", async () => {
          const scene = await createTestScene()
          const actor = await createTestCharacter()
          const defender = await createTestMonster()
          const token = await createTestToken(scene, defender)

          const action = buildAction({
            name: "Web",
            flags: { usesAttempt: false, usesEffect: true },
            effects: [
              buildActionEffect({
                type: "effect",
                note: "Entangled",
                condition: {
                  name: "Entangled",
                  changes: [
                    {
                      key: "system.modifiers.speedMultiplier",
                      value: "0",
                      type: "add",
                    },
                  ],
                },
              }),
            ],
          })

          const { result, errors } = await captureNotifications(() =>
            resolve({ action, actor, targets: [token] }),
          )

          // A target is a Token, and effects live on Actors, so the resolver has
          // to reach through the token for one. Creating against the token itself
          // asked Foundry to put an ActiveEffect inside a TokenDocument, which
          // can only hold an ActorDelta, and nothing was applied at all.
          assert.lengthOf(
            errors,
            0,
            `applying a condition reported: ${errors.join("; ")}`,
          )
          assert.isArray(result.result, "applying a condition should resolve")
          assert.include(
            defender.effects.map((effect) => effect.name),
            "Entangled",
            "the condition should end up on the target's actor",
          )
        })
      })
    },
    { displayName: "BAGS: Action resolution" },
  )
}
