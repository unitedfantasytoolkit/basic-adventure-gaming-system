import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

import BAGSApplication from "../applications/application.mjs"
import ActionEffectEditor from "./action-effect-editor.mjs"

/**
 * @typedef {object} ActionEditor
 * @class
 */
export default class ActionEditor extends BAGSApplication {
  static SUB_APPS = {
    effectEditor: ActionEffectEditor,
  }

  _activeAction

  constructor(options = {}) {
    super(options)

    this._activeAction = this.document.system.actions?.[0]?.id
  }

  // === App config ============================================================

  static DEFAULT_OPTIONS = {
    classes: ["application--action-editor"],
    window: {
      contentClasses: ["application__master-detail"],
    },
    actions: {
      // Action management
      "select-action": this.selectAction,
      "add-action": this.addAction,
      "delete-action": this.deleteAction,
      // Effect management
      "add-action-effect": this.addActionEffect,
      "delete-action-effect": this.deleteActionEffect,
      "edit-action-effect": this.editActionEffect,
    },
    position: {
      width: 720,
      height: 480,
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/action-editor`
  }

  static PARTS = {
    master: {
      template: `${this.TEMPLATE_ROOT}/master.hbs`,
    },
    detail: {
      template: `${this.TEMPLATE_ROOT}/detail.hbs`,
      scrollable: [".scrollable"],
    },
  }

  get title() {
    return `Action Editor: ${this.document.name}`
  }

  // --- Tabs ------------------------------------------------------------------

  tabGroups = {
    sheet: "settings", // Default to settings tab which is always available
  }

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "settings",
          group: "sheet",
          icon: "fa-solid fa-gear",
          label: "Settings",
        },
        {
          id: "description",
          group: "sheet",
          icon: "fa-solid fa-file-lines",
          label: "Description",
          cssClass: "tab--with-text-editor",
        },
        {
          id: "attempt",
          group: "sheet",
          icon: "fa-solid fa-bullseye-arrow",
          label: "Attempt",
        },
        {
          id: "attempt-messages",
          group: "sheet",
          icon: "fa-solid fa-note",
          label: "Attempt Messages",
        },
        {
          id: "effects",
          group: "sheet",
          icon: "fa-solid fa-sparkle",
          label: "Effects",
        },
        {
          id: "consumption",
          group: "sheet",
          icon: "fa-solid fa-star-half",
          label: "Consumption",
        },
        {
          id: "restrictions",
          group: "sheet",
          icon: "fa-solid fa-unlock",
          label: "Restrictions",
        },
      ],
      initial: "settings", // Start on settings tab which is always enabled
      labelPrefix: "BAGS.Actions.Tabs",
    },
  }

  // === Rendering =============================================================

  /**
   * Provide context to the templating engine.
   * @override
   */
  async _prepareContext() {
    const context = await super._prepareContext()

    const doc = this.document

    return {
      ...context,
      actor: doc,
      source: doc.toObject(),
      fields: doc.system.schema.fields.actions.element.fields,
    }
  }

  /**
   * Override frame rendering to dynamically disable tabs based on action flags
   * @override
   */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options)
    
    // Get the current action to check flags
    const action = this._activeAction
      ? this.document.getAction(this._activeAction)
      : (this.document.system.actions[0] || null)
    
    if (action) {
      const tabButtons = frame.querySelectorAll('[data-action="tab"]')
      
      tabButtons.forEach(btn => {
        const tabId = btn.dataset.tab
        let shouldDisable = false
        
        // Check if this tab should be disabled based on action flags
        if ((tabId === "attempt" || tabId === "attempt-messages") && !action.flags.usesAttempt) {
          shouldDisable = true
        } else if (tabId === "effects" && !action.flags.usesEffect) {
          shouldDisable = true
        } else if (tabId === "consumption" && !action.flags.usesConsumption) {
          shouldDisable = true
        } else if (tabId === "restrictions" && !action.flags.usesRestrictions) {
          shouldDisable = true
        }
        
        if (shouldDisable) {
          btn.disabled = true
          btn.setAttribute('aria-disabled', 'true')
        } else {
          btn.disabled = false
          btn.removeAttribute('aria-disabled')
        }
      })
    }
    
    return frame
  }

  /** @override */
  async _preparePartContext(partId, context) {
    await super._preparePartContext(partId, context)
    const doc = this.document
    context.tabs = this._prepareTabs("sheet")
    context.tab = context.tabs[partId] || null
    
    // Get the active action for flag checks
    const action = this._activeAction
      ? doc.getAction(this._activeAction)
      : (doc.system.actions[0] || null)
    
    // Modify the tabs array to disable tabs based on action flags
    if (action && Array.isArray(context.tabs)) {
      context.tabs = context.tabs.map(tab => {
        const tabCopy = { ...tab }
        
        // Disable attempt tabs if usesAttempt is false
        if ((tab.id === "attempt" || tab.id === "attempt-messages") && !action.flags.usesAttempt) {
          tabCopy.disabled = true
        }
        
        // Disable effects tab if usesEffect is false
        if (tab.id === "effects" && !action.flags.usesEffect) {
          tabCopy.disabled = true
        }
        
        // Disable consumption tab if usesConsumption is false
        if (tab.id === "consumption" && !action.flags.usesConsumption) {
          tabCopy.disabled = true
        }
        
        // Disable restrictions tab if usesRestrictions is false
        if (tab.id === "restrictions" && !action.flags.usesRestrictions) {
          tabCopy.disabled = true
        }
        
        return tabCopy
      })
      
      // If the current active tab for this group is disabled, switch to an enabled tab
      const currentTab = this.tabGroups.sheet
      const currentTabData = context.tabs.find(t => t.id === currentTab)
      if (currentTabData?.disabled) {
        // Find the first enabled tab
        const firstEnabledTab = context.tabs.find(t => !t.disabled)
        if (firstEnabledTab) {
          this.tabGroups.sheet = firstEnabledTab.id
        }
      }
    }
    
    switch (partId) {
      case "master":
        context.actions = doc.system.actions.map((a) => ({
          ...a,
          active: a.id === this._activeAction,
        }))
        break
      case "detail":
        context.action = this._activeAction
          ? doc.getAction(this._activeAction)
          : (doc.system.actions[0] || null)
        break
      case "description":
        context.headingText = "BAGS.Actions.Editor.Description.Heading"
        context.field = doc.system.schema.fields.actions.element.fields.description
        context.fieldValue = this._activeAction
          ? doc.getAction(this._activeAction)?.description
          : (doc.system.actions[0]?.description || "")
        break
      default:
        break
    }
    return context
  }

  // === Action management =====================================================

  static selectAction(e) {
    const actionElement = e.target.closest("[data-action-id]")
    const { actionId } = actionElement.dataset
    if (actionId) {
      this._activeAction = actionId
      this.render()
    }
  }

  static async addAction(e) {
    // Generate a unique name for the new action
    const existingActions = this.document.system.actions
    const baseNames = existingActions
      .map(a => a.name)
      .filter(name => /^New Action( \d+)?$/.test(name))
    
    let newName = "New Action"
    if (baseNames.length > 0) {
      // Find the highest number
      const numbers = baseNames
        .map(name => {
          const match = name.match(/^New Action(?: (\d+))?$/)
          return match ? (match[1] ? parseInt(match[1]) : 1) : 0
        })
        .filter(n => n > 0)
      
      const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0
      newName = `New Action ${maxNumber + 1}`
    }
    
    await this.document.createAction({ name: newName })
    if (!this._activeAction)
      this._activeAction = this.document.system.actions[0].id
    this.render()
  }

  /**
   * Deletes an action and updates the active action selection.
   * If the deleted action was active, selects the next available action.
   */
  static async deleteAction(event) {
    const actionId = event.target.closest("[data-action-id]").dataset.actionId
    const action = this.document.getAction(actionId)
    
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BAGS.Actions.DeleteAction.Title") },
      content: `<p>${game.i18n.format("BAGS.Actions.DeleteAction.Content", { name: action.name })}</p>`,
      rejectClose: false,
      modal: true,
    })
    
    if (!confirmed) return
    
    const actions = this.document.system.actions
    
    // If we're deleting the active action, we need to update the selection
    if (this._activeAction === actionId) {
      const currentIndex = actions.findIndex(({ id }) => id === actionId)
      
      // Try to select the next action, or the previous one, or null if none left
      if (actions.length > 1) {
        // If there's an action after this one, select it
        if (currentIndex < actions.length - 1) {
          this._activeAction = actions[currentIndex + 1].id
        }
        // Otherwise select the previous one
        else if (currentIndex > 0) {
          this._activeAction = actions[currentIndex - 1].id
        }
      } else {
        // This is the last action, clear the selection
        this._activeAction = null
      }
    }
    
    await this.document.deleteAction(actionId)
    this.render()
  }

  // === Effect management =====================================================

  /**
   * Add a new Effect to the currently editable action.
   */
  static async addActionEffect() {
    const action = this.document.getAction(this._activeAction)
    if (!action) return

    const { actions: actionSchema } = this.document.system.schema.fields
    const newEffect = foundry.utils.mergeObject(
      actionSchema.element.fields.effects.element.getInitialValue(),
      {
        id: foundry.utils.randomID(),
      },
    )

    await this.document.updateAction(this._activeAction, {
      effects: [...action.effects, newEffect],
    })
    this.render()
  }

  static async deleteActionEffect(_event, button) {
    const action = this.document.getAction(this._activeAction)
    if (!action) return

    const effectId = button.dataset.effectId
    const effect = action.effects.find(({ id }) => id === effectId)
    
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BAGS.Actions.DeleteEffect.Title") },
      content: `<p>${game.i18n.format("BAGS.Actions.DeleteEffect.Content", { name: effect.name || game.i18n.localize("BAGS.Actions.UnnamedEffect") })}</p>`,
      rejectClose: false,
      modal: true,
    })
    
    if (!confirmed) return
    
    const updatedEffects = action.effects.filter(({ id }) => id !== effectId)

    await this.document.updateAction(this._activeAction, {
      effects: updatedEffects,
    })
    this.render()
  }

  static async editActionEffect(_event, button) {
    const action = this.document.getAction(this._activeAction)
    if (!action) return

    const effect = action.effects.find(
      ({ id }) => id === button.dataset.effectId,
    )
    if (!effect) return

    this.subApps.effectEditor.prepareToEdit(action, effect)
    this.subApps.effectEditor.render(true)
  }

  // === Saving ================================================================

  /**
   * Attempt to update the active action.
   * @param {SubmitEvent} _event - Todo
   * @param {HTMLFormElement} _form - Todo
   * @param {FormData} formData - Data from this Application's form.
   * @this {ActionEditor}
   */
  static async save(_event, _form, formData) {
    try {
      await this.document.updateAction(this._activeAction, formData.object)
      this.render()
    } catch (e) {
      this.render()
      throw new Error(e)
    }
  }

  // === Drag and Drop =========================================================

  /**
   * Set up drag-drop functionality for effect reordering and update tab states
   * @override
   */
  _onRender(context, options) {
    super._onRender(context, options)

    // Update tab disabled states based on current action flags
    this._updateTabStates()

    // Set up resize handle
    this._setupResizeHandle()

    const DragDrop = foundry.applications.ux.DragDrop.implementation

    // Effect reordering
    new DragDrop({
      dragSelector: ".action-effects__effect",
      dropSelector: ".action-effects",
      permissions: {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      },
      callbacks: {
        dragover: this._onDragOverEffect.bind(this),
        dragstart: this._onDragStartEffect.bind(this),
        drop: this._onDropEffect.bind(this),
      },
    }).bind(this.element)

    // Action reordering
    new DragDrop({
      dragSelector: ".application__master-detail__master-item",
      dropSelector: ".application__master-detail__master menu",
      permissions: {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      },
      callbacks: {
        dragover: this._onDragOverAction.bind(this),
        dragstart: this._onDragStartAction.bind(this),
        drop: this._onDropAction.bind(this),
      },
    }).bind(this.element)
  }

  /**
   * Set up the resize handle for the master panel
   */
  _setupResizeHandle() {
    const masterDetail = this.element.querySelector('.application__master-detail')
    if (!masterDetail) return

    // Create resize handle if it doesn't exist
    let resizeHandle = masterDetail.querySelector('.application__master-detail__resize-handle')
    if (!resizeHandle) {
      resizeHandle = document.createElement('div')
      resizeHandle.classList.add('application__master-detail__resize-handle')
      masterDetail.appendChild(resizeHandle)
    }

    // Load saved width
    const savedWidth = localStorage.getItem('actionEditor.masterWidth')
    if (savedWidth) {
      masterDetail.style.setProperty('--master-width', savedWidth)
    }

    // Set up resize drag
    let isResizing = false
    let startX = 0
    let startWidth = 0

    const startResize = (e) => {
      isResizing = true
      startX = e.clientX
      const master = masterDetail.querySelector('.application__master-detail__master')
      startWidth = master.offsetWidth
      resizeHandle.classList.add('dragging')
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    const doResize = (e) => {
      if (!isResizing) return
      const delta = e.clientX - startX
      const newWidth = Math.max(150, Math.min(500, startWidth + delta))
      masterDetail.style.setProperty('--master-width', `${newWidth}px`)
    }

    const stopResize = () => {
      if (!isResizing) return
      isResizing = false
      resizeHandle.classList.remove('dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      
      // Save width
      const currentWidth = masterDetail.style.getPropertyValue('--master-width')
      if (currentWidth) {
        localStorage.setItem('actionEditor.masterWidth', currentWidth)
      }
    }

    resizeHandle.addEventListener('mousedown', startResize)
    document.addEventListener('mousemove', doResize)
    document.addEventListener('mouseup', stopResize)
  }

  /**
   * Update tab button disabled states based on current action flags
   */
  _updateTabStates() {
    // Get the current action to check flags
    const action = this._activeAction
      ? this.document.getAction(this._activeAction)
      : (this.document.system.actions[0] || null)
    
    if (!action) return
    
    const tabButtons = this.element.querySelectorAll('[data-action="tab"]')
    
    tabButtons.forEach(btn => {
      const tabId = btn.dataset.tab
      let shouldDisable = false
      
      // Check if this tab should be disabled based on action flags
      if ((tabId === "attempt" || tabId === "attempt-messages") && !action.flags.usesAttempt) {
        shouldDisable = true
      } else if (tabId === "effects" && !action.flags.usesEffect) {
        shouldDisable = true
      } else if (tabId === "consumption" && !action.flags.usesConsumption) {
        shouldDisable = true
      } else if (tabId === "restrictions" && !action.flags.usesRestrictions) {
        shouldDisable = true
      }
      
      if (shouldDisable) {
        btn.disabled = true
        btn.setAttribute('aria-disabled', 'true')
      } else {
        btn.disabled = false
        btn.removeAttribute('aria-disabled')
      }
    })
  }

  _canDragStart(event) {
    return this.document.isOwner
  }

  _canDragDrop(event) {
    return this.document.isOwner
  }

  // === Effect Drag and Drop ==================================================

  _onDragOverEffect(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  _onDragStartEffect(event) {
    const { effectId } = event.currentTarget.dataset
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "ActionEffect",
        effectId,
        actionId: this._activeAction,
      }),
    )
  }

  async _onDropEffect(event) {
    event.preventDefault()

    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"))
      if (data.type !== "ActionEffect") return
      if (data.actionId !== this._activeAction) return

      const action = this.document.getAction(this._activeAction)
      if (!action) return

      const draggedEffect = action.effects.find(({ id }) => id === data.effectId)
      if (!draggedEffect) return

      const dropTarget = event.target.closest(".action-effects__effect")
      if (!dropTarget) return

      const targetEffectId = dropTarget.dataset.effectId
      const targetIndex = action.effects.findIndex(
        ({ id }) => id === targetEffectId,
      )
      const draggedIndex = action.effects.findIndex(
        ({ id }) => id === data.effectId,
      )

      if (targetIndex === -1 || draggedIndex === -1) return
      if (targetIndex === draggedIndex) return

      const reorderedEffects = [...action.effects]
      reorderedEffects.splice(draggedIndex, 1)
      reorderedEffects.splice(targetIndex, 0, draggedEffect)

      await this.document.updateAction(this._activeAction, {
        effects: reorderedEffects,
      })
      this.render()
    } catch (error) {
      console.error("Error handling effect reorder:", error)
    }
  }

  // === Action Drag and Drop ==================================================

  _onDragOverAction(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  _onDragStartAction(event) {
    const actionItem = event.currentTarget
    const actionId = actionItem.dataset.actionId
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "Action",
        actionId,
      }),
    )
  }

  async _onDropAction(event) {
    event.preventDefault()

    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"))
      if (data.type !== "Action") return

      const dropTarget = event.target.closest(".application__master-detail__master-item")
      if (!dropTarget) return

      const draggedActionId = data.actionId
      const targetActionId = dropTarget.dataset.actionId

      if (draggedActionId === targetActionId) return

      const actions = [...this.document.system.actions]
      const draggedIndex = actions.findIndex(({ id }) => id === draggedActionId)
      const targetIndex = actions.findIndex(({ id }) => id === targetActionId)

      if (draggedIndex === -1 || targetIndex === -1) return

      const [draggedAction] = actions.splice(draggedIndex, 1)
      actions.splice(targetIndex, 0, draggedAction)

      await this.document.update({
        "system.actions": actions,
      })
      this.render()
    } catch (error) {
      console.error("Error handling action reorder:", error)
    }
  }
}
