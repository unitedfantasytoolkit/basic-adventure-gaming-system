/**
 * @file Dialog for confirming item stack merging.
 */

import { mergeItemStacks } from "../utils/item-stacking.mjs"

/**
 * Dialog to confirm whether a dropped item should be stacked with an existing item.
 * 
 * Shows both items' details and allows the user to choose between stacking them
 * together or keeping them separate.
 */
export default class StackingDialog extends foundry.applications.api
  .DialogV2 {
  /**
   * Show a dialog asking if items should be stacked.
   * 
   * @param {Item} droppedItem - The item being dropped
   * @param {Item} existingItem - The existing item to potentially stack with
   * @returns {Promise<boolean>} True if user chose to stack, false otherwise
   */
  static async promptStack(droppedItem, existingItem) {
    const droppedQty = droppedItem.system.quantity || 1
    const existingQty = existingItem.system.quantity || 1
    const totalQty = droppedQty + existingQty

    return this.wait({
      window: {
        title: game.i18n.localize("BAGS.Dialogs.StackItems.Title"),
      },
      content: `
        <div class="stacking-dialog">
          <p>${game.i18n.format("BAGS.Dialogs.StackItems.Message", {
            itemName: droppedItem.name,
            droppedQty,
            existingQty,
            totalQty,
          })}</p>
          <div class="stacking-dialog__items">
            <div class="stacking-dialog__item">
              <img src="${droppedItem.img}" alt="${droppedItem.name}" />
              <span>${droppedItem.name} (×${droppedQty})</span>
            </div>
            <div class="stacking-dialog__separator">
              <i class="fa fa-plus"></i>
            </div>
            <div class="stacking-dialog__item">
              <img src="${existingItem.img}" alt="${existingItem.name}" />
              <span>${existingItem.name} (×${existingQty})</span>
            </div>
            <div class="stacking-dialog__separator">
              <i class="fa fa-arrow-right"></i>
            </div>
            <div class="stacking-dialog__item">
              <img src="${existingItem.img}" alt="${existingItem.name}" />
              <span>${existingItem.name} (×${totalQty})</span>
            </div>
          </div>
        </div>
      `,
      rejectClose: false,
      modal: true,
      buttons: [
        {
          action: "stack",
          label: game.i18n.localize("BAGS.Dialogs.StackItems.Stack"),
          icon: "fa-solid fa-layer-group",
          default: true,
          callback: () => true,
        },
        {
          action: "separate",
          label: game.i18n.localize("BAGS.Dialogs.StackItems.KeepSeparate"),
          icon: "fa-solid fa-clone",
          callback: () => false,
        },
      ],
    })
  }

  /**
   * Show a dialog for splitting a stack.
   * 
   * @param {Item} item - The item stack to split
   * @returns {Promise<number|null>} The quantity to split off, or null if cancelled
   */
  static async promptSplit(item) {
    const maxSplit = item.system.quantity - 1

    return this.prompt({
      window: {
        title: game.i18n.format("BAGS.Dialogs.SplitStack.Title", {
          itemName: item.name,
        }),
      },
      content: `
        <div class="split-dialog">
          <p>${game.i18n.format("BAGS.Dialogs.SplitStack.Message", {
            itemName: item.name,
            quantity: item.system.quantity,
          })}</p>
          <div class="form-group">
            <label for="split-quantity">${game.i18n.localize("BAGS.Dialogs.SplitStack.Quantity")}</label>
            <range-picker 
              id="split-quantity"
              name="splitQuantity" 
              min="1" 
              max="${maxSplit}" 
              step="1"
              value="1"
            ></range-picker>
          </div>
        </div>
      `,
      rejectClose: false,
      modal: true,
      ok: {
        label: game.i18n.localize("BAGS.Dialogs.SplitStack.Split"),
        callback: (event, button, dialog) => {
          const quantity = parseInt(
            button.form.elements.splitQuantity.value,
            10,
          )
          return quantity
        },
      },
    })
  }
}
