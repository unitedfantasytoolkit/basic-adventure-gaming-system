/**
 * @file The round's chat card: posting it, and keeping it current.
 *
 * Chat is where this system already reports what happened -- attack rolls,
 * spells, saves -- so it is where a table's eyes already are, and the natural
 * place to say "it is round two, here is the order, here is what everyone
 * intends". It also gives players a place to notice that they owe a declaration,
 * without a modal interrupting them to say so.
 *
 * Everything here runs on the GM's client. Players cannot write to a message
 * they did not author, so a player's declaration reaches the card by way of the
 * GM mirroring it.
 */

import deterministicId from "../utils/deterministic-id.mjs"
import { ROUND_CARD_MODE } from "../chat/chat-message.round.datamodel.mjs"
import { NO_DECLARATION } from "./declarations.mjs"
import { DECLARATION_MODE } from "./initiative-config.mjs"
import { colorForGroup } from "./sides.mjs"

/** The flag that marks a message as a given combat's round card. */
export const ROUND_CARD_FLAG = "roundCard"

/**
 * The combatants a public card may name, in turn order.
 *
 * The card is an ordinary chat message that every player receives, so a
 * combatant the referee has hidden -- the ambushers, the thing behind the door
 * -- must not appear on it. The tracker already leaves them out for players;
 * the card has to do the same itself.
 * @param {Combat} combat - The encounter.
 * @returns {Combatant[]} The visible combatants, in the order they act.
 */
const visibleTurns = (combat) =>
  combat.turns.filter((combatant) => !combatant.hidden)

/**
 * Reduce a combatant to the line the card draws for them.
 * @param {Combatant} combatant - The combatant to describe.
 * @returns {object} A member payload.
 */
const memberOf = (combatant) => {
  const declared = combatant.declarationType
  const isUndeclared = declared.id === NO_DECLARATION.id

  // Under blind declarations, the card says only *that* someone declared. It
  // has to be left out of the data, not just the drawing: the card is a chat
  // message, and every player's client receives all of it.
  if (!isUndeclared && combatant.parent?.declarationsHidden) {
    return {
      combatantId: combatant.id,
      name: combatant.name,
      img: combatant.img ?? "",
      declarationLabel: game.i18n.localize("BAGS.Combat.Declarations.Hidden"),
      declarationIcon: "fa-solid fa-comment-dots",
      inherited: false,
    }
  }

  return {
    combatantId: combatant.id,
    name: combatant.name,
    img: combatant.img ?? "",
    declarationLabel: isUndeclared ? "" : game.i18n.localize(declared.label),
    declarationIcon: isUndeclared ? "" : declared.icon,
    inherited: !isUndeclared && !combatant.system?.declaration?.type,
  }
}

/**
 * Gather the round into one block per side.
 *
 * Only coherent when every member of a side shares an offset, which is what
 * `perMemberOffsets: false` asserts. Once members act at different moments they
 * are no longer contiguous in `turns`, and grouping them would draw one
 * initiative for a side acting at four separate times.
 * @param {Combat} combat - The encounter.
 * @returns {object[]} One unit per rolling unit, in the order they act.
 */
const captureBlocks = (combat) => {
  const units = []
  const byKey = new Map()

  visibleTurns(combat).forEach((combatant) => {
    const group = combatant.rollingGroup
    const key = group?.id ?? combatant.id

    let unit = byKey.get(key)
    if (!unit) {
      unit = {
        name: group?.name || combatant.name,
        side: group?.system?.side || combatant.system?.side || "",
        color: group ? colorForGroup(group) : null,
        initiative: Number.isFinite(combatant.initiative)
          ? combatant.initiative
          : null,
        members: [],
      }
      byKey.set(key, unit)
      units.push(unit)
    }

    unit.members.push(memberOf(combatant))
  })

  return units
}

/**
 * Gather the round into a ladder of segments.
 *
 * Sides interleave in the Advanced games -- that is the normal case, not an
 * edge -- so the card lists the round in the order it happens and lets each row
 * carry its side's colour instead of drawing a block per side.
 * @param {Combat} combat - The encounter.
 * @returns {{segments: object[], pending: object[]}} The ladder, and everyone
 * who has no place on it yet.
 */
const captureLadder = (combat) => {
  const bySegment = new Map()
  const pending = []

  visibleTurns(combat).forEach((combatant) => {
    const group = combatant.rollingGroup
    const color = group ? colorForGroup(group) : null
    const side = group?.system?.side || combatant.system?.side || ""
    const segments = combatant.attackSegments

    // No roll yet, so no segment: what they do decides when they act, and until
    // the table has committed there is nothing to place. They wait at the foot.
    if (!segments?.length) {
      pending.push({ ...memberOf(combatant), side, color })
      return
    }

    // Once per attack. A fighter on segments 3 and 8 appears twice, which is the
    // whole point -- it is the only place a second attack is visible.
    segments.forEach((segment) => {
      if (!bySegment.has(segment)) bySegment.set(segment, [])
      bySegment.get(segment).push({ ...memberOf(combatant), side, color })
    })
  })

  return {
    segments: [...bySegment.entries()]
      .sort(([a], [b]) => a - b)
      .map(([segment, members]) => ({ segment, members })),
    pending,
  }
}

