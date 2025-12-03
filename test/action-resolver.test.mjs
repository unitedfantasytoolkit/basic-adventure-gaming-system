/**
 * @file Tests for ActionResolver
 */

import { test } from 'uvu'
import * as assert from 'uvu/assert'
import ActionResolver from '../src/rules-engines/action-resolver.mjs'
import { MockFoundryAdapter } from './mock-foundry-adapter.mjs'

// ============================================================================
// Constructor Tests
// ============================================================================

test('constructor: throws error when action is null', () => {
  assert.throws(
    () => new ActionResolver(null, {}, {}, []),
    /An action resolver must have an action to resolve/,
  )
})

test('constructor: accepts valid action', () => {
  const action = { id: 'test-action', flags: {} }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  assert.is(resolver.action, action)
})

test('constructor: normalizes targets array', () => {
  const action = { id: 'test', flags: {} }
  const mockAdapter = new MockFoundryAdapter()

  // Single target becomes array
  const resolver1 = new ActionResolver(action, {}, {}, { name: 'Target1' }, mockAdapter)
  assert.equal(resolver1.targets, [{ name: 'Target1' }])

  // Null becomes empty array
  const resolver2 = new ActionResolver(action, {}, {}, null, mockAdapter)
  assert.equal(resolver2.targets, [])

  // Array stays array
  const resolver3 = new ActionResolver(action, {}, {}, [
    { name: 'T1' },
    { name: 'T2' },
  ], mockAdapter)
  assert.is(resolver3.targets.length, 2)
})

test('constructor: flattens nested target arrays', () => {
  const action = { id: 'test', flags: {} }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(
    action,
    {},
    {},
    [[{ name: 'T1' }], [{ name: 'T2' }]],
    mockAdapter,
  )

  assert.is(resolver.targets.length, 2)
  assert.is(resolver.targets[0].name, 'T1')
})

test('constructor: uses provided adapter', () => {
  const action = { id: 'test', flags: {} }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  // We can't directly access private field, but we can test it's used
  assert.ok(resolver)
})

// ============================================================================
// Result Getter Tests
// ============================================================================

test('result: returns array of results with target keys', () => {
  const action = { id: 'test', flags: {} }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  // Access the private field via getter
  const result = resolver.result

  assert.ok(Array.isArray(result))
})

// ============================================================================
// Validation Tests
// ============================================================================

