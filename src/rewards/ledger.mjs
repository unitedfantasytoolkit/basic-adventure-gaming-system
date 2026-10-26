/**
 * @file The rewards ledger -- the list of experience the party has earned but
 * not yet been awarded.
 *
 * A session tends to produce rewards in a lump: coins counted at the end of a
 * crawl, monsters tallied after a fight, a magic item finally identified back in
 * town. The ledger is where those sit until the referee hands them out, so
 * nothing gets forgotten between the moment it's earned and the moment it lands
 * on a character sheet.
 *
 * Entries live in a world setting rather than in a document. There's no world
 * data to migrate yet, and this keeps the ledger to the referee without adding a
 * document type that would need permissions, a sheet, and a migration path.
 */

import { SYSTEM_NAME } from "../config/constants.mjs"

/**
 * The setting the ledger is stored under.
 * @type {string}
 */
export const LEDGER_SETTING = "rewardsLedger"

/**
 * Where a reward came from.
 *
 * The kind decides how an entry's experience is worked out and how it reads in
 * the sidebar. It does not decide who receives it -- that's `recipients`.
 * @readonly
 * @enum {string}
 */
export const REWARD_KINDS = {
  /** Coin and valuables, converted to experience at the campaign's rate. */
  TREASURE: "treasure",
  /** Defeated monsters, worth experience by their hit dice. */
  MONSTERS: "monsters",
  /** Magic items, worth experience once identified. */
  GEAR: "gear",
  /** Anything the referee wants to reward that the other kinds don't cover. */
  MANUAL: "manual",
}

/**
 * One unawarded reward.
 * @typedef {object} RewardEntry
 * @property {string} id - Identifies the entry so it can be removed on its own
 * @property {string} kind - One of the values in `REWARD_KINDS`
 * @property {string} label - What the referee sees, e.g. "Dragon hoard"
 * @property {number} xp - The experience this entry is worth in total
 * @property {"all"|string[]} recipients - Who it goes to: every current party
 * member, or specific Actor ids
 * @property {boolean} split - Whether `xp` divides among the recipients, or each
 * of them receives the whole amount
 */

/**
 * Register the ledger's setting. Called during `init`.
 */
export function registerRewardsSettings() {
  game.settings.register(SYSTEM_NAME, LEDGER_SETTING, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
    // A setting changing re-renders nothing on its own, so without this the tab
    // would show whatever it showed when it was last opened -- including right
    // after the referee added an entry to it. `onChange` rather than the
    // `updateSetting` hook because it fires only for this setting, so there's no
    // key string to keep in step with the registration above.
    onChange: () => {
      if (ui.rewards?.rendered) ui.rewards.render()
    },
  })
}

/**
 * Every reward waiting to be handed out.
 * @returns {RewardEntry[]} The ledger's entries, oldest first
 */
export function getEntries() {
  return game.settings.get(SYSTEM_NAME, LEDGER_SETTING) ?? []
}

/**
 * Replace the ledger wholesale. Every other mutation goes through here.
 * @param {RewardEntry[]} entries - The ledger's new contents
 * @returns {Promise<void>} Resolves once the setting has been saved
 */
export async function setEntries(entries) {
  await game.settings.set(SYSTEM_NAME, LEDGER_SETTING, entries)
}

/**
 * Add a reward to the ledger.
 *
 * The id is generated here, so an entry can be edited or removed without
 * depending on its position in the list.
 * @param {Omit<RewardEntry, "id">} entry - The reward to record
 * @returns {Promise<RewardEntry>} The entry as it was stored, id included
 */
export async function addEntry(entry) {
  const stored = { ...entry, id: foundry.utils.randomID() }
  await setEntries([...getEntries(), stored])
  return stored
}

/**
 * Change one entry in the ledger, leaving the rest alone.
 * @param {string} id - The id of the entry to change
 * @param {Partial<RewardEntry>} changes - The fields to overwrite
 * @returns {Promise<void>} Resolves once the change has been saved
 */
export async function updateEntry(id, changes) {
  await setEntries(
    getEntries().map((entry) =>
      entry.id === id ? { ...entry, ...changes, id } : entry,
    ),
  )
}

/**
 * Drop one entry from the ledger.
 * @param {string} id - The id of the entry to remove
 * @returns {Promise<void>} Resolves once the entry is gone
 */
