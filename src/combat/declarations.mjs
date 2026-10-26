/**
 * @file Declarable actions -- what a combatant says they are about to do.
 *
 * This is a pool, not a SystemRegistry category, and the difference is the whole
 * point. SystemRegistry categories are select-one: a world picks *the* initiative
 * rules, *the* encumbrance rules. Declarable actions are the opposite shape --
 * every ruleset and every house-rule module contributes some, and a table sees
 * the union of whatever applies to the game it is playing.
 *
 * Availability is additive too. A type names the rulesets it belongs to, rather
 * than a ruleset naming the types it allows, so a module can add "set weapon
 * against charge" to stock B/X without replacing the B/X initiative module and
 * thereby fighting every other module that wants to do the same.
 */

/**
 * A kind of action a combatant can declare.
 * @typedef {object} DeclarationType
 * @property {string} id - Namespaced, e.g. `bags.melee` or `osric.charge`. The
 * pool is a bare keyed object; two modules shipping `charge` would silently
 * clobber one another.
 * @property {string} label - A translation key.
 * @property {string} icon - A Font Awesome class.
 * @property {string[]|"*"} appliesTo - Ruleset ids this belongs to, matched
 * against the `ruleset` field of the selected INITIATIVE module. `"*"` for types
 * that make sense in every game BAGS models.
 * @property {boolean} [requiresTarget] - Whether the declaration is incomplete
 * without a target.
 * @property {boolean} [bindsToAction] - Whether it can reference a real Action on
 * the actor or one of its items.
 * @property {Record<string, DeclarationFieldDescriptor>} [fields] - Numbers this
 * type needs the declarer to supply. See below.
 */

/**
 * A number a declaration type asks its declarer for.
 *
 * AD&D needs two of these -- a spell's casting time, and how far someone intends
 * to move -- and neither can be read from anywhere else. Casting time lives in
 * free text on the spell ("1 rd./level"), and a movement distance does not exist
 * yet at declaration time, because declaring happens *before* anyone moves.
 *
 * The descriptor is plain data rather than a Foundry field instance, so a module
 * contributing a declaration type does not have to know Foundry's field API, and
 * so this file keeps control of what constraints are enforceable.
 * @typedef {object} DeclarationFieldDescriptor
 * @property {string} label - A translation key.
 * @property {string} [hint] - A translation key.
 * @property {number} [min] - Smallest accepted value. Defaults to 0.
 * @property {number} [max] - Largest accepted value. Defaults to 100.
 * @property {number} [step] - The form's increment. Defaults to 1.
 * @property {boolean} [integer] - Whether fractions are refused. Defaults to true.
 * @property {number} [initial] - The value the form opens on. Defaults to `min`.
 * @property {string[]|"*"} [appliesTo] - Rulesets this field is asked for in,
 * matched the same way `DeclarationType.appliesTo` is. A casting time means
 * nothing in B/X even though "cast a spell" is a universal declaration, so a
 * field can narrow where its type does not.
 * @property {"number"|"range"} [widget] - How the form draws it. A range gives
 * Foundry's slider-plus-number picker, which suits a value with a real span to
 * it; a bare number suits one where every increment matters.
 */

/**
 * Numbers asked for alongside *every* action, rather than one in particular.
 *
 * Movement is the case this exists for. A combatant does not choose between
 * moving and acting -- in the Advanced games they close to melee *and* swing,
 * and the ground they covered adds to when the swing lands. Hanging the distance
 * off a "move" declaration would make "I run in and attack" unsayable, which is
 * one of the most common things anyone says in a fight.
 * @type {Record<string, DeclarationFieldDescriptor>}
 */
export const UNIVERSAL_DECLARATION_FIELDS = Object.freeze({
  distance: {
    label: "BAGS.Combat.Declarations.Fields.Distance.Label",
    hint: "BAGS.Combat.Declarations.Fields.Distance.Hint",
    min: 0,
    max: 240,
    step: 5,
    initial: 0,
    widget: "range",
    appliesTo: ["adnd"],
  },
})

