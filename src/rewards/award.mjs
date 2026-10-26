/**
 * @file Handing the rewards ledger over to the characters who earned it.
 *
 * `ledger.mjs` works out how much each character gets and is pure arithmetic. This
 * is the half that touches the world: resolving who the recipients are, writing
 * the experience onto their class items, posting a summary, and emptying the
 * ledger.
 */

import PartySidebar from "../party/sidebar.mjs"
import { addXPToClass } from "../dialogs/dialog.add-xp.mjs"
import { clearLedger, computeAwards, getEntries } from "./ledger.mjs"

/**
 * Reduce a character to the numbers that decide their share of a reward.
 * @param {Actor} actor - The character receiving a reward
 * @returns {import("./ledger.mjs").RewardRecipient} The recipient
 */
const toRecipient = (actor) => ({
  id: actor.id,
  name: actor.name,
  // A full share if the field is absent entirely. A stored zero is passed through
  // as itself, and means the character takes no part of a split reward.
  share: actor.system.modifiers?.xp?.share ?? 100,
  bonus: actor.system.modifiers?.xp?.bonus ?? 0,
})

/**
 * Work out which characters a single entry goes to.
 *
 * "all" is resolved against the roster as it stands now, not when the entry was
 * recorded, so a character who joined in between is included.
 * @param {import("./ledger.mjs").RewardEntry} entry - The reward
 * @returns {Actor[]} The characters receiving it
 */
export function resolveRecipientActors(entry) {
  if (entry.recipients === "all") return PartySidebar.members

  return (entry.recipients ?? [])
    .map((id) => PartySidebar.lookupActor(id))
    .filter((actor) => !!actor)
}

/**
 * Everything that will happen if the ledger is handed out right now.
 *
 * Computed before anything is written, so the outcome can be confirmed first.
 * @returns {{awards: object[], unclassed: Actor[], totalXP: number}} The awards
 * that would be made, the characters who can't take one, and the total handed out
 */
export function previewAwards() {
  const entries = getEntries()
  const awards = computeAwards(entries, (entry) =>
    resolveRecipientActors(entry).map(toRecipient),
  )

  // Experience is stored on a character's class item, so a character who hasn't
  // chosen a class yet has nowhere to put it.
  const unclassed = awards
    .map((award) => PartySidebar.lookupActor(award.id))
    .filter((actor) => actor && !actor.itemTypes.class.length)

  const receivable = awards.filter(
    (award) => !unclassed.some((actor) => actor.id === award.id),
  )

  return {
    awards: receivable,
    unclassed,
    totalXP: receivable.reduce((total, award) => total + award.total, 0),
  }
}

/**
 * Post a summary of an award to chat, so players can check it against their own
 * sheets.
 * @param {object[]} awards - The awards that were made
 * @returns {Promise<ChatMessage>} The message that was posted
 */
async function announceAwards(awards) {
  const rows = awards
    .map(
      (award) =>
        `<li><strong>${foundry.utils.escapeHTML(award.name)}</strong> &mdash; ${
          award.bonus
            ? game.i18n.format("BAGS.Rewards.Award.RowWithBonus", {
                xp: award.total,
                bonus: award.bonus,
              })
            : game.i18n.format("BAGS.Rewards.XPAmount", { xp: award.total })
        }</li>`,
    )
    .join("")

  return ChatMessage.create({
    content: `<div class="bags-rewards-award">
      <h3>${game.i18n.localize("BAGS.Rewards.Award.Heading")}</h3>
      <ul>${rows}</ul>
    </div>`,
  })
}

/**
 * Hand the whole ledger over to the party.
 *
 * Confirmed first: this writes to character sheets and empties the ledger, and
 * neither can be undone.
 * @returns {Promise<boolean>} True if the rewards were handed out
 */
export async function awardLedger() {
  const { awards, unclassed, totalXP } = previewAwards()

  if (!awards.length) {
    ui.notifications.warn(
      game.i18n.localize("BAGS.Rewards.Award.NobodyToAward"),
    )
    return false
  }

  const summary = awards
    .map((award) =>
      game.i18n.format("BAGS.Rewards.Award.Confirm.Row", {
        name: award.name,
        xp: award.total,
      }),
    )
    .join("")

  const warning = unclassed.length
    ? `<p class="notification warning">${game.i18n.format(
        "BAGS.Rewards.Award.NoClass",
        { names: unclassed.map((actor) => actor.name).join(", ") },
      )}</p>`
    : ""

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize("BAGS.Rewards.Award.Confirm.Title") },
    content: `<p>${game.i18n.format("BAGS.Rewards.Award.Confirm.Prompt", {
      xp: totalXP,
      count: awards.length,
    })}</p><ul>${summary}</ul>${warning}`,
    yes: { label: game.i18n.localize("BAGS.Rewards.Award.Confirm.Yes") },
    rejectClose: false,
  })

  if (!confirmed) return false

  // One character at a time rather than a bulk update, so `addXPToClass` can keep
  // each class item's audit log in step with its new total.
  await Promise.all(
    awards.map(async (award) => {
      const [classItem] =
        PartySidebar.lookupActor(award.id)?.itemTypes.class ?? []
      if (!classItem) return

      await addXPToClass(
        classItem,
        award.total,
        game.i18n.localize("BAGS.Rewards.Award.LogNote"),
        { notify: false },
      )
    }),
  )

  await announceAwards(awards)
  await clearLedger()

  return true
}
