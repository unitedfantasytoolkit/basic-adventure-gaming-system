/**
 * @file Registers BAGS' integration test batches with Quench.
 *
 * These are the tests that need a running Foundry: real documents, real dice,
 * real sheets. The pure logic tests live in `test/` and run under uvu from the
 * command line -- if a test doesn't need Foundry, it belongs there instead,
 * because those run in milliseconds and these don't.
 *
 * Nothing here is imported by the system at startup. `register.mjs` waits for
 * Quench's `quenchReady` hook and only then imports this file, so the tests are
 * built as their own chunk and a world without Quench never downloads it.
 *
 * Batches are organised by the thing they're about -- a document type, or the
 * system as a whole -- and named to match, so `character.view` is in
 * `character/view.test.mjs`. Quench matches its filters segment by segment on the
 * dots, which means `character.*` runs everything about characters, rules and
 * interface alike.
 */

import registerRegistryTests from "./system/registry.test.mjs"
import registerDocumentTests from "./system/documents.test.mjs"
import registerComponentTests from "./system/components.test.mjs"
import registerSheetRenderingTests from "./system/sheets.test.mjs"

import registerApplicationTests from "./applications/base.test.mjs"
import registerItemEditorTests from "./applications/item-editor.test.mjs"
import registerActionEditorTests from "./applications/action-editor.test.mjs"
import registerActiveEffectEditorTests from "./applications/active-effect-editor.test.mjs"

import registerActionResolutionTests from "./actions/resolution.test.mjs"
import registerActionStorageTests from "./actions/storage.test.mjs"
import registerActionsTabTests from "./actions/tab.test.mjs"

import registerContainerTests from "./inventory/containers.test.mjs"
import registerStackingTests from "./inventory/stacking.test.mjs"

import registerCharacterRulesTests from "./character/rules.test.mjs"
import registerEncumbranceTests from "./character/encumbrance.test.mjs"
import registerSpellTests from "./character/spells.test.mjs"
import registerCharacterViewTests from "./character/view.test.mjs"
import registerInitiativeTests from "./combat/initiative.test.mjs"
import registerTrackerTests from "./combat/tracker.test.mjs"
import registerDeclarationTests from "./combat/declarations.test.mjs"
import registerRoundCardTests from "./combat/round-card.test.mjs"
import registerRoundLifecycleTests from "./combat/round-lifecycle.test.mjs"
import registerSteppingTests from "./combat/stepping.test.mjs"
import registerSurpriseTests from "./combat/surprise.test.mjs"
import registerMoraleTests from "./combat/morale.test.mjs"
import registerSpilloverTests from "./combat/spillover.test.mjs"
import registerCharacterEditTests from "./character/edit.test.mjs"
import registerCreationSourceTests from "./character/creation-sources.test.mjs"
import registerCharacterCreationTests from "./character/creation.test.mjs"
import registerCreationOfferTests from "./character/creation-offer.test.mjs"

import registerMonsterViewTests from "./monster/view.test.mjs"
import registerMonsterEditTests from "./monster/edit.test.mjs"

import registerWeaponAttackTests from "./weapon/attack.test.mjs"
import registerWeaponEditTests from "./weapon/edit.test.mjs"

import registerArmorEditTests from "./armor/edit.test.mjs"

import registerItemViewTests from "./item/view.test.mjs"
import registerItemEditTests from "./item/edit.test.mjs"

import registerSpellRulesTests from "./spell/rules.test.mjs"
import registerSpellViewTests from "./spell/view.test.mjs"
import registerSpellEditTests from "./spell/edit.test.mjs"

import registerClassAdvancementTests from "./class/advancement.test.mjs"

import registerPartySidebarTests from "./party/sidebar.test.mjs"
import registerRewardsTests from "./rewards/ledger.test.mjs"

/**
 * Every batch, in a sensible order to read results in: the system's own
 * configuration, then the shared applications, then the rules that belong to no
 * one document type, then each document type in turn -- its rules first, then its
 * interface.
 * @type {Array<(quench: object) => void>}
 */
const batches = [
  // The system's own configuration
  registerRegistryTests,
  registerDocumentTests,
  registerComponentTests,
  registerSheetRenderingTests,
  registerPartySidebarTests,
  registerRewardsTests,

  // The applications every sheet and editor is built out of
  registerApplicationTests,
  registerItemEditorTests,
  registerActionEditorTests,
  registerActiveEffectEditorTests,

  // Rules that belong to no one document type
  registerActionResolutionTests,
  registerActionStorageTests,
  registerActionsTabTests,
  registerContainerTests,
  registerStackingTests,

  // Characters
  registerCharacterRulesTests,
  registerEncumbranceTests,
  registerSpellTests,
  registerCharacterViewTests,
  registerCharacterEditTests,
  registerCreationSourceTests,
  registerCharacterCreationTests,
  registerCreationOfferTests,

  // Monsters
  registerMonsterViewTests,
  registerMonsterEditTests,

  // Item subtypes
  registerWeaponAttackTests,
  registerWeaponEditTests,
  registerArmorEditTests,
  registerItemViewTests,
  registerItemEditTests,
  registerSpellRulesTests,
  registerSpellViewTests,
  registerSpellEditTests,
  registerClassAdvancementTests,

  // Combat
  registerInitiativeTests,
  registerTrackerTests,
  registerDeclarationTests,
  registerRoundCardTests,
  registerRoundLifecycleTests,
  registerSteppingTests,
  registerSurpriseTests,
  registerMoraleTests,
  registerSpilloverTests,
]

/**
 * Register every BAGS test batch with Quench.
 * @param {object} quench - The Quench instance from the `quenchReady` hook
 */
export default function registerQuenchBatches(quench) {
  batches.forEach((register) => register(quench))
}