/**
 * The record used when a combatant has not declared anything.
 *
 * A real entry in the pool rather than a null sentinel, so that a ruleset's
 * `getInitiativeOffset` never has to null-check the type it was handed, and so
 * that a ruleset which wants to penalise indecision can do so by name.
 * @type {DeclarationType}
 */
export const NO_DECLARATION = Object.freeze({
  id: "bags.none",
  label: "BAGS.Combat.Declarations.None.Label",
  icon: "fa-solid fa-circle-question",
  appliesTo: "*",
  requiresTarget: false,
  bindsToAction: false,
})

/**
 * The actions that mean something in every game BAGS models.
 *
 * Editions differ in what declaring *costs* you -- 2nd Edition adds a weapon's
 * speed factor, 1st Edition turns a casting time into a segment -- but not in
 * what the choices are. Anything edition-specific is contributed by that
 * edition's rules module instead of living here.
 * @type {DeclarationType[]}
 */
export const UNIVERSAL_DECLARATIONS = Object.freeze([
  {
    id: "bags.melee",
    label: "BAGS.Combat.Declarations.Melee.Label",
    icon: "fa-solid fa-swords",
    appliesTo: "*",
    requiresTarget: true,
    bindsToAction: true,
  },
  {
    id: "bags.missile",
    label: "BAGS.Combat.Declarations.Missile.Label",
    icon: "fa-solid fa-bow-arrow",
    appliesTo: "*",
    requiresTarget: true,
    bindsToAction: true,
  },
  {
    id: "bags.cast",
    label: "BAGS.Combat.Declarations.Cast.Label",
    icon: "fa-solid fa-wand-sparkles",
    appliesTo: "*",
    requiresTarget: false,
    bindsToAction: true,
    fields: {
      /**
       * Asked for rather than read off the spell. `item.spell.datamodel.mjs`
       * keeps `castingTime` as free text on purpose, because real entries say
       * things like "1 rd./level" -- a string that means segments, or rounds, or
       * a per-level calculation depending on the entry. Parsing it is a feature
       * with its own edge cases; asking the caster is one number and no parser.
       */
      castingTime: {
        label: "BAGS.Combat.Declarations.Fields.CastingTime.Label",
        hint: "BAGS.Combat.Declarations.Fields.CastingTime.Hint",
        min: 0,
        max: 10,
        initial: 1,
        appliesTo: ["adnd"],
      },
    },
  },
  {
    id: "bags.move",
    label: "BAGS.Combat.Declarations.Move.Label",
    icon: "fa-solid fa-person-running",
    appliesTo: "*",
    requiresTarget: false,
    bindsToAction: false,
    // No distance field of its own: movement is asked for alongside every
    // action, so "move" is what a combatant declares when moving is *all* they
    // are doing.
  },
  {
    id: "bags.withdraw",
    label: "BAGS.Combat.Declarations.Withdraw.Label",
    icon: "fa-solid fa-shield-halved",
    appliesTo: "*",
    requiresTarget: false,
    bindsToAction: false,
  },
  {
    id: "bags.delay",
    label: "BAGS.Combat.Declarations.Delay.Label",
    icon: "fa-solid fa-hourglass-half",
    appliesTo: "*",
    requiresTarget: false,
    bindsToAction: false,
  },
  {
    id: "bags.other",
    label: "BAGS.Combat.Declarations.Other.Label",
    icon: "fa-solid fa-ellipsis",
    appliesTo: "*",
    requiresTarget: false,
    bindsToAction: false,
  },
])

/**
 * Does a declaration type belong in a given game?
 * @param {DeclarationType} type - The type to test.
 * @param {string} [rulesetId] - The `ruleset` of the selected INITIATIVE module.
 * @returns {boolean} Whether to offer it.
 */
export const appliesToRuleset = (type, rulesetId) => {
  if (type.appliesTo === "*") return true
  if (!Array.isArray(type.appliesTo)) return false
  return type.appliesTo.includes(rulesetId)
}

/**
 * Add a declaration type to the pool.
 *
 * Called during the existing `BAGS.RegisterSystems` hook, which is why a rules
 * module can contribute one without touching anything else.
 * @param {DeclarationType} type - The type to register.
 * @returns {void}
 */