/**
 * Capture the state of a round for the card to keep.
 *
 * Snapshotting rather than reading live is the whole point: declarations are
 * cleared as each round closes, so a card that looked at the combat would
 * empty itself the moment its round ended.
 * @param {Combat} combat - The encounter to describe.
 * @returns {object} A `system` payload for the card.
 */
export const captureRound = (combat) => {
  const config = combat.initiativeConfig
  const asLadder = config.turnOrder?.perMemberOffsets === true

  const layout = asLadder
    ? { mode: ROUND_CARD_MODE.LADDER, units: [], ...captureLadder(combat) }
    : {
        mode: ROUND_CARD_MODE.BLOCKS,
        units: captureBlocks(combat),
        segments: [],
        pending: [],
      }

  return {
    combatId: combat.id,
    round: combat.round,
    declarationsOpen: config.declarationMode !== DECLARATION_MODE.OFF,
    ...layout,
  }
}

/**
 * Find the card belonging to a combat's current round.
 * @param {Combat} combat - The encounter.
 * @returns {ChatMessage|undefined} The card, if one has been posted.
 */
export const findRoundCard = (combat) =>
  game.messages.find(
    (message) =>
      message.type === "round" &&
      message.system?.combatId === combat.id &&
      message.system?.round === combat.round,
  )

/**
 * The id a combat's round card will always have.
 * @param {Combat} combat - The encounter.
 * @param {number} [round] - The round. Defaults to the current one.
 * @returns {string} A stable document id.
 */
export const roundCardId = (combat, round) =>
  deterministicId(`bags.round:${combat.id}:${round ?? combat.round}`)

/**
 * Post the card for a combat's current round.
 *
 * The id is derived from the encounter and the round rather than left to chance,
 * which is what keeps a referee running two screens from getting two cards. Both
 * sessions ask for the same id; the first wins and the second collides, and a
 * collision here means the work is already done.
 * @param {Combat} combat - The encounter.
 * @returns {Promise<ChatMessage|null>} The created card, or null if one exists.
 */
export const postRoundCard = async (combat) => {
  const _id = roundCardId(combat)
  if (game.messages.has(_id)) return null

  const card = await foundry.documents.ChatMessage.implementation
    .create(
      {
        _id,
        type: "round",
        system: captureRound(combat),
        speaker: { alias: game.i18n.localize("BAGS.Combat.Round.Speaker") },
      },
      { keepId: true },
    )
    .catch(() => null)

  // A card that came back under a different id means `keepId` was refused --
  // either another session won the race, or the id was malformed and Foundry
  // quietly substituted a random one. The first is fine; the second would make
  // every call create another card, so it is worth saying out loud rather than
  // swallowing.
  if (card && card.id !== _id) {
    console.warn(
      `BAGS | Round card was created as ${card.id} rather than ${_id}. ` +
        "Deduplication by id is not working.",
    )
  }

  return card
}

/**
 * Draw a line under an encounter.
 *
 * Posted as the combat is deleted, so everything about it is read from the
 * document while it still exists. The id is derived from the encounter so that a
 * referee running two screens gets one closing line rather than two.
 * @param {Combat} combat - The encounter that is ending.
 * @returns {Promise<ChatMessage|null>} The created card.
 */
export const postCombatEndCard = async (combat) => {
  const _id = deterministicId(`bags.combat-end:${combat.id}`)
  if (game.messages.has(_id)) return null

  return foundry.documents.ChatMessage.implementation
    .create(
      {
        _id,
        type: "combat-end",
        system: {
          combatId: combat.id,
          name: combat.name ?? "",
          // A fight abandoned before it began has no rounds worth reporting.
          rounds: Math.max(combat.round, 0),
        },
      },
      { keepId: true },
    )
    .catch(() => null)
}

/**
 * Bring the current round's card back in step with the encounter.
 *
 * Called from all three of the Combat document's descendant hooks -- create,
 * update and delete -- because anything that changes who is acting, in what
 * order, or what they say they are doing changes what the card should say. A
 * declaration is an *update*, so wiring only the create hook leaves the card
 * frozen at whatever the round started with.
 *
 * Debounced because a single "roll initiative" can touch a dozen documents, and
 * each one would otherwise rewrite the card.
 * @type {Function}
 */
export const refreshRoundCard = foundry.utils.debounce(async (combat) => {
  if (!game.user.isActiveGM || !combat) return

  const card = findRoundCard(combat)
  if (!card) return

  await card.update({ system: captureRound(combat) })
}, 100)