export async function removeEntry(id) {
  await setEntries(getEntries().filter((entry) => entry.id !== id))
}

/**
 * Empty the ledger.
 * @returns {Promise<void>} Resolves once the ledger is empty
 */
export async function clearLedger() {
  await setEntries([])
}

/**
 * How much experience a single entry gives one recipient.
 *
 * A split reward divides between everyone receiving it, which is what treasure
 * and monsters normally do. An unsplit reward gives each recipient the full
 * amount, which is what you want for something like a bonus for recapping the
 * last session.
 * @param {RewardEntry} entry - The reward to work out
 * @param {number} recipientCount - How many characters are receiving it
 * @returns {number} Experience per recipient, rounded down
 */
export function xpPerRecipient(entry, recipientCount) {
  if (!recipientCount) return 0
  if (!entry.split) return entry.xp
  return Math.floor(entry.xp / recipientCount)
}

/**
 * Sum the experience across a set of entries.
 * @param {RewardEntry[]} entries - The entries to total
 * @returns {number} The combined experience
 */
export function getTotalXP(entries = getEntries()) {
  return entries.reduce((total, entry) => total + (entry.xp ?? 0), 0)
}

/**
 * A character in line to receive a reward, reduced to the numbers that decide
 * how much they get.
 * @typedef {object} RewardRecipient
 * @property {string} id - The Actor's id
 * @property {string} name - The character's name, for the summary
 * @property {number} share - What fraction of a full share this character takes,
 * as a percentage. A full share is 100; retainers customarily take half, so 50.
 * Zero means they take no part of a split reward.
 * @property {number} bonus - A percentage added to this character's own award,
 * earned by a high score in their class's primary ability. Zero means none.
 */

/**
 * How much experience one character gets, and where it came from.
 * @typedef {object} RewardAward
 * @property {string} id - The Actor's id
 * @property {string} name - The character's name
 * @property {number} base - Experience from the reward itself, before any bonus
 * @property {number} bonus - Experience added by this character's own bonus
 * @property {number} total - What the character actually receives
 */

/**
 * Work out what each character gets from a single reward.
 *
 * A split reward divides in proportion to the recipients' shares, so a retainer on
 * a half share gets half what the characters do. An unsplit reward is not one pot
 * being divided -- every recipient gets the whole amount, shares ignored.
 *
 * A character's own bonus applies to their portion alone, so it doesn't come out
 * of anyone else's share. Both steps round down, so the party can't earn more than
 * the reward was worth.
 * @param {RewardEntry} entry - The reward being handed out
 * @param {RewardRecipient[]} recipients - The characters receiving it
 * @returns {RewardAward[]} One award per recipient, in the order given
 */
export function computeEntryAwards(entry, recipients) {
  if (!recipients.length) return []

  const totalShares = recipients.reduce(
    (total, recipient) => total + recipient.share,
    0,
  )

  return recipients.map((recipient) => {
    // No shares between them means nobody has a claim on a split reward, and
    // dividing by the total would be a division by zero.
    const base = entry.split
      ? totalShares && Math.floor((entry.xp * recipient.share) / totalShares)
      : entry.xp
    const bonus = Math.floor((base * (recipient.bonus || 0)) / 100)

    return {
      id: recipient.id,
      name: recipient.name,
      base,
      bonus,
      total: base + bonus,
    }
  })
}

/**
 * Total up what each character gets across the whole ledger.
 *
 * Each entry is worked out on its own and the results added together, so entries
 * with different recipients can share one handout.
 * @param {RewardEntry[]} entries - The rewards being handed out
 * @param {(entry: RewardEntry) => RewardRecipient[]} resolveRecipients - Returns
 * the characters a given entry goes to
 * @returns {RewardAward[]} One award per character who receives anything
 */
export function computeAwards(entries, resolveRecipients) {
  const totals = new Map()

  entries.forEach((entry) => {
    computeEntryAwards(entry, resolveRecipients(entry)).forEach((award) => {
      const running = totals.get(award.id) ?? {
        id: award.id,
        name: award.name,
        base: 0,
        bonus: 0,
        total: 0,
      }

      totals.set(award.id, {
        ...running,
        base: running.base + award.base,
        bonus: running.bonus + award.bonus,
        total: running.total + award.total,
      })
    })
  })

  return [...totals.values()].filter((award) => award.total > 0)
}