export const registerDeclarationType = (type) => {
  if (!type?.id) throw new Error("A declaration type must have an id")

  if (!type.id.includes(".")) {
    throw new Error(
      `Declaration type "${type.id}" must be namespaced, e.g. "osric.charge". ` +
        "The pool is a flat object and bare ids collide silently.",
    )
  }

  // Self-initialising, so that a rules module registering during
  // `BAGS.RegisterSystems` -- which fires before the combat hooks run -- does not
  // depend on having been loaded in a particular order.
  CONFIG.BAGS ??= {}
  CONFIG.BAGS.declarationTypes ??= {}

  CONFIG.BAGS.declarationTypes[type.id] = Object.freeze({ ...type })
}

/**
 * Every declaration a combatant could choose in a given game, in registration
 * order.
 *
 * `NO_DECLARATION` is deliberately not among them. It lives in the pool so that
 * the rules can resolve and reason about the undeclared case, but offering it as
 * a button would present the absence of a choice as a choice -- and the dialog
 * already has a way to say nothing.
 * @param {string} [rulesetId] - The `ruleset` of the selected INITIATIVE module.
 * @returns {DeclarationType[]} The types a combatant may choose from.
 */
export const getDeclarationTypes = (rulesetId) =>
  Object.values(CONFIG.BAGS?.declarationTypes ?? {}).filter(
    (type) =>
      type.id !== NO_DECLARATION.id && appliesToRuleset(type, rulesetId),
  )

/**
 * Look a declaration type up by id.
 * @param {string} [id] - The type's id.
 * @returns {DeclarationType} The type, or NO_DECLARATION if it is unknown.
 */
export const resolveDeclarationType = (id) =>
  CONFIG.BAGS?.declarationTypes?.[id] ?? NO_DECLARATION

/**
 * Fill a field descriptor's optional parts in.
 * @param {DeclarationFieldDescriptor} descriptor - The descriptor to complete.
 * @returns {DeclarationFieldDescriptor} A descriptor with no missing values.
 */
const withDefaults = (descriptor) => {
  const min = Number.isFinite(descriptor.min) ? descriptor.min : 0
  return {
    ...descriptor,
    min,
    max: Number.isFinite(descriptor.max) ? descriptor.max : 100,
    step: Number.isFinite(descriptor.step) ? descriptor.step : 1,
    integer: descriptor.integer !== false,
    initial: Number.isFinite(descriptor.initial) ? descriptor.initial : min,
    appliesTo: descriptor.appliesTo ?? "*",
    widget: descriptor.widget === "range" ? "range" : "number",
  }
}

/**
 * Everything a given type asks for: its own fields, then the universal ones.
 *
 * The order matters to the form -- the chosen action's own questions read first,
 * with the ones asked of everybody underneath. A type wanting its own take on a
 * universal name keeps it, because a deliberate override should not be quietly
 * replaced by the general case.
 * @param {DeclarationType} type - A resolved declaration type.
 * @returns {Record<string, DeclarationFieldDescriptor>} The merged descriptors.
 */
const fieldsForType = (type) => {
  const merged = { ...type?.fields }

  Object.entries(UNIVERSAL_DECLARATION_FIELDS).forEach(([name, descriptor]) => {
    if (!(name in merged)) merged[name] = descriptor
  })

  return merged
}

/**
 * The fields a given declaration type asks for in a given game.
 *
 * Used by the declaration form to decide what to reveal when an option is
 * chosen. Narrowed by ruleset, so a B/X table picking "cast a spell" is not asked
 * for a casting time that nothing in B/X would read.
 * @param {string} [typeId] - A declaration type id.
 * @param {string} [rulesetId] - The `ruleset` of the selected INITIATIVE module.
 * @returns {Array<DeclarationFieldDescriptor & {name: string}>} The fields to
 * show, each carrying the key it writes to.
 */
export const getDeclarationFields = (typeId, rulesetId) =>
  Object.entries(fieldsForType(resolveDeclarationType(typeId)))
    .map(([name, descriptor]) => ({ name, ...withDefaults(descriptor) }))
    .filter((field) => appliesToRuleset(field, rulesetId))

