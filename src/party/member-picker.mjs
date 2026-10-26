/**
 * @file The dialog for choosing a character to add to the party.
 *
 * Dragging an Actor onto the tab does the same thing; this is the route that's
 * visible on screen. Candidates are passed in rather than read from the roster, so
 * this doesn't have to import the sidebar that imports it.
 */

/**
 * Ask which character should join the party.
 * @param {Actor[]} candidates - The characters not already in the party
 * @returns {Promise<string|null>} The chosen Actor's id, or null if the dialog was
 * dismissed or there was nobody to choose
 */
export async function showMemberPicker(candidates) {
  if (!candidates.length) {
    ui.notifications.warn(game.i18n.localize("BAGS.Party.Members.NoCandidates"))
    return null
  }

  const options = candidates
    .map(
      (actor) =>
        `<option value="${actor.id}">${foundry.utils.escapeHTML(actor.name)}</option>`,
    )
    .join("")

  const actorId = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("BAGS.Party.Members.Add") },
    content: `<form><div class="form-group">
      <label>${game.i18n.localize("BAGS.Party.Members.Character")}</label>
      <div class="form-fields">
        <select name="actorId" autofocus>${options}</select>
      </div>
    </div></form>`,
    ok: {
      icon: "fa-solid fa-user-plus",
      label: game.i18n.localize("BAGS.Party.Members.Add"),
      callback: (_event, button) => button.form.elements.actorId.value,
    },
    rejectClose: false,
  })

  return actorId ?? null
}
