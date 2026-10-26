/**
 * @file The dialog for recording a reward, or changing one already recorded.
 *
 * Separate from the sidebar tab so the tab stays a view of the ledger, and this is
 * the only place that decides whether an entry is valid.
 */

import PartySidebar from "../party/sidebar.mjs"
import { REWARD_KINDS } from "./ledger.mjs"

/**
 * The label shown for each kind of reward, in the order they appear in the menu.
 * @type {Record<string, string>}
 */
const KIND_LABELS = {
  [REWARD_KINDS.TREASURE]: "BAGS.Rewards.Kinds.Treasure",
  [REWARD_KINDS.MONSTERS]: "BAGS.Rewards.Kinds.Monsters",
  [REWARD_KINDS.GEAR]: "BAGS.Rewards.Kinds.Gear",
  [REWARD_KINDS.MANUAL]: "BAGS.Rewards.Kinds.Manual",
}

/**
 * The prefix on the name of each party member's checkbox. Recipients are one
 * checkbox per character rather than a multi-select.
 * @type {string}
 */
const RECIPIENT_PREFIX = "recipient."

/**
 * Build the dialog's markup.
 * @param {import("./ledger.mjs").RewardEntry} entry - The reward being edited
 * @param {Actor[]} members - The party, offered as possible recipients
 * @returns {string} The form's HTML
 */
const buildContent = (entry, members) => {
  const kinds = Object.entries(KIND_LABELS)
    .map(
      ([kind, label]) =>
        `<option value="${kind}"${kind === entry.kind ? " selected" : ""}>${game.i18n.localize(label)}</option>`,
    )
    .join("")

  const wholeParty = entry.recipients === "all"
  const chosen = new Set(wholeParty ? [] : (entry.recipients ?? []))

  const recipients = members
    .map(
      (member) => `<label class="checkbox">
        <input type="checkbox" name="${RECIPIENT_PREFIX}${member.id}"
               ${chosen.has(member.id) ? "checked" : ""}>
        ${foundry.utils.escapeHTML(member.name)}
      </label>`,
    )
    .join("")

  return `<form>
    <div class="form-group">
      <label>${game.i18n.localize("BAGS.Rewards.Fields.Label")}</label>
      <div class="form-fields">
        <input type="text" name="label" value="${foundry.utils.escapeHTML(entry.label ?? "")}"
               placeholder="${game.i18n.localize("BAGS.Rewards.Fields.LabelPlaceholder")}" autofocus>
      </div>
    </div>

    <div class="form-group">
      <label>${game.i18n.localize("BAGS.Rewards.Fields.Kind")}</label>
      <div class="form-fields"><select name="kind">${kinds}</select></div>
      <p class="hint">${game.i18n.localize("BAGS.Rewards.Fields.KindHint")}</p>
    </div>

    <div class="form-group">
      <label>${game.i18n.localize("BAGS.Rewards.Fields.XP")}</label>
      <div class="form-fields">
        <input type="number" name="xp" min="0" step="1" value="${entry.xp ?? 0}">
      </div>
    </div>

    <div class="form-group">
      <label>${game.i18n.localize("BAGS.Rewards.Fields.Split")}</label>
      <div class="form-fields">
        <input type="checkbox" name="split" ${entry.split ? "checked" : ""}>
      </div>
      <p class="hint">${game.i18n.localize("BAGS.Rewards.Fields.SplitHint")}</p>
    </div>

    <fieldset>
      <legend>${game.i18n.localize("BAGS.Rewards.Fields.Recipients")}</legend>
      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="wholeParty" ${wholeParty ? "checked" : ""}>
          ${game.i18n.localize("BAGS.Rewards.Recipients.WholeParty")}
        </label>
        <p class="hint">${game.i18n.localize("BAGS.Rewards.Fields.WholePartyHint")}</p>
      </div>
      <div class="form-group bags-reward-recipients">
        ${recipients || `<p class="hint">${game.i18n.localize("BAGS.Party.Empty")}</p>`}
      </div>
    </fieldset>
  </form>`
}

/**
 * Read the form back into a reward entry.
 * @param {HTMLFormElement} form - The dialog's form
 * @returns {Omit<import("./ledger.mjs").RewardEntry, "id">|null} The reward, or
 * null if it wouldn't be worth recording
 */
const readForm = (form) => {
  const xp = Number(form.elements.xp.value) || 0
  const wholeParty = form.elements.wholeParty.checked

  const chosen = [...form.elements]
    .filter(
      (element) =>
        element.name?.startsWith(RECIPIENT_PREFIX) && element.checked,
    )
    .map((element) => element.name.slice(RECIPIENT_PREFIX.length))

  // An entry with no recipients would sit in the ledger forever.
  if (!wholeParty && !chosen.length) {
    ui.notifications.warn(
      game.i18n.localize("BAGS.Rewards.Fields.NoRecipients"),
    )
    return null
  }

  return {
    kind: form.elements.kind.value,
    label:
      form.elements.label.value.trim() ||
      game.i18n.localize(KIND_LABELS[form.elements.kind.value]),
    xp,
    recipients: wholeParty ? "all" : chosen,
    split: form.elements.split.checked,
  }
}

/**
 * Ask for a reward. Pass an existing entry to edit it instead of recording a new
 * one.
 * @param {Partial<import("./ledger.mjs").RewardEntry>} [entry] - The reward to
 * start from. Defaults to split treasure for the whole party.
 * @returns {Promise<Omit<import("./ledger.mjs").RewardEntry, "id">|null>} The
 * reward, or null if the dialog was dismissed
 */
export async function showRewardEditor(entry = {}) {
  const reward = {
    kind: REWARD_KINDS.TREASURE,
    label: "",
    xp: 0,
    recipients: "all",
    split: true,
    ...entry,
  }

  const isEdit = !!entry.id
  const { members } = PartySidebar

  return foundry.applications.api.DialogV2.prompt({
    window: {
      title: game.i18n.localize(
        isEdit ? "BAGS.Rewards.Editor.EditTitle" : "BAGS.Rewards.Editor.Title",
      ),
    },
    classes: ["bags-reward-editor"],
    position: { width: 420 },
    content: buildContent(reward, members),
    ok: {
      icon: "fa-solid fa-check",
      label: game.i18n.localize(
        isEdit ? "BAGS.Rewards.Editor.Save" : "BAGS.Rewards.Editor.Record",
      ),
      callback: (_event, button) => readForm(button.form),
    },
    // The member checkboxes only apply when the reward isn't going to the whole
    // party.
    render: (_event, dialog) => {
      const form = dialog.element.querySelector("form")
      const { wholeParty } = form.elements
      const list = form.querySelector(".bags-reward-recipients")

      const sync = () => list.classList.toggle("disabled", wholeParty.checked)

      wholeParty.addEventListener("change", sync)
      sync()
    },
    rejectClose: false,
  })
}
