/**
 * @file Dialog for adding XP to a character class
 */

/**
 * Show a dialog to add XP to a character class
 * @param {Object} classItem - The character class item
 * @returns {Promise<{xp: number, note: string}|null>} The XP amount and note, or null if cancelled
 */
export async function showAddXPDialog(classItem) {
  if (!classItem.system.canAddXP) {
    ui.notifications.warn("Cannot add more XP to this class.")
    return null
  }

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Add Experience Points" },
    content: `
      <form>
        <div class="form-group">
          <label>XP to add</label>
          <input type="number" name="xp" min="1" placeholder="Enter XP amount" autofocus />
        </div>
        <div class="form-group">
          <label>Note (optional)</label>
          <input type="text" name="note" placeholder="e.g., Defeated the goblin king" />
        </div>
      </form>
    `,
    ok: {
      label: "Add XP",
      callback: (event, button) => {
        const { form } = button
        return {
          xp: parseInt(form.elements.xp.value, 10),
          note: form.elements.note.value,
        }
      },
    },
    rejectClose: false,
  })

  if (!result || !result.xp) return null

  return result
}

/**
 * Add XP to a character class with audit logging
 * @param {Object} classItem - The character class item
 * @param {number} xpAmount - Amount of XP to add
 * @param {string} note - Optional note for the audit log
 */
export async function addXPToClass(classItem, xpAmount, note = "") {
  const currentXP = classItem.system.xp
  const newXP = currentXP + xpAmount

  // Add to audit log
  const logEntry = {
    date: Date.now(),
    xpChange: xpAmount,
    levelChange: 0,
    note: note || "XP added",
  }

  await classItem.update({
    "system.xp": newXP,
    "system.xpLog": [...classItem.system.xpLog, logEntry],
  })

  ui.notifications.info(
    `Added ${xpAmount} XP to ${classItem.name}. Total: ${newXP}`,
  )
}
