/**
 * @file Dialog for leveling up a character class
 */

/**
 * Show a dialog to level up a character class
 * @param {Object} classItem - The character class item
 * @returns {Promise<{note: string}|null>} The note for the level up, or null if cancelled
 */
export async function showLevelUpDialog(classItem) {
  if (!classItem.system.canLevelUp) {
    ui.notifications.warn("Not enough XP to level up.")
    return null
  }

  const oldLevel = classItem.system.level
  const newLevel = oldLevel + 1

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Level Up to ${newLevel}` },
    content: `
      <form>
        <div class="form-group">
          <label>Leveling up from <strong>${oldLevel}</strong> to <strong>${newLevel}</strong></label>
        </div>
        <div class="form-group">
          <label>Note (optional)</label>
          <input type="text" name="note" placeholder="e.g., Trained by the Town Guard" autofocus />
        </div>
      </form>
    `,
    ok: {
      label: "Level Up!",
      callback: (event, button) => {
        const { form } = button
        return {
          note: form.elements.note.value,
        }
      },
    },
    rejectClose: false,
  })

  return result
}

/**
 * Level up a character class with HP rolling and chat card
 * @param {Object} classItem - The character class item
 * @param {string} note - Optional note for the audit log
 */
export async function levelUpClass(classItem, note = "") {
  const oldLevel = classItem.system.level
  const newLevel = oldLevel + 1
  const newLevelData = classItem.system.xpTable[newLevel - 1]
  const oldLevelData = classItem.system.xpTable[oldLevel - 1]

  // Roll HP for the new level
  const conMod = classItem.parent?.system?.abilityScores?.con?.hpBonus || 0
  const hitDieSize = classItem.system.hitDieSize
  const canUseConMod = newLevelData.hd.canUseConMod
  const hpRoll = await new Roll(
    `1d${hitDieSize}${canUseConMod && conMod ? `+${conMod}` : ""}`,
  ).evaluate()

  // Prepare level-up details
  const improvements = []

  // HD increase
  const hdChange = newLevelData.hd.count - oldLevelData.hd.count
  if (hdChange > 0) {
    improvements.push(
      `<strong>Hit Dice:</strong> ${oldLevelData.hd.count}d${hitDieSize} → ${newLevelData.hd.count}d${hitDieSize}`,
    )
  }

  // THAC0/Attack Bonus
  if (newLevelData.thac0 !== oldLevelData.thac0) {
    improvements.push(
      `<strong>THAC0:</strong> ${oldLevelData.thac0} → ${newLevelData.thac0}`,
    )
  }
  if (newLevelData.attackBonus !== oldLevelData.attackBonus) {
    improvements.push(
      `<strong>Attack Bonus:</strong> ${oldLevelData.attackBonus >= 0 ? "+" : ""}${oldLevelData.attackBonus} → +${newLevelData.attackBonus}`,
    )
  }

  // Saving throws
  const saveChanges = []
  const savingThrowSettings = CONFIG.BAGS.SystemRegistry.getSelectedOfCategory(
    CONFIG.BAGS.SystemRegistry.categories.SAVING_THROWS,
  )
  for (const [key, value] of Object.entries(newLevelData.saves)) {
    if (value !== oldLevelData.saves[key]) {
      const saveLabel = savingThrowSettings.savingThrows[key]?.short || key
      saveChanges.push(`${saveLabel}: ${oldLevelData.saves[key]} → ${value}`)
    }
  }
  if (saveChanges.length > 0) {
    improvements.push(`<strong>Saves:</strong> ${saveChanges.join(", ")}`)
  }

  // Only create chat message if attached to a character
  if (classItem.parent) {
    await ChatMessage.create({
      type: "levelup",
      speaker: ChatMessage.getSpeaker({ actor: classItem.parent }),
      system: {
        classItem: classItem.uuid,
        actor: classItem.parent.uuid,
        className: classItem.name,
        characterName: classItem.parent.name,
        characterImage: classItem.parent.img,
        oldLevel,
        newLevel,
        note,
        hpRoll: {
          total: hpRoll.total,
          dice: hpRoll.dice,
        },
        hitDieSize,
        conMod: canUseConMod && conMod ? conMod : null,
        improvements,
      },
    })
  }

  // Add to audit log
  const logEntry = {
    date: Date.now(),
    xpChange: 0,
    levelChange: 1,
    note: note || `Leveled up from ${oldLevel} to ${newLevel}`,
  }

  // Update character HP if this is attached to an actor
  const updates = {
    "system.manuallySetLevel": newLevel,
    "system.xpLog": [...classItem.system.xpLog, logEntry],
  }

  if (classItem.parent) {
    updates["system.hp.max"] =
      (classItem.parent.system.hp.max || 0) + hpRoll.total
  }

  await classItem.update(updates)

  ui.notifications.info(`${classItem.name} is now level ${newLevel}!`)
}