/**
 * Every field any registered declaration type could ask for, merged.
 *
 * This builds the *schema*, so it deliberately ignores which ruleset is in force
 * and which type is chosen: a schema is fixed when the document class is first
 * used, while both of those change while a world is running.
 *
 * **Two types asking for the same name share one field, widened to accept
 * either.** That is the useful behaviour -- a contributed "charge" declaration
 * wanting a `distance` means the same thing "move" does -- and the narrower
 * per-type limits are still enforced in the form. The schema is the security
 * boundary; the form is the guidance.
 * @returns {Record<string, object>} Foundry `NumberField`s, keyed by name.
 */
export const buildDeclarationValueFields = () => {
  const { NumberField } = foundry.data.fields
  const merged = {}

  // Universal fields are folded in through `fieldsForType`, and independently of
  // the pool -- a world with no declaration types registered at all still gets a
  // place to store a movement distance.
  const contributors = [
    { fields: UNIVERSAL_DECLARATION_FIELDS },
    ...Object.values(CONFIG.BAGS?.declarationTypes ?? {}),
  ]

  contributors.forEach((type) => {
    Object.entries(type.fields ?? {}).forEach(([name, raw]) => {
      const descriptor = withDefaults(raw)
      const existing = merged[name]

      merged[name] = existing
        ? {
            ...existing,
            min: Math.min(existing.min, descriptor.min),
            max: Math.max(existing.max, descriptor.max),
            // One type accepting fractions is enough to make the stored field
            // accept them; a type that wants whole numbers still says so in the
            // form it renders.
            integer: existing.integer && descriptor.integer,
          }
        : descriptor
    })
  })

  return Object.fromEntries(
    Object.entries(merged).map(([name, descriptor]) => [
      name,
      new NumberField({
        required: true,
        nullable: false,
        integer: descriptor.integer,
        min: descriptor.min,
        max: descriptor.max,
        initial: descriptor.min,
        label: descriptor.label,
      }),
    ]),
  )
}

/**
 * A declaration wiped back to nothing.
 *
 * Every key is named explicitly rather than passing `{}`, because a Foundry
 * update *merges* into a SchemaField. Sending an empty object clears nothing, so
 * a casting time of 7 would outlive the round that asked for it and re-apply the
 * moment its declarer picked "cast a spell" again.
 * @returns {object} A complete, empty declaration.
 */
export const blankDeclaration = () => ({
  type: "",
  actionId: "",
  itemId: "",
  targetIds: [],
  values: Object.fromEntries(
    Object.entries(buildDeclarationValueFields()).map(([name, field]) => [
      name,
      field.initial,
    ]),
  ),
})

/**
 * Does this declaration hold anything a new round should forget?
 *
 * Used to decide who needs clearing. Testing `type` alone is not enough, which
 * is the whole reason this is a function rather than a truthiness check: a
 * declaration's numbers outlive the type that asked for them, because an update
 * merges* into a SchemaField. Anything that empties the type without naming
 * every value leaves a casting time sitting in a declaration that reads as
 * empty, ready to be silently reapplied the next time that action is picked --
 * and a filter on `type` skips exactly those combatants.
 * @param {object|null} declaration - A combatant's or group's declaration.
 * @returns {boolean} Whether anything is left in it.
 */
export const isDeclarationDirty = (declaration) => {
  if (!declaration) return false
  if (declaration.type) return true
  if (declaration.actionId || declaration.itemId) return true
  if (declaration.targetIds?.length) return true

  const blank = blankDeclaration().values
  return Object.entries(blank).some(
    ([name, initial]) =>
      Number.isFinite(declaration.values?.[name]) &&
      declaration.values[name] !== initial,
  )
}

/**
 * Seed the pool with the universal set.
 *
 * Rules modules add to this during `BAGS.RegisterSystems`; nothing here is
 * exclusive, so a module contributing its own types never displaces these.
 * @returns {void}
 */
export const registerUniversalDeclarations = () => {
  registerDeclarationType(NO_DECLARATION)
  UNIVERSAL_DECLARATIONS.forEach(registerDeclarationType)
}
