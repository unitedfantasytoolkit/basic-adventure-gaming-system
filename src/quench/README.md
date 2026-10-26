# BAGS integration tests

These are the tests that need a running Foundry: real documents, real settings,
real dice, real sheets. They run inside a live world with
[Quench](https://github.com/Ethaks/FVTT-Quench), which wraps Mocha and Chai in a
Foundry application.

The pure-logic tests live in [`test/`](../../test) and run under uvu from the
command line. If a test doesn't need Foundry, it belongs there instead — those
finish in milliseconds and these don't.

## Running them

1. Install and enable the **Quench** module in the world.
2. Open the Quench window from the sidebar's toolbar (the flask icon).
3. Select the batches you want and hit **Run**.

Everything is registered under the `basic-adventure-gaming-system.` prefix —
Quench keys a batch as `<package>.<identifier>`, and the package part has to be
the real package ID. Filtering on `basic-adventure` in Quench's search box shows
the whole suite and nothing else.

To run them from the console instead:

```javascript
// Everything
quench.runBatches("**")

// One batch
quench.runBatches("basic-adventure-gaming-system.weapon.edit")

// Everything in this system
quench.runBatches("basic-adventure-gaming-system.**")

// Everything about weapons -- the attack rules and the editor
quench.runBatches("basic-adventure-gaming-system.weapon.*")

// Every editor in the system
quench.runBatches("basic-adventure-gaming-system.*.edit")
```

[`register.mjs`](./register.mjs) is the only part of this directory the system
imports at startup, and all it does is wait for Quench's `quenchReady` hook and
then `import("./index.mjs")`. Rollup emits that as its own chunk, so a world
without Quench never downloads a line of test code — the hook never fires.

`npm start` picks up an edit to a test file the same way it picks up any other
edit: save, let rollup rebuild, reload Foundry, run the batch again. (Each
rebuild writes a fresh `dist/index-<hash>.js`; rollup doesn't remove the old
ones, so `dist/` collects them until it's cleaned.)

## How it's laid out

A batch's key is its path: `weapon.edit` is `weapon/edit.test.mjs`. Quench matches
its filters segment by segment on the dots, so `weapon.*` runs everything about
weapons and `*.edit` runs every editor in the system.

There are four kinds of directory:

- **`<subtype>/`** — one per document subtype in
  [`system.json`](../system.json): `character`, `monster`, `weapon`, `armor`,
  `item`, `class`. Everything specific to that subtype lives here, and nothing
  else does. `item/` is the plain `item` subtype — the miscellaneous one — not
  items in general.
- **`applications/`** — mirrors [`src/applications/`](../applications): one file
  per shared window. These are the editors more than one subtype opens, so
  testing them under any single subtype would hide them.
- **`system/`** — the system's own configuration: what gets registered at init,
  and whether every registered thing works at all.
- **`actions/`, `inventory/`** — rules that belong to no one subtype. An action
  can hang off five different Item types; containers and stacking apply to every
  physical item.

The `basic-adventure-gaming-system.` prefix is left off the keys below.

| Batch                               | What it covers                                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system.registry`                   | The SystemRegistry, the settings it generates, and the document classes, data models and sheets registered at init                                         |
| `system.documents`                  | Creating every Actor and Item subtype against the live schemas, and the round trip through the database                                                    |
| `system.components`                 | The two web components the templates use: registration, shadow DOM, and the documents they resolve by UUID                                                 |
| `system.sheets`                     | A rendering smoke test generated from `CONFIG.Item.dataModels`, so a newly registered subtype is covered without anyone writing a test                     |
| `applications.base`                 | The `BAGSApplication` contract every sheet and editor is built on: that `render()` and `close()` resolve when they say they do                             |
| `applications.item-editor`          | The item editor every subtype inherits: names, numbers, checkboxes, and that each type's editor opens                                                      |
| `applications.action-editor`        | The action editor and its effect editor — the most intricate editing surface in the system                                                                 |
| `applications.active-effect-editor` | Adding, listing, toggling and deleting Active Effects on a document                                                                                        |
| `actions.resolution`                | Action resolution: attack rolls against real targets under both combat systems, damage, healing, consumption, validation, and the chat card that comes out |
| `actions.storage`                   | `BAGSItem`'s four action methods, against a real document and real schema cleaning                                                                         |
| `inventory.containers`              | Putting things in containers and taking them out, the rules that refuse a move, and how a container's weight is worked out                                 |
| `inventory.stacking`                | Which items stack and which don't, merging, splitting, and consolidating a whole inventory                                                                 |
| `character.rules`                   | Derived character data: AC, THAC0, attack and damage bonuses, saving throws, spell slots, and Active Effects from equipment                                |
| `character.encumbrance`             | Both encumbrance systems end to end, including the speed steps and the modifiers that shift them                                                           |
| `character.spells`                  | Preparing spells against the slots a class supplies                                                                                                        |
| `character.view`                    | That the character sheet renders and reflects the Actor it belongs to                                                                                      |
| `character.edit`                    | Opening the character editor, and what it writes back                                                                                                      |
| `character.creation-sources`        | Reading the classes, equipment and spells on offer out of real folders and compendiums                                                                     |
| `character.creation`                | The flow itself: which steps a world offers, rolling scores, buying equipment, and what completion writes onto the Actor                                   |
| `character.creation-offer`          | Whether a brand new character gets the flow at all, and the gate that keeps its sheet shut until that's decided                                            |
| `monster.view`                      | That the monster sheet renders and reflects the Actor                                                                                                      |
| `monster.edit`                      | The monster editor                                                                                                                                         |
| `weapon.attack`                     | The default attack a weapon carries in `system.attack`, and the damage effect `system.actionList` assembles from it                                        |
| `weapon.edit`                       | The weapon editor's Attack tab — the flattened action editor, and the one per-type editor that edits an action                                             |
| `armor.edit`                        | The armor editor's Armor Class field, which converts between an absolute AC and a stored offset in whichever direction the rules count                     |
| `item.view`                         | The plain item's sheet, which is the only one that can show a container's contents                                                                         |
| `item.edit`                         | Turning an ordinary item into a container                                                                                                                  |
| `class.advancement`                 | The class advancement editor: XP table rows, spell levels, and leveled resources                                                                           |

### What isn't covered yet

Subtypes with no directory have no tests of their own, and the reason is always the
same: nothing about them is behaviour rather than appearance, or nothing has been
built yet. When that changes, they get a directory.

- **`identity`** — has an editor (`item.identity.editor.mjs`) nobody tests.
- **`class`** — the details editor (requisites, hit dice, spell list) is untested;
  only the advancement editor is covered.
- **`spell`** and **`ability`** — no editors at all (`SUB_APPS = []`), so their
  sheets are covered by `system.sheets` and nothing else applies.
- **`vehicle`** — declared in `system.json` with no data model behind it.
- **`monster.edit`** and **`item.edit`** are one test each. They're the right home
  for more, not a claim that one test is enough.

## Writing a batch

Every batch follows the same shape:

```javascript
export default function registerMyTests(quench) {
  quench.registerBatch(
    // <package>.<identifier>, and the identifier matches the file's path
    "basic-adventure-gaming-system.character.my-thing",
    (context) => {
      const { describe, it, assert, after } = context

      describe("Some behaviour", function suite() {
        this.timeout(15000)

        after(() => cleanUpDocuments())

        it("does the thing", async () => {
          const actor = await createTestCharacter()
          assert.strictEqual(actor.system.armorClass, 10)
        })
      })
    },
    { displayName: "BAGS: My thing" }, // <PACKAGE>: <description>
  )
}
```

Then add it to the list in [`index.mjs`](./index.mjs). The package part of the key
has to be the real package ID — Quench checks it against the installed packages and
complains if it doesn't match.

A few things worth knowing before you write one:

- **Use `assert`, not `expect`.** The project's ESLint config treats
  `no-unused-expressions` as an error, and `expect(x).to.be.true` is exactly that.
  Chai's assert API says the same things without tripping it.
- **Raise the timeout.** Mocha's default is 2 seconds, which a test that renders a
  sheet or reads a compendium will blow through. `this.timeout(15000)` inside a
  named function expression (`function suite() {}`, not an arrow) is the way — the
  arrow has no `this` to configure.
- **Clean up.** Everything created through [`helpers.mjs`](./helpers.mjs) is
  tracked; call `cleanUpDocuments()` from an `after` hook and the world stays
  tidy. Anything created by hand needs `trackDocument()`.
- **Put global state back.** The `with*` helpers — `withSetting`,
  `withRulesModule`, `withFixedDice`, `withRenderedApplication` — all restore what
  they changed in a `finally`, so a failed assertion can't leak a half-applied
  ruleset into the next test. Add new global state the same way.
- **Don't create a scoreless character casually.** A character with no ability
  scores looks like one somebody just made in the sidebar, so the `createActor`
  hook offers to build it with the creation flow — and in the default "offer" mode
  that's a modal dialog nothing will dismiss. Use `createBlankCharacter()`, which
  suppresses the offer, or `createTestCharacter()`, which gives it scores.
- **Never assert on a class's `name`.** A production build minifies them, so
  `CONFIG.Actor.documentClass.name` is two letters in the wild. Compare classes by
  identity, or with `prototype instanceof`.

## Testing an interaction

Editors are driven by clicks, form changes, dialogs and drags. Two files cover all
of it.

[`editor-tools.mjs`](./editor-tools.mjs) is a factory, because these need the
batch's `assert` — a missing button should fail the test that looked for it, not
throw a `TypeError` from somewhere further down:

```javascript
const { withEditor, click, invokeAction, dropOnto } = editorTools(context)
```

- `withEditor(document, subApp, callback)` opens one of a sheet's editors, hands it
  to the callback, and closes it (and the sheet, if an editor opened one) after.
- `click(app, selector)` clicks through Foundry's `data-action` delegation, so the
  handler sees the element it was clicked on and reads its dataset.
- `invokeAction(app, action)` is how to reach a header control: in v14 those aren't
  in the application's DOM at all, but built on demand as a context menu.
- `dropOnto(target, payload)` dispatches a real `DragEvent` with a real
  `DataTransfer`, which is the only way a drop handler gets its payload.

The rest are plain functions in [`helpers.mjs`](./helpers.mjs):

- `renderApplication(app)` renders and **waits until the window is really up**.
  `await app.render(true)` is enough now that `BAGSApplication#render` returns
  what `super.render()` gives it, but this also fails with a useful message
  instead of hanging when a window never appears.
- `changeFormField(app, name, value, settled)` sets a field and dispatches the
  `change` event the application is listening for, then waits for `settled()`.
  Setting `input.value` on its own saves nothing.
- `answerDialog(true | false)` answers the confirmation a destructive handler is
  waiting on. Click the button first, _then_ answer, then wait for the result:

  ```javascript
  click(editor, '[data-action="delete-action-effect"]')
  await answerDialog(true)
  await waitFor(() => action.effects.length === 0, "the effect to go")
  ```

- `waitFor(predicate, description)` for everything else. Handlers call
  `this.render()` and mutate documents without anyone awaiting them, so almost
  every assertion about an interaction needs to wait for its result rather than
  assume it has already happened.

## Characterization tests

A handful of tests assert behaviour that looks wrong rather than behaviour that
looks right. They're marked with a comment saying so, and saying what the
disagreement is. They exist so a fix is a deliberate act with a visible
consequence, instead of a silent change nobody notices.

Search the suite for "Characterization" to find them.

## Tests that fail on purpose

Sometimes a test is written red on purpose: the code is wrong, and the test says
what right looks like. Each one carries a comment naming the defect it's pinning,
and stays red until the defect is fixed — the suite's to-do list. If you'd rather
they were quiet, fix the code, not the assertion.

There are none outstanding at the moment; the first round all became fixes.
