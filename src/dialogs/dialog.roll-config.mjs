/**
 * A specialized dialog for configuring and executing dice rolls.
 * @extends {DialogV2}
 */
const { DialogV2 } = foundry.applications.api

export default class RollDialog extends DialogV2 {
  /**
   * Create and display a roll dialog, returning a Promise that resolves to the roll configuration
   * @param {Object} options - Configuration options for the dialog
   * @param {string} [options.title] - The dialog title
   * @param {number} [options.diceCount=1] - Initial number of dice
   * @param {number} [options.diceSize=20] - Initial dice size (d20, d6, etc.)
   * @param {string|number} [options.modifier="0"] - Initial modifier
   * @param {boolean} [options.reversedSuccess=false] - Whether success is lower than target (true) or higher than target (false)
   * @param {string} [options.rollMode="roll"] - The roll mode to use
   * @param {string} [options.description] - Optional description text to show above the form
   * @returns {Promise<Object|null>} Roll parameters or null if canceled
   */
  static async createDialog({
    title = game.i18n.localize("OSR.Dialog.Roll.Title"),
    diceCount = 1,
    diceSize = 20,
    modifier = "0",
    reversedSuccess = false,
    rollMode = "roll",
    description = "",
  } = {}) {
    // Create the content HTML
    const content = `
      ${description ? `<div class="roll-description">${description}</div>` : ""}
      <form class="osr-roll-form">
        <div class="form-group">
          <label for="diceCount">${game.i18n.localize("OSR.Dialog.Roll.DiceCount")}</label>
          <div class="form-fields">
            <input type="number" name="diceCount" value="${diceCount}" min="1" step="1">
          </div>
        </div>
        
        <div class="form-group">
          <label for="diceSize">${game.i18n.localize("OSR.Dialog.Roll.DiceSize")}</label>
          <div class="form-fields">
            <input type="number" name="diceSize" value="${diceSize}" min="1" step="1">
          </div>
        </div>
        
        <div class="form-group">
          <label for="modifier">${game.i18n.localize("OSR.Dialog.Roll.Modifier")}</label>
          <div class="form-fields">
            <input type="text" name="modifier" value="${modifier}">
          </div>
          <p class="hint">${game.i18n.localize("OSR.Dialog.Roll.ModifierHint")}</p>
        </div>
        
        <div class="form-group">
          <label for="reversedSuccess">${game.i18n.localize("OSR.Dialog.Roll.ReversedSuccess")}</label>
          <div class="form-fields">
            <input type="checkbox" name="reversedSuccess" ${reversedSuccess ? "checked" : ""}>
          </div>
          <p class="hint">${game.i18n.localize("OSR.Dialog.Roll.ReversedSuccessHint")}</p>
        </div>
        
        <div class="form-group">
          <label for="rollMode">${game.i18n.localize("OSR.Dialog.Roll.RollMode")}</label>
          <div class="form-fields">
            <select name="rollMode">
              ${Object.entries(CONFIG.Dice.rollModes)
                .map(([key, { label }]) => {
                  return `<option value="${key}" ${rollMode === key ? "selected" : ""}>${game.i18n.localize(label)}</option>`
                })
                .join("")}
            </select>
          </div>
        </div>
      </form>
    `

    // Create the buttons
    const buttons = [
      {
        action: "roll",
        label: "OSR.Dialog.Roll.Button",
        icon: "fas fa-dice-d20",
        class: "roll-button",
        default: true,
      },
      {
        action: "cancel",
        label: "Cancel",
        icon: "fas fa-times",
      },
    ]

    return new Promise((resolve, reject) => {
      this.wait({
        classes: ["application--roll-form"],
        window: { title },
        content,
        buttons,
        render: (event, element) => {
          // Auto-focus the dice count input on render
          setTimeout(() => {
            const input = element.querySelector('input[name="diceCount"]')
            if (input) input.focus()
          }, 100)
        },
        rejectClose: false,
        submit: async (result) => {
          if (result === "cancel" || result === null) return null

          // Get form data
          const form = document.querySelector(".application--roll-form form")
          if (!form) return null

          resolve({
            diceCount: Math.max(
              1,
              Math.floor(Number(form.elements.diceCount.value)) || 1,
            ),
            diceSize: Math.max(
              1,
              Math.floor(Number(form.elements.diceSize.value)) || 20,
            ),
            modifier: form.elements.modifier.value || "0",
            reversedSuccess: form.elements.reversedSuccess.checked,
            rollMode: form.elements.rollMode.value,
          })
          // console.info(response)

          // return response
        },
      })
    })
  }