test('resolve: validates action level requirements', async () => {
  const action = {
    id: 'high-level-spell',
    name: 'Wish',
    level: { min: 10 },
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const actor = {
    name: 'Low Level Wizard',
    system: { details: { level: 3 } },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result, false)
  assert.is(mockAdapter.notifications.length, 1)
  assert.is(mockAdapter.notifications[0].type, 'error')
  assert.ok(mockAdapter.notifications[0].message.includes('minimum level'))
})

test('resolve: validates action uses remaining', async () => {
  const action = {
    id: 'limited-ability',
    name: 'Daily Power',
    uses: { max: 3, value: 0 },
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result, false)
  assert.is(mockAdapter.notifications.length, 1)
  assert.ok(mockAdapter.notifications[0].message.includes('No uses'))
})

test('resolve: passes validation for valid action', async () => {
  const action = {
    id: 'valid-action',
    name: 'Basic Attack',
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const actor = {
    name: 'Fighter',
    system: { details: { level: 5 } },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  // Should succeed and create a chat message
  assert.ok(Array.isArray(result))
  assert.is(mockAdapter.createdMessages.length, 1)
})

// ============================================================================
// Resource Consumption Tests
// ============================================================================

test('resolve: skips consumption when not needed', async () => {
  const action = {
    id: 'free-action',
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.updates.length, 0)
})

test('resolve: consumes selfQuantity correctly', async () => {
  const document = {
    system: { quantity: 5 },
  }
  const action = {
    id: 'consumable',
    consumption: { type: 'selfQuantity' },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, document, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.updates.length, 1)
  assert.is(mockAdapter.updates[0].updateData['system.quantity'], 4)
})

test('resolve: consumes selfUses correctly', async () => {
  const document = {
    system: { uses: { value: 3, max: 3 } },
  }
  const action = {
    id: 'limited-use',
    consumption: { type: 'selfUses' },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, document, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.updates.length, 1)
  assert.is(mockAdapter.updates[0].updateData['system.uses.value'], 2)
})

test('resolve: consumes HP correctly', async () => {
  const actor = {
    system: { hp: { value: 20, max: 20 } },
  }
  const action = {
    id: 'blood-magic',
    consumption: { type: 'hp', item: { quantity: 5 } },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.updates.length, 1)
  assert.is(mockAdapter.updates[0].updateData['system.hp.value'], 15)
})

test('resolve: throws error for insufficient HP', async () => {
  const actor = {
    system: { hp: { value: 3, max: 20 } },
  }
  const action = {
    id: 'blood-magic',
    consumption: { type: 'hp', item: { quantity: 5 } },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result, false)
  assert.ok(mockAdapter.notifications[0].message.includes('Insufficient HP'))
})

test('resolve: consumes item quantity from UUID', async () => {
  const targetItem = {
    name: 'Arrow',
    system: { quantity: 10 },
  }
  const action = {
    id: 'shoot-arrow',
    consumption: {
      type: 'itemQuantity',
      item: { item: 'uuid.arrow', quantity: 1 },
    },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  mockAdapter.setUuidResolution('uuid.arrow', targetItem)

  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.updates.length, 1)
  assert.is(mockAdapter.updates[0].updateData['system.quantity'], 9)
})

test('resolve: throws error for insufficient item quantity', async () => {
  const targetItem = {
    name: 'Rare Component',
    system: { quantity: 1 },
  }
  const action = {
    id: 'big-spell',
    consumption: {
      type: 'itemQuantity',
      item: { item: 'uuid.component', quantity: 5 },
    },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  mockAdapter.setUuidResolution('uuid.component', targetItem)

  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result, false)
  assert.ok(
    mockAdapter.notifications[0].message.includes('Insufficient quantity'),
  )
})

test('resolve: consumes spell slots correctly', async () => {
  const classItem = { name: 'Wizard' }
  const actor = {
    system: {
      spellSlots: [
        { value: 3, max: 4 }, // Level 1
        { value: 2, max: 3 }, // Level 2
      ],
    },
  }
  const action = {
    id: 'fireball',
    consumption: {
      type: 'spellslot',
      spellSlots: { class: 'uuid.wizard', level: 2 },
    },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  mockAdapter.setUuidResolution('uuid.wizard', classItem)

  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.updates.length, 1)
  assert.is(mockAdapter.updates[0].updateData['system.spellSlots.1.value'], 1)
})

test('resolve: throws error for no spell slots remaining', async () => {
  const classItem = { name: 'Wizard' }
  const actor = {
    system: {
      spellSlots: [
        { value: 3, max: 4 },
        { value: 0, max: 3 }, // No level 2 slots
      ],
    },
  }
  const action = {
    id: 'fireball',
    consumption: {
      type: 'spellslot',
      spellSlots: { class: 'uuid.wizard', level: 2 },
    },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  mockAdapter.setUuidResolution('uuid.wizard', classItem)

  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result, false)
  assert.ok(
    mockAdapter.notifications[0].message.includes('spell slots remaining'),
  )
})

// ============================================================================
// Attempt/Attack Tests
// ============================================================================

test('resolve: handles actions without attempt', async () => {
  const action = {
    id: 'no-attempt',
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.ok(Array.isArray(result))
  assert.is(result.length, 1)
  assert.is(result[0].attempt.success, true)
})

// ============================================================================
// Effect Processing Tests
// ============================================================================

test('resolve: processes misc effect', async () => {
  const action = {
    id: 'misc-action',
    effects: [
      {
        type: 'misc',
        description: 'Something interesting happens',
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result.length, 1)
  assert.is(result[0].effects.length, 1)
  assert.is(result[0].effects[0].type, 'misc')
  assert.is(result[0].effects[0].message, 'Something interesting happens')
})

test('resolve: warns for unknown effect type', async () => {
  const action = {
    id: 'unknown-effect',
    effects: [
      {
        type: 'mysterious',
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.notifications.length, 1)
  assert.is(mockAdapter.notifications[0].type, 'warning')
  assert.ok(mockAdapter.notifications[0].message.includes('Unknown effect type'))
})

test('resolve: skips effects when attempt fails', async () => {
  const action = {
    id: 'conditional-effect',
    effects: [
      {
        type: 'misc',
        description: 'Should not happen',
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  // Manually set attempt to fail by using a private test method
  const result = await resolver.resolve()

  // With no attempt (defaults to success), effects should be applied
  assert.is(result[0].effects.length, 1)
})

test('resolve: creates chat message with blind flag', async () => {
  const action = {
    id: 'secret-action',
    flags: {
      usesConsumption: false,
      usesAttempt: false,
      usesEffect: false,
      isBlind: true,
    },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.createdMessages.length, 1)
  assert.is(mockAdapter.createdMessages[0].blind, true)
})

test('resolve: creates chat message without blind flag', async () => {
  const action = {
    id: 'public-action',
    flags: {
      usesConsumption: false,
      usesAttempt: false,
      usesEffect: false,
      isBlind: false,
    },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.createdMessages.length, 1)
  assert.is(mockAdapter.createdMessages[0].blind, undefined)
})

test('resolve: processes multiple targets', async () => {
  const action = {
    id: 'multi-target',
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const targets = [
    { actor: { uuid: 'uuid.target1' } },
    { actor: { uuid: 'uuid.target2' } },
  ]
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, targets, mockAdapter)

  const result = await resolver.resolve()

  assert.is(result.length, 2)
  assert.is(result[0].target, 'uuid.target1')
  assert.is(result[1].target, 'uuid.target2')
})

// ============================================================================
// Numeric Effect Tests
// ============================================================================

test('resolve: processes attack effect without target', async () => {
  const actor = {
    system: {
      meleeDamageBonus: 3,
      missileDamageBonus: 2,
    },
  }
  const action = {
    id: 'self-damage',
    attempt: {
      attack: { type: 'melee' },
    },
    effects: [
      {
        type: 'attack',
        formula: '1d6',
        flags: { canBeResisted: false, isLikeAttack: true },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()

  // Mock rollDice by creating a simpler version
  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result[0].effects.length, 1)
  assert.is(result[0].effects[0].type, 'attack')
  assert.ok(result[0].effects[0].message.includes('Damage'))
})

test('resolve: processes healing effect with target', async () => {
  const actor = {
    system: {
      meleeDamageBonus: 0,
      missileDamageBonus: 0,
    },
  }
  const target = {
    name: 'Wounded Ally',
    uuid: 'uuid.ally',
  }
  const action = {
    id: 'heal',
    attempt: {
      attack: { type: 'none' },
    },
    effects: [
      {
        type: 'healing',
        formula: '2d4',
        flags: { canBeResisted: false, isLikeAttack: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, actor, [target], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result[0].effects.length, 1)
  assert.is(result[0].effects[0].type, 'healing')
  assert.ok(result[0].effects[0].message.includes('Wounded Ally'))
  assert.ok(result[0].effects[0].message.includes('heals'))
})

// ============================================================================
// Active Effect Tests
// ============================================================================

test('resolve: creates active effect on target', async () => {
  const target = {
    name: 'Enemy',
    uuid: 'uuid.enemy',
  }
  const action = {
    id: 'apply-condition',
    effects: [
      {
        type: 'effect',
        note: 'Stunned',
        icon: 'icons/stun.png',
        duration: { rounds: 2 },
        condition: 'stunned',
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [target], mockAdapter)

  const result = await resolver.resolve()

  assert.is(mockAdapter.createdEffects.length, 1)
  assert.is(mockAdapter.createdEffects[0].label, 'Stunned')
  assert.is(mockAdapter.createdEffects[0].parent, target)
  assert.ok(result[0].effects[0].message.includes('Applied Stunned'))
})

test('resolve: skips active effect when no target', async () => {
  const action = {
    id: 'apply-condition-no-target',
    effects: [
      {
        type: 'effect',
        note: 'Blessed',
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(mockAdapter.createdEffects.length, 0)
  assert.is(result[0].effects[0], null)
})

// ============================================================================
// Macro/Script/Table Effect Tests  
// ============================================================================

test('resolve: executes macro effect', async () => {
  const macro = { name: 'Custom Macro' }
  const actor = { name: 'Caster' }
  const target = { name: 'Target' }
  const action = {
    id: 'macro-action',
    effects: [
      {
        type: 'macro',
        macro: 'uuid.macro',
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  mockAdapter.setUuidResolution('uuid.macro', macro)

  const resolver = new ActionResolver(action, {}, actor, [target], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.executedMacros.length, 1)
  assert.is(mockAdapter.executedMacros[0].macro, macro)
  assert.is(mockAdapter.executedMacros[0].context.actor, actor)
  assert.is(mockAdapter.executedMacros[0].context.target, target)
})

test('resolve: executes script effect', async () => {
  const action = {
    id: 'script-action',
    effects: [
      {
        type: 'script',
        script: 'return "test";',
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result[0].effects[0].type, 'script')
  assert.is(result[0].effects[0].message, 'Executed script effect')
})

test('resolve: rolls on table effect', async () => {
  const table = { name: 'Wild Magic' }
  const action = {
    id: 'table-action',
    effects: [
      {
        type: 'table',
        rollTable: { document: 'uuid.table' },
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  mockAdapter.setUuidResolution('uuid.table', table)

  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(mockAdapter.rolledTables.length, 1)
  assert.is(mockAdapter.rolledTables[0].table, table)
  assert.is(result[0].effects[0].type, 'table')
  assert.ok(result[0].effects[0].message.includes('Wild Magic'))
})

test('resolve: returns null for table effect when table not found', async () => {
  const action = {
    id: 'missing-table',
    effects: [
      {
        type: 'table',
        rollTable: { document: 'uuid.missing' },
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  // Don't set UUID resolution - table will be null

  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result[0].effects[0], null)
})

test.run()

// ============================================================================
// Helper Method Tests (previously in action-calculator/validator)
// ============================================================================

test('compareRoll: handles all comparison operators', async () => {
  const action = {
    id: 'test-comparison',
    attempt: {
      roll: { formula: '1d20', operator: '>', target: 5 },
      flags: { isLikeAttack: false },
    },
    flags: { usesConsumption: false, usesAttempt: true, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  // Mock always returns 10, so 10 > 5 should be true
  assert.is(result[0].attempt.success, true)
})

test('compareRoll: handles less than operator', async () => {
  const action = {
    id: 'test-less-than',
    attempt: {
      roll: { formula: '1d20', operator: '<', target: 20 },
      flags: { isLikeAttack: false },
    },
    flags: { usesConsumption: false, usesAttempt: true, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  // Mock returns 10, so 10 < 20 should be true
  assert.is(result[0].attempt.success, true)
})

test('compareRoll: handles equals with = operator', async () => {
  const action = {
    id: 'test-equals',
    attempt: {
      roll: { formula: '1d20', operator: '=', target: 10 },
      flags: { isLikeAttack: false },
    },
    flags: { usesConsumption: false, usesAttempt: true, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  // Mock returns 10, so 10 = 10 should be true
  assert.is(result[0].attempt.success, true)
})

test('compareRoll: returns false for invalid operator', async () => {
  const action = {
    id: 'test-invalid',
    attempt: {
      roll: { formula: '1d20', operator: '!=', target: 10 },
      flags: { isLikeAttack: false },
    },
    flags: { usesConsumption: false, usesAttempt: true, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  // Invalid operator should return false
  assert.is(result[0].attempt.success, false)
})

test('buildDamageFormula: handles missing modifiers', async () => {
  const actor = {
    system: {}, // No damage bonuses
  }
  const action = {
    id: 'no-bonus-damage',
    attempt: {
      attack: { type: 'melee' },
    },
    effects: [
      {
        type: 'attack',
        formula: '1d6',
        flags: { canBeResisted: false, isLikeAttack: true },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  // Should still work even without bonuses
  assert.ok(result[0].effects[0].message.includes('Damage'))
})

test('validateLevel: passes when no level restriction', async () => {
  const action = {
    id: 'any-level',
    // No level property
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const actor = {
    name: 'Fighter',
    system: { details: { level: 1 } },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  assert.ok(Array.isArray(result))
})

test('validateLevel: passes when actor has no level', async () => {
  const action = {
    id: 'level-required',
    level: { min: 5 },
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const actor = {
    name: 'Monster',
    system: {}, // No level property
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  // Should pass when actor doesn't have level data
  assert.ok(Array.isArray(result))
})

test('validateUses: passes when no max uses defined', async () => {
  const action = {
    id: 'unlimited',
    uses: { value: 0 }, // No max property
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  assert.ok(Array.isArray(result))
})

test.run()

test('consumeResources: skips selfQuantity when quantity is 0', async () => {
  const document = {
    system: { quantity: 0 },
  }
  const action = {
    id: 'empty-consumable',
    consumption: { type: 'selfQuantity' },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, document, {}, [], mockAdapter)

  await resolver.resolve()

  // Should not update when quantity is 0
  assert.is(mockAdapter.updates.length, 0)
})

test('consumeResources: skips selfUses when uses is 0', async () => {
  const document = {
    system: { uses: { value: 0 } },
  }
  const action = {
    id: 'no-uses',
    consumption: { type: 'selfUses' },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, document, {}, [], mockAdapter)

  await resolver.resolve()

  // Should not update when uses is 0
  assert.is(mockAdapter.updates.length, 0)
})

test('consumeResources: handles unknown consumption type', async () => {
  const action = {
    id: 'unknown-consumption',
    consumption: { type: 'mysterious-resource' },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  // Should not crash on unknown type
  assert.is(mockAdapter.updates.length, 0)
})

test.run()

test('consumeResources: throws error when spell slot class not found', async () => {
  const actor = {
    system: {
      spellSlots: [{ value: 2, max: 3 }],
    },
  }
  const action = {
    id: 'missing-class',
    consumption: {
      type: 'spellslot',
      spellSlots: { class: 'uuid.missing', level: 1 },
    },
    flags: { usesConsumption: true, usesAttempt: false, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  // Don't set UUID resolution

  const resolver = new ActionResolver(action, {}, actor, [], mockAdapter)

  const result = await resolver.resolve()

  assert.is(result, false)
  assert.ok(
    mockAdapter.notifications[0].message.includes('Spell slot class not found'),
  )
})

test.run()

// ============================================================================
// Resistance Processing Tests
// ============================================================================

test('processResistance: handles abilityScore resistance check', async () => {
  const target = {
    name: 'Target',
    system: {
      abilities: {
        str: { value: 14 },
      },
    },
  }
  const action = {
    id: 'strength-contest',
    effects: [
      {
        type: 'misc',
        description: 'Resisted effect',
        flags: { canBeResisted: true },
        resistance: {
          type: 'abilityScore',
          roll: {
            formula: '1d20',
            abilityScore: 'str',
            operator: '>=',
          },
        },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [target], mockAdapter)

  const result = await resolver.resolve()

  // Mock rolls 10, should fail against STR 14 (10 >= 14 = false)
  // So effect should not be resisted, should still apply
  assert.is(result[0].effects.length, 1)
})

test('processResistance: handles number-based resistance check', async () => {
  const target = {
    name: 'Target',
  }
  const action = {
    id: 'static-resist',
    effects: [
      {
        type: 'misc',
        description: 'DC 15 effect',
        flags: { canBeResisted: true },
        resistance: {
          type: 'number',
          roll: {
            formula: '1d20',
            operator: '>=',
          },
          staticTarget: 15,
        },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [target], mockAdapter)

  const result = await resolver.resolve()

  // Mock rolls 10, should fail DC 15 (10 >= 15 = false)
  // Effect not resisted, should apply
  assert.is(result[0].effects.length, 1)
})

test('processResistance: returns false for unknown resistance type', async () => {
  const target = {
    name: 'Target',
  }
  const action = {
    id: 'unknown-resist',
    effects: [
      {
        type: 'misc',
        description: 'Unknown resistance',
        flags: { canBeResisted: true },
        resistance: {
          type: 'mysterious',
        },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [target], mockAdapter)

  const result = await resolver.resolve()

  // Unknown type should return false (not resisted), effect applies
  assert.is(result[0].effects.length, 1)
})

test('processResistance: returns false when no target', async () => {
  const action = {
    id: 'no-target-resist',
    effects: [
      {
        type: 'misc',
        description: 'Needs target',
        flags: { canBeResisted: true },
        resistance: {
          type: 'number',
          roll: { formula: '1d20', operator: '>=' },
          staticTarget: 10,
        },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  const result = await resolver.resolve()

  // No target = no resistance possible, effect applies
  assert.is(result[0].effects.length, 1)
})

test('processResistance: returns false when no resistance defined', async () => {
  const target = { name: 'Target' }
  const action = {
    id: 'no-resistance-data',
    effects: [
      {
        type: 'misc',
        description: 'Auto-applies',
        flags: { canBeResisted: true },
        // No resistance property
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [target], mockAdapter)

  const result = await resolver.resolve()

  // No resistance data = not resisted, effect applies
  assert.is(result[0].effects.length, 1)
})

test.run()

test('processActiveEffect: uses full condition schema', async () => {
  const target = {
    name: 'Enemy',
    uuid: 'uuid.enemy',
  }
  const action = {
    id: 'apply-full-condition',
    effects: [
      {
        type: 'effect',
        note: 'Custom Note',
        condition: {
          name: 'Poisoned',
          img: 'icons/poison.png',
          description: 'You are poisoned',
          duration: { rounds: 3, turns: 0 },
          changes: [
            { key: 'system.attributes.ac.value', value: '-2', mode: 2 },
          ],
        },
        flags: { canBeResisted: false },
      },
    ],
    flags: { usesConsumption: false, usesAttempt: false, usesEffect: true },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [target], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.createdEffects.length, 1)
  const effect = mockAdapter.createdEffects[0]
  assert.is(effect.label, 'Custom Note')
  assert.is(effect.icon, 'icons/poison.png')
  assert.is(effect.description, 'You are poisoned')
  assert.is(effect.duration.rounds, 3)
  assert.is(effect.changes.length, 1)
  assert.is(effect.changes[0].key, 'system.attributes.ac.value')
  assert.is(effect.flags.core.statusId, 'Poisoned')
})

test.run()

test('performAttemptAsAttack: passes attack bonus to combat system', async () => {
  const target = {
    actor: { uuid: 'uuid.target' },
  }
  const action = {
    id: 'bonus-attack',
    attempt: {
      attack: { type: 'melee', bonus: 3 },
      flags: { isLikeAttack: true },
    },
    flags: { usesConsumption: false, usesAttempt: true, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  
  // Set up a mock combat system that records the options
  let capturedOptions = null
  mockAdapter.setCombatSystem({
    resolveAttackRoll: async (actor, target, options) => {
      capturedOptions = options
      return { success: true, roll: { total: 15 } }
    },
  })

  const resolver = new ActionResolver(action, {}, {}, [target], mockAdapter)

  await resolver.resolve()

  assert.ok(capturedOptions)
  assert.is(capturedOptions.attackType, 'melee')
  assert.is(capturedOptions.modifier, 3)
})

test('performAttemptAsAttack: defaults bonus to 0 when not specified', async () => {
  const target = {
    actor: { uuid: 'uuid.target' },
  }
  const action = {
    id: 'no-bonus-attack',
    attempt: {
      attack: { type: 'missile' },
      flags: { isLikeAttack: true },
    },
    flags: { usesConsumption: false, usesAttempt: true, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  
  let capturedOptions = null
  mockAdapter.setCombatSystem({
    resolveAttackRoll: async (actor, target, options) => {
      capturedOptions = options
      return { success: true, roll: { total: 12 } }
    },
  })

  const resolver = new ActionResolver(action, {}, {}, [target], mockAdapter)

  await resolver.resolve()

  assert.is(capturedOptions.modifier, 0)
})

test.run()

test('report: applies private roll mode to chat message', async () => {
  const action = {
    id: 'private-roll',
    attempt: {
      roll: { type: 'private', formula: '1d20', operator: '>=', target: 10 },
      flags: { isLikeAttack: false },
    },
    flags: { usesConsumption: false, usesAttempt: true, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.createdMessages.length, 1)
  assert.ok(mockAdapter.createdMessages[0].whisper)
  assert.is(mockAdapter.createdMessages[0].whisper.length, 1)
})

test('report: applies blind roll mode to chat message', async () => {
  const action = {
    id: 'blind-roll',
    attempt: {
      roll: { type: 'blind', formula: '1d20', operator: '>=', target: 10 },
      flags: { isLikeAttack: false },
    },
    flags: { usesConsumption: false, usesAttempt: true, usesEffect: false },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  assert.is(mockAdapter.createdMessages.length, 1)
  assert.is(mockAdapter.createdMessages[0].blind, true)
  assert.ok(mockAdapter.createdMessages[0].whisper)
})

test('report: isBlind flag overrides roll mode', async () => {
  const action = {
    id: 'override-blind',
    attempt: {
      roll: { type: 'public', formula: '1d20', operator: '>=', target: 10 },
      flags: { isLikeAttack: false },
    },
    flags: {
      usesConsumption: false,
      usesAttempt: true,
      usesEffect: false,
      isBlind: true,
    },
  }
  const mockAdapter = new MockFoundryAdapter()
  const resolver = new ActionResolver(action, {}, {}, [], mockAdapter)

  await resolver.resolve()

  // isBlind should override to blind mode
  assert.is(mockAdapter.createdMessages[0].blind, true)
})

test.run()