  /**
   * Request that a specific user make a roll with their assigned character
   * @param {User|string} user - The User instance or user ID who should make the roll
   * @param {Object} options - Roll configuration options
   * @returns {Promise<Object|null>} The roll result or null if the request was declined
   */
  static async requestRoll(user, options = {}) {
    // If user is a string (ID), get the user object
    if (typeof user === "string") {
      const userId = user
      user = game.users.get(userId)
      if (!user) throw new Error(`User [${userId}] does not exist`)
    }

    // Handle self-requests (GM rolling for themselves)
    if (user.isSelf) {
      return this.createDialog(options)
    }

    // Include the requester's name in the options
    options.requestedBy = game.user.name

    // Handle requests to other users
    return user.query("osrRollRequest", options)
  }

  /**
   * Handle incoming roll requests
   * @param {Object} data - The roll request data
   * @returns {Promise<Object|null>} The roll result or null if declined
   * @internal
   */
  static async _handleRollRequest(data) {
    // Get the character assigned to this user
    const character = game.user.character
    if (!character) {
      ui.notifications.warn(
        game.i18n.localize("OSR.Warnings.NoCharacterAssigned"),
      )
      return null
    }

    // Format the request notification
    const requestHtml = `
      <div class="roll-request-notification">
        <h3>${game.i18n.format("OSR.Dialog.RollRequest.From", { name: data.requestedBy })}</h3>
        ${data.description ? `<p>${data.description}</p>` : ""}
        <div class="roll-details">
          <span>${data.diceCount}d${data.diceSize} ${data.modifier !== "0" ? `+ ${data.modifier}` : ""}</span>
          ${
            data.reversedSuccess
              ? `<span>(${game.i18n.localize("OSR.Dialog.Roll.ReversedSuccess")})</span>`
              : ""
          }
        </div>
      </div>
    `

    // Ask the user if they want to make the roll
    const confirmed = await Dialog.confirm({
      title: data.title || game.i18n.localize("OSR.Dialog.RollRequest.Title"),
      content: requestHtml,
      yes: {
        icon: "fas fa-dice-d20",
        label: game.i18n.localize("OSR.Dialog.RollRequest.Accept"),
      },
      no: {
        icon: "fas fa-times",
        label: game.i18n.localize("OSR.Dialog.RollRequest.Decline"),
      },
      defaultYes: true,
    })

    if (!confirmed) {
      // Notify the GM that the request was declined
      if (data.showResult !== false) {
        ChatMessage.create({
          content: game.i18n.format("OSR.Dialog.RollRequest.Declined", {
            user: game.user.name,
            character: character.name,
          }),
          whisper: [
            game.users.find((u) => u.name === data.requestedBy)?.id,
          ].filter((id) => id),
        })
      }
      return null
    }

    // Show the roll dialog to the user
    const rollParams = await RollDialog.createDialog({
      title: data.title,
      diceCount: data.diceCount,
      diceSize: data.diceSize,
      modifier: data.modifier,
      reversedSuccess: data.reversedSuccess,
      rollMode: data.rollMode,
      description: data.description,
    })

    if (!rollParams) return null

    // Create the roll formula
    const formula = `${rollParams.diceCount}d${rollParams.diceSize}${
      rollParams.modifier && rollParams.modifier !== "0"
        ? rollParams.modifier.startsWith("@")
          ? ` + ${rollParams.modifier}`
          : Number(rollParams.modifier) >= 0
            ? ` + ${rollParams.modifier}`
            : ` - ${Math.abs(Number(rollParams.modifier))}`
        : ""
    }`

    // Create and execute the roll
    const roll = await Roll.create(formula, character.getRollData()).evaluate({
      async: true,
    })

    // Display the result if showResult is true
    if (data.showResult !== false) {
      const flavor =
        data.description ||
        game.i18n.format("OSR.Dialog.RollRequest.ResponseFlavor", {
          character: character.name,
        })

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: character }),
        flavor,
        rollMode: rollParams.rollMode,
      })
    }

    return {
      formula,
      roll,
      character: character.id,
      params: rollParams,
    }
  }

  /**
   * Convenience method to create a roll formula from parameters
   * @param {Object} params - Roll parameters
   * @returns {string} The roll formula
   */
  static getRollFormula(params) {
    const { diceCount, diceSize, modifier } = params
    let formula = `${diceCount}d${diceSize}`

    // Add modifier if it's not 0
    if (modifier && modifier !== "0") {
      // If the modifier starts with @ it's a rolldata property reference
      // Otherwise, we need to determine if it's positive or negative
      if (modifier.startsWith("@")) {
        formula += ` + ${modifier}`
      } else {
        const modNum = Number(modifier)
        if (!NumberisNaN(modNum)) {
          formula += modNum >= 0 ? ` + ${modNum}` : ` - ${Math.abs(modNum)}`
        } else {
          formula += ` + ${modifier}`
        }
      }
    }

    return formula
  }
}
