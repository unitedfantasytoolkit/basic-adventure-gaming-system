const { HandlebarsApplicationMixin } = foundry.applications.api
const { AbstractSidebarTab } = foundry.applications.sidebar

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

/**
 * A class that represents the UI used for managing the Party
 * and exploration tasks.
 *
 * Features:
 * - Add/remove Characters
 * - Display character info -- HP, move speed, etc.
 */

// export default class PartySidebar extends SidebarTab {
//   /** @override */
//   static get defaultOptions() {
//     return foundry.utils.mergeObject(super.defaultOptions, {
//       id: "party",
//       template: `${SYSTEM_TEMPLATE_PATH}/sidebar/party.hbs`,
//       title: "BAGS.Party.Title",
//       dragDrop: [
//         { dragSelector: ".party-list__item", dropSelector: ".party-list" },
//       ],
//       // filters: [{inputSelector: 'input[name="search"]', contentSelector: ".directory-list"}],
//       contextMenuSelector: ".party-list__item",
//     })
//   }
//
//   static tooltip = "BAGS.Party.Title"
//
//   static icon = "fas fa-users"
//
//   static lookupActor(actor) {
//     const actorObj = typeof actor === "string" ? game.actors.get(actor) : actor
//
//     return actorObj?.type !== "character" ? null : actorObj
//   }
//
//   static isInParty(actor) {
//     const actorObj = PartySidebar.lookupActor(actor)
//     return !actorObj ? false : actorObj.getFlag(game.system.id, "party")
//   }
//
//   static async addToParty(actor) {
//     await PartySidebar.lookupActor(actor)?.setFlag(
//       game.system.id,
//       "party",
//       true,
//     )
//     ui.sidebar.render()
//   }
//
//   static async removeFromParty(actor) {
//     await PartySidebar.lookupActor(actor)?.setFlag(
//       game.system.id,
//       "party",
//       false,
//     )
//     ui.sidebar.render()
//   }
//
//   static async grantItemToPartyMember(actor, item) {
//     await PartySidebar.lookupActor(actor)?.createEmbeddedDocuments("Item", item)
//   }
//
//   /** @override */
//   async getData(options = {}) {
//     const context = await super.getData(options)
//     context.party = this.partyMembers
//     return context
//   }
//
//   get partyMembers() {
//     return game.actors.filter((a) => a.getFlag(game.system.id, "party"))
//   }
//
//   _onDragStart(event) {
//     const { entryId } = event.target.closest("[data-entry-id]").dataset
//
//     const actor = game.actors.get(entryId)
//     if (!actor) return
//
//     const dragData = actor.toDragData()
//     if (!dragData) return
//
//     event.dataTransfer.setData("text/plain", JSON.stringify(dragData))
//   }
//
//   /**
//    * @override
//    * @param {DragEvent} event - The drag event fired when dropping an item onto the party list
//    */
//   async _onDrop(event) {
//     const typesAllowed = ["Actor", "Item", "Folder"]
//
//     const performAddToParty = (doc) => {
//       if (
//         doc &&
//         doc.documentName === "Actor" &&
//         !PartySidebar.isInParty(doc.id)
//       ) {
//         doc.setFlag(game.system.id, "party", true)
//         return true
//       }
//
//       return false
//     }
//
//     const performAddItemToPartyMember = (actor, item) => {
//       if (item.documentName !== "Item") return
//       actor.createEmbeddedDocuments("Item", [item])
//     }
//
//     const targetId = event.target.closest("[data-entry-id]")?.dataset.entryId
//     const { type, uuid } = TextEditor.getDragEventData(event)
//
//     // Kick out things that aren't actors or embedded into actors
//     if (!typesAllowed.includes(type)) return
//
//     // An item can't be a party member.
//     // It must be dropped onto a party member.
//     if (type === "Item" && !targetId) return
//
//     // This is the latest we can wait to fetch the dropped document
//     const sourceDoc = await fromUuid(uuid)
//
//     // If it's not a character, don't allow it to join the party
//     if (type === "Actor" && (!sourceDoc || sourceDoc?.type !== "character"))
//       return
//
//     if (performAddToParty(sourceDoc)) return
//
//     // This is the latest we can wait to fetch the target document
//     const targetDoc = game.actors.get(targetId)
//
//     if (performAddItemToPartyMember(targetDoc, sourceDoc)) return
//
//     if (type === "Folder") {
//       sourceDoc.contents.forEach((doc) => {
//         if (doc.documentName === "Item") {
//           performAddItemToPartyMember(targetDoc, doc)
//           return
//         }
//
//         if (doc.documentName === "Actor") {
//           performAddToParty(doc)
//         }
//       })
//     }
//   }
//
//   #openXPApp() {}
//
//   #openPartyMemberSheet(event) {
//     const entryId = event.target?.closest("[data-entry-id]")?.dataset.entryId
//     game.actors.get(entryId)?.sheet?.render(true)
//   }
//
//   /**
//    * @todo - Listener for "Distribute XP"
//    * @todo - Listener for "Distrbute Treasure"
//    * @override
//    */
//   activateListeners(html) {
//     super.activateListeners(html)
//
//     html.find(".add-xp").click(this.#openXPApp.bind(this))
//     html
//       .find(".thumbnail, .entry-name")
//       .click(this.#openPartyMemberSheet.bind(this))
//
//     this._contextMenu(html)
//   }
//
//   /**
//    * Configure the context menu which should be used for party members
//    * @protected
//    * @override
//    */
//   _contextMenu(html) {
//     const contextOptions = [
//       {
//         name: "UFT.partytab.removeFromParty",
//         icon: '<i class="fa-light fa-users"></i>',
//         condition: (node) =>
//           PartySidebar.isInParty(node.data("entry-id")) === true,
//         callback: (node) =>
//           game.user.isGM && PartySidebar.removeFromParty(node.data("entry-id")),
//       },
//     ]
//
//     // ContextMenu is a global.
//
//     new ContextMenu(
//       this.element,
//       html,
//       this.options.contextMenuSelector,
//       contextOptions,
//     )
//   }
// }

export default class PartySidebar extends HandlebarsApplicationMixin(
  AbstractSidebarTab,
) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["directory", "flexcol", "themed", "theme-dark"], // TODO: Light theme sidebar styles
    collection: null,
    renderUpdateKeys: ["name", "img", "ownership", "sort", "folder"],
    id: "party",
    actions: {
      // activateEntry: DocumentDirectory.#onClickEntry,
      // collapseFolders: DocumentDirectory.#onCollapseFolders,
      // createEntry: DocumentDirectory.#onCreateEntry,
      // createFolder: DocumentDirectory.#onCreateFolder,
      // showIssues: DocumentDirectory.#onShowIssues,
      // toggleFolder: DocumentDirectory.#onToggleFolder,
      // toggleSearch: DocumentDirectory.#onToggleSearch,
      // toggleSort: DocumentDirectory.#onToggleSort,
    },
  }

  /** @override */
  static PARTS = {
    header: {
      template: "templates/sidebar/directory/header.hbs",
    },
    directory: {
      template: "templates/sidebar/directory/directory.hbs",
      scrollable: [""],
    },
    footer: {
      template: "templates/sidebar/directory/footer.hbs",
    },
  }

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * The path to the template used to render a single entry within the directory.
   * @type {string}
   * @protected
   */
  static _entryPartial = "templates/sidebar/partials/document-partial.hbs"

  /** @override */
  get title() {
    return game.i18n.format("SIDEBAR.DirectoryTitle", {
      type: game.i18n.localize(this.documentClass.metadata.label),
    })
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options)
    if (typeof options.collection === "string")
      options.collection = game.collections.get(options.collection)
    return options
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _canRender(options) {
    const { renderContext, renderData } = options
    if (renderContext === `update${this.documentName}`) {
      if (
        !renderData?.some((d) =>
          this.options.renderUpdateKeys.some((k) =>
            foundry.utils.hasProperty(d, k),
          ),
        )
      ) {
        return false
      }
    }
    return super._canRender(options)
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options)
    parts.directory.templates ??= []
    parts.directory.templates.push(
      this.constructor._entryPartial,
      this.constructor._folderPartial,
    )
    return parts
  }

  /* -------------------------------------------- */

  /**
   * Register context menu entries and fire hooks.
   * @protected
   */
  _createContextMenus() {
    // new ContextMenu(
    //   this.element,
    //   ".folder .folder-header",
    //   this._getFolderContextOptions(),
    //   {
    //     hookName: "FolderContext",
    //     jQuery: false,
    //     fixed: true,
    //   },
    // )
    new ContextMenu(
      this.element,
      ".directory-item[data-entry-id]",
      this._getEntryContextOptions(),
      {
        jQuery: false,
        fixed: true,
      },
    )
  }

  /* -------------------------------------------- */

  /**
   * Get context menu entries for entries in this directory.
   * @returns {ContextMenuEntry[]}
   * @protected
   */
  _getEntryContextOptions() {
    return []
    // const getDocument = (li) =>
    //   this.collection.get(li.closest("[data-entry-id]").dataset.entryId)
    // return [
    //   {
    //     name: "OWNERSHIP.Configure",
    //     icon: '<i class="fas fa-lock"></i>',
    //     condition: game.user.isGM,
    //     callback: (li) =>
    //       new DocumentOwnershipConfig({
    //         document: getDocument(li),
    //         position: {
    //           top: Math.min(li.offsetTop, window.innerHeight - 350),
    //           left: window.innerWidth - 720,
    //         },
    //       }).render({ force: true }),
    //   },
    //   {
    //     name: "SIDEBAR.Export",
    //     icon: '<i class="fas fa-file-export"></i>',
    //     condition: (li) => getDocument(li).isOwner,
    //     callback: (li) => getDocument(li).exportToJSON(),
    //   },
    //   {
    //     name: "SIDEBAR.Import",
    //     icon: '<i class="fas fa-file-import"></i>',
    //     condition: (li) => getDocument(li).isOwner,
    //     callback: (li) => getDocument(li).importFromJSONDialog(),
    //   },
    //   {
    //     name: "FOLDER.Clear",
    //     icon: '<i class="fas fa-folder"></i>',
    //     condition: (header) => {
    //       const li = header.closest(".directory-item")
    //       return game.user.isGM && !!getDocument(li).folder
    //     },
    //     callback: (li) => getDocument(li).update({ folder: null }),
    //   },
    //   {
    //     name: "SIDEBAR.Delete",
    //     icon: '<i class="fas fa-trash"></i>',
    //     condition: game.user.isGM,
    //     callback: (li) =>
    //       getDocument(li).deleteDialog({
    //         position: {
    //           top: Math.min(li.offsetTop, window.innerHeight - 350),
    //           left: window.innerWidth - 770,
    //           width: 450,
    //         },
    //       }),
    //   },
    //   {
    //     name: "SIDEBAR.Duplicate",
    //     icon: '<i class="far fa-copy"></i>',
    //     condition: () =>
    //       game.user.isGM || this.documentClass.canUserCreate(game.user),
    //     callback: (li) => {
    //       const original = getDocument(li)
    //       return original.clone(
    //         {
    //           name: game.i18n.format("DOCUMENT.CopyOf", {
    //             name: original._source.name,
    //           }),
    //         },
    //         { save: true, addSource: true },
    //       )
    //     },
    //   },
    // ]
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options)
    this._createContextMenus()
    if (!this.isPopout) this.collection.apps.push(this)
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options)

    // Search
    if (options.parts.includes("header")) {
      new SearchFilter({
        inputSelector: "search input",
        contentSelector: ".directory-list",
        callback: this._onSearchFilter.bind(this),
        initial: this.element.querySelector("search input").value,
      }).bind(this.element)
    }

    // Drag-drop
    if (options.parts.includes("directory")) {
      new DragDrop({
        dragSelector: ".directory-item",
        dropSelector: ".directory-list",
        permissions: {
          dragstart: this._canDragStart.bind(this),
          drop: this._canDragDrop.bind(this),
        },
        callbacks: {
          dragover: this._onDragOver.bind(this),
          dragstart: this._onDragStart.bind(this),
          drop: this._onDrop.bind(this),
        },
      }).bind(this.element)
      this.element
        .querySelectorAll(".directory-item.folder")
        .forEach((folder) => {
          folder.addEventListener("dragenter", this._onDragHighlight.bind(this))
          folder.addEventListener("dragleave", this._onDragHighlight.bind(this))
        })
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const { label, labelPlural } = this.documentClass.metadata
    Object.assign(context, {
      folderIcon: CONFIG.Folder.sidebarIcon,
      label: game.i18n.localize(label),
      labelPlural: game.i18n.localize(labelPlural),
      sidebarIcon: CONFIG[this.documentName].sidebarIcon,
    })
    return context
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    await super._preparePartContext(partId, context, options)
    switch (partId) {
      case "directory":
        await this._prepareDirectoryContext(context, options)
        break
      case "footer":
        await this._prepareFooterContext(context, options)
        break
      case "header":
        await this._prepareHeaderContext(context, options)
        break
    }
    return context
  }

  /* -------------------------------------------- */

  /**
   * Prepare render context for the directory part.
   * @param {ApplicationRenderContext} context
   * @param {HandlebarsRenderOptions} options
   * @returns {Promise<void>}
   * @protected
   */
  async _prepareDirectoryContext(context, options) {
    Object.assign(context, {
      documentCls: this.documentName.toLowerCase(),
      entryPartial: this.constructor._entryPartial,
      folderPartial: this.constructor._folderPartial,
      maxFolderDepth: this.collection.maxFolderDepth,
      tree: this.collection.tree,
    })
  }

  /* -------------------------------------------- */

  /**
   * Prepare render context for the footer part.
   * @param {ApplicationRenderContext} context
   * @param {HandlebarsRenderOptions} options
   * @returns {Promise<void>}
   * @protected
   */
  async _prepareFooterContext(context, options) {
    const plurals = new Intl.PluralRules(game.i18n.lang)
    const unavailable = game.user.isGM
      ? this.collection.invalidDocumentIds.size
      : 0
    context.unavailable = {
      count: unavailable,
      label: game.i18n.format(
        `SUPPORT.UnavailableDocuments.${plurals.select(unavailable)}`,
        {
          count: unavailable,
          document: context.label,
        },
      ),
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare render context for the header part.
   * @param {ApplicationRenderContext} context
   * @param {HandlebarsRenderOptions} options
   * @returns {Promise<void>}
   * @protected
   */
  async _prepareHeaderContext(context, options) {
    Object.assign(context, {
      canCreateEntry: this._canCreateEntry(),
      canCreateFolder: this._canCreateFolder(),
      searchMode:
        this.collection.searchMode === CONST.DIRECTORY_SEARCH_MODES.NAME
          ? { icon: "fas fa-search", label: "SIDEBAR.SearchModeName" }
          : {
              icon: "fas fa-file-magnifying-glass",
              label: "SIDEBAR.SearchModeFull",
            },
      sortMode:
        this.collection.sortingMode === "a"
          ? { icon: "fas fa-arrow-down-a-z", label: "SIDEBAR.SortModeAlpha" }
          : {
              icon: "fas fa-arrow-down-short-wide",
              label: "SIDEBAR.SortModeManual",
            },
    })
    context.searchMode.placeholder = game.i18n.format("SIDEBAR.Search", {
      types: context.labelPlural,
    })
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preRender(context, options) {
    await super._preRender(context, options)
    this.collection.initializeTree()
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state)
    if (partId === "header")
      state.query = priorElement.querySelector("search input").value
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state)
    if (partId === "header" && state.query)
      newElement.querySelector("search input").value = state.query
  }

  /* -------------------------------------------- */
  /*  Public API                                  */
  /* -------------------------------------------- */

  /**
   * Collapse all open folders in this directory.
   */
  collapseAll() {
    for (const el of this.element.querySelectorAll(".directory-item.folder")) {
      el.classList.remove("expanded")
      delete game.folders._expanded[el.dataset.uuid]
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners & Handlers                  */
  /* -------------------------------------------- */

  /**
   * Handle activating a directory entry.
   * @this {DocumentDirectory}
   * @param {...any} args
   * @returns {Promise<void>}
   */
  static #onClickEntry(...args) {
    return this._onClickEntry(...args)
  }

  /* -------------------------------------------- */

  /**
   * Handle activating a directory entry.
   * @param {PointerEvent} event  The triggering click event.
   * @param {HTMLElement} target  The action target element.
   * @param {object} [options]
   * @param {boolean} [options._skipDeprecation] Internal use only.
   * @returns {Promise<void>}
   * @protected
   */
  async _onClickEntry(event, target, { _skipDeprecation = false } = {}) {
    /** @deprecated since v13 */
    if (
      !_skipDeprecation &&
      foundry.utils.getDefiningClass(this, "_onClickEntryName") !==
        DocumentDirectory
    ) {
      foundry.utils.logCompatibilityWarning(
        `${this.constructor.name}#_onClickEntryName is deprecated. ` +
          `Please use ${this.constructor.name}#_onClickEntry instead.`,
        { since: 13, until: 15, once: true },
      )
      return this._onClickEntryName(event)
    }

    event.preventDefault()
    const { entryId } = target.closest("[data-entry-id]").dataset
    const document =
      this.collection.get(entryId) ??
      (await this.collection.getDocument(entryId))
    document.sheet.render(true)
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /**
   * Handle toggling the search mode.
   * @this {DocumentDirectory}
   */
  static #onToggleSearch() {
    this.collection.toggleSearchMode()
    this.render({ parts: ["header"] })
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the sort mode.
   * @this {DocumentDirectory}
   */
  static #onToggleSort() {
    this.collection.toggleSortingMode()
    this.render()
  }

  /* -------------------------------------------- */
  /*  Search & Filter                             */
  /* -------------------------------------------- */

  /**
   * Handle matching a given directory entry with the search filter.
   * @param {string} query          The input search string.
   * @param {Set<string>} entryIds  The matched directory entry IDs.
   * @param {HTMLElement} element   The candidate entry element.
   * @param {object} [options]      Additional options for subclass-specific behavior.
   * @protected
   */
  _onMatchSearchEntry(query, entryIds, element, options = {}) {
    element.style.display =
      !query || entryIds.has(element.dataset.entryId) ? "flex" : "none"
  }

  /* -------------------------------------------- */

  /**
   * Handle directory searching and filtering.
   * @param {KeyboardEvent} event  The keyboard input event.
   * @param {string} query         The input search string.
   * @param {RegExp} rgx           The regular expression query that should be matched against.
   * @param {HTMLElement} html     The container to filter entries from.
   * @protected
   */
  _onSearchFilter(event, query, rgx, html) {
    const entryIds = new Set()
    const folderIds = new Set()
    const autoExpandIds = new Set()
    const options = {}

    // Match entries and folders.
    if (query) {
      // First match folders.
      this._matchSearchFolders(rgx, folderIds, autoExpandIds, options)

      // Next match entries.
      this._matchSearchEntries(rgx, entryIds, folderIds, autoExpandIds, options)
    }

    // Toggle each directory entry.
    for (const el of html.querySelectorAll(".directory-item")) {
      if (el.hidden) continue
      if (el.classList.contains("folder")) {
        const { folderId, uuid } = el.dataset
        const match = folderIds.has(folderId)
        el.style.display = !query || match ? "flex" : "none"
        if (autoExpandIds.has(folderId)) {
          if (query && match) el.classList.add("expanded")
        } else el.classList.toggle("expanded", uuid in game.folders._expanded)
      } else this._onMatchSearchEntry(query, entryIds, el, options)
    }
  }

  /* -------------------------------------------- */

  /**
   * Identify entries in the collection which match a provided search query.
   * @param {RegExp} query               The search query.
   * @param {Set<string>} entryIds       The set of matched entry IDs.
   * @param {Set<string>} folderIds      The set of matched folder IDs.
   * @param {Set<string>} autoExpandIds  The set of folder IDs that should be auto-expanded.
   * @param {object} [options]           Additional options for subclass-specific behavior.
   * @protected
   */
  _matchSearchEntries(query, entryIds, folderIds, autoExpandIds, options = {}) {
    const nameOnlySearch =
      this.collection.searchMode === DIRECTORY_SEARCH_MODES.NAME
    const entries = this.collection.index ?? this.collection.contents

    // Copy the folderIds to a new set, so that we can add to the original set without incorrectly adding child entries.
    const matchedFolderIds = new Set(folderIds)

    for (const entry of entries) {
      const entryId = entry._id

      // If we matched a folder, add its child entries.
      if (matchedFolderIds.has(entry.folder?._id ?? entry.folder))
        entryIds.add(entryId)
      // Otherwise, if we are searching by name, match the entry name.
      else if (
        nameOnlySearch &&
        query.test(SearchFilter.cleanQuery(entry.name))
      ) {
        entryIds.add(entryId)
      }
    }

    if (nameOnlySearch) return

    // Full text search.
    const matches = this.collection.search({
      query: query.source,
      exclude: Array.from(entryIds),
    })
    for (const match of matches) {
      if (entryIds.has(match._id)) continue
      entryIds.add(match._id)
    }
  }

  /* -------------------------------------------- */

  /**
   * Identify folders in the collection which match a provided search query.
   * @param {RegExp} query               The search query.
   * @param {Set<string>} folderIds      The set of matched folder IDs.
   * @param {Set<string>} autoExpandIds  The set of folder IDs that should be auto-expanded.
   * @param {object} [options]           Additional options for subclass-specific behavior.
   * @protected
   */
  _matchSearchFolders(query, folderIds, autoExpandIds, options = {}) {
    for (const folder of this.collection.folders) {
      if (query.test(SearchFilter.cleanQuery(folder.name))) {
      }
    }
  }

  /* -------------------------------------------- */
  /*  Drag & Drop                                 */
  /* -------------------------------------------- */

  /** @override */
  _canDragDrop(selector) {
    return this.documentClass.canUserCreate(game.user)
  }

  /* -------------------------------------------- */

  /** @override */
  _canDragStart(selector) {
    return true
  }

  /* -------------------------------------------- */

  /**
   * Create a new entry in this directory from one that was dropped on it.
   * @param {DirectoryMixinEntry} entry  The dropped entry.
   * @param {object} [updates]           Modifications to the creation data.
   * @returns {Promise<TDocument>}
   * @protected
   */
  _createDroppedEntry(entry, updates = {}) {
    const data = foundry.utils.mergeObject(entry.toObject(), updates, {
      performDeletions: true,
    })
    return this.documentClass.create(data, {
      fromCompendium: entry.inCompendium,
    })
  }

  /* -------------------------------------------- */

  /**
   * Import a dropped folder and its children into this collection if they do not already exist.
   * @param {Folder} folder          The folder being dropped.
   * @param {Folder} [targetFolder]  A folder to import into if not the directory root.
   * @returns {Promise<Folder[]>}
   * @protected
   */
  async _createDroppedFolderContent(folder, targetFolder) {
    const { foldersToCreate, documentsToCreate } =
      await this._organizeDroppedFoldersAndDocuments(folder, targetFolder)

    // Create folders.
    let createdFolders
    try {
      createdFolders = await Folder.implementation.createDocuments(
        foldersToCreate,
        {
          pack: this.collection.collection,
          keepId: true,
        },
      )
    } catch (err) {
      ui.notifications.error(err.message)
      throw err
    }

    // Create documents.
    await this._createDroppedFolderDocuments(folder, documentsToCreate)
    return createdFolders
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /**
   * Get the entry instance from its dropped data.
   * @param {object} data  The drag data.
   * @returns {Promise<ClientDocument>}
   * @throws {Error}       If the correct instance type could not be retrieved.
   * @protected
   */
  _getDroppedEntryFromData(data) {
    return this.documentClass.fromDropData(data)
  }

  /* -------------------------------------------- */

  /**
   * Get drag data for an entry in this directory.
   * @param {string} entryId  The entry's ID.
   * @protected
   */
  _getEntryDragData(entryId) {
    return this.collection.get(entryId).toDragData()
  }

  /* -------------------------------------------- */

  /**
   * Get drag data for a folder in this directory.
   * @param {string} folderId  The folder ID.
   * @protected
   */
  _getFolderDragData(folderId) {
    return this.collection.folders.get(folderId).toDragData()
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping a new entry into this directory.
   * @param {HTMLElement} target  The drop target element.
   * @param {object} data         The drop data.
   * @returns {Promise<void>}
   * @protected
   */
  async _handleDroppedEntry(target, data) {
    const closestFolder = target?.closest(".directory-item.folder")
    closestFolder?.classList.remove("droptarget")
    let folder = await fromUuid(closestFolder?.dataset.uuid)
    let entry = await this._getDroppedEntryFromData(data)
    if (!entry) return

    // Sort relative to another entry.
    const collection = this.collection.index ?? this.collection
    const sortData = { sortKey: "sort" }
    const relativeEntryId = target?.dataset.entryId
    if (relativeEntryId) {
      if (entry.id === relativeEntryId) return // Don't drop on yourself.
      const targetEntry = collection.get(relativeEntryId)
      sortData.target = targetEntry
      folder = targetEntry?.folder
    }

    // Sort within the closest folder.
    else sortData.target = null

    // Determine siblings.
    if (folder instanceof Folder) folder = folder.id
    sortData.siblings = collection.filter(
      (d) => d._id !== entry.id && this._entryBelongsToFolder(d, folder),
    )

    if (!this._entryAlreadyExists(entry)) {
      // Try to predetermine the sort order.
      const sorted = SortingHelpers.performIntegerSort(entry, sortData)
      const updates = { folder: folder || null }
      if (sorted.length === 1) updates.sort = sorted[0].update[sortData.sortKey]
      entry = await this._createDroppedEntry(entry, updates)

      // No need to resort other entries if this one was created with a specific sort order.
      if (sorted.length === 1) return
    }

    // Resort the collection.
    sortData.updateData = { folder: folder || null }
    return entry.sortRelative(sortData)
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping a folder onto the directory.
   * @param {HTMLElement} target  The drop target element.
   * @param {object} data         The drop data.
   * @returns {Promise<void>}
   * @protected
   */
  async _handleDroppedFolder(target, data) {
    let { closestFolderId, folder, sortData, foreign } =
      (await this.constructor._handleDroppedFolder(target, data, {
        folders: this.collection.folders,
        maxFolderDepth: this.collection.maxFolderDepth,
        type: this.documentName,
        label: this.documentClass.metadata.label,
      })) ?? {}

    if (!folder) return

    if (foreign) {
      const dropped = await this._handleDroppedForeignFolder(
        folder,
        closestFolderId,
        sortData,
      )
      if (!dropped?.sortNeeded) return
      folder = dropped.folder
    }

    sortData.updateData = { folder: sortData.parentId }
    return folder.sortRelative(sortData)
  }

  /* -------------------------------------------- */

  /**
   * Handle importing a new folder's into the directory.
   * @param {Folder} folder           The dropped folder.
   * @param {string} closestFolderId  The ID of the closest folder to the drop target.
   * @param {object} sortData         Sort data for the folder.
   * @returns {Promise<{ folder: Folder, sortNeeded: boolean }|null>}
   * @protected
   */
  async _handleDroppedForeignFolder(folder, closestFolderId, sortData) {
    const closestFolder = this.collection.folders.get(closestFolderId)
    const [created] =
      (await this._createDroppedFolderContent(folder, closestFolder)) ?? []
    return created ? { folder: created, sortNeeded: true } : null
  }

  /* -------------------------------------------- */

  /**
   * Highlight folders as drop targets when a drag event enters or exits their area.
   * @param {DragEvent} event  The in-progress drag event.
   * @protected
   */
  _onDragHighlight(event) {
    event.stopPropagation()
    if (event.type === "dragenter") {
      for (const el of this.element.querySelectorAll(".droptarget"))
        el.classList.remove("droptarget")
    }
    if (
      event.type === "dragleave" &&
      event.currentTarget.contains(event.target)
    )
      return
    event.currentTarget.classList.toggle(
      "droptarget",
      event.type === "dragenter",
    )
  }

  /* -------------------------------------------- */

  /**
   * Handle drag events over the directory.
   * @param {DragEvent} event
   * @protected
   */
  _onDragOver(event) {}

  /* -------------------------------------------- */

  /** @override */
  _onDragStart(event) {
    ui.context?.close({ animate: false })
    const { entryId, folderId } = event.currentTarget.dataset
    const dragData = folderId
      ? this._getFolderDragData(folderId)
      : this._getEntryDragData(entryId)
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData))
  }

  /* -------------------------------------------- */

  /** @override */
  _onDrop(event) {
    const data = TextEditor.getDragEventData(event)
    if (!data.type) return
    const target = event.target.closest(".directory-item") ?? null
    if (data.type === "Folder") return this._handleDroppedFolder(target, data)
    else if (data.type === this.documentName)
      return this._handleDroppedEntry(target, data)
  }

  /* -------------------------------------------- */

  /**
   * Organize a dropped folder and its children into a list of folders and documents to create.
   * @param {Folder} folder          The dropped folder.
   * @param {Folder} [targetFolder]  A folder to import into if not the directory root.
   * @returns {Promise<{ foldersToCreate: Folder[], documentsToCreate: TDocument[]|object[] }>}
   * @protected
   */
  _organizeDroppedFoldersAndDocuments(folder, targetFolder) {}

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /**
   * Helper method to handle dropping a folder onto the directory.
   * @param {HTMLElement} target            The drop target element.
   * @param {object} data                   The drop data.
   * @param {object} config
   * @param {Folder[]} config.folders       The sibling folders.
   * @param {string} config.label           The label for entries in the directory.
   * @param {number} config.maxFolderDepth  The maximum folder depth in this directory.
   * @param {string} config.type            The type of entries in the directory.
   * @returns {Promise<{[closestFolderId]: string, folder: Folder, sortData: object, [foreign]: boolean}|void>}
   * @internal
   */
  static async _handleDroppedFolder(
    target,
    data,
    { folders, label, maxFolderDepth, type },
  ) {
    const closestFolder = target?.closest(".directory-item.folder")
    closestFolder?.classList.remove("droptarget")
    const closestFolderId = closestFolder?.dataset.folderId
    const folder = await fromUuid(data.uuid)
    if (!folder) return
    if (folder.type !== type) {
      const typeLabel = game.i18n.localize(label)
      ui.notifications.warn("FOLDER.InvalidDocumentType", {
        format: { type: typeLabel },
      })
      return
    }

    // Sort into another folder.
    const sortData = { sortKey: "sort", sortBefore: true }
    const relativeFolderId = target?.dataset.folderId
    if (relativeFolderId) {
      const targetFolder = await fromUuid(target.dataset.uuid)

      // Drop into an expanded folder.
      if (target.classList.contains("expanded")) {
        Object.assign(sortData, {
          target: null,
          parentId: targetFolder.id,
          parentUuid: targetFolder.uuid,
        })
      }

      // Sort relative to a collapsed folder.
      else {
        Object.assign(sortData, {
          target: targetFolder,
          parentId: targetFolder.folder?.id,
          parentUuid: targetFolder.folder?.uuid,
        })
      }
    }

    // Sort relative to an existing folder's contents.
    else {
      Object.assign(sortData, {
        parentId: closestFolderId,
        parentUuid: closestFolder?.dataset.uuid,
        target:
          closestFolder && !closestFolder.classList.contains("expanded")
            ? closestFolder
            : null,
      })
    }

    if (sortData.parentUuid) {
      const parentFolder = await fromUuid(sortData.parentUuid)
      if (parentFolder === folder) return // Prevent assigning a folder as its own parent.
      if (parentFolder.ancestors.includes(folder)) return // Prevent creating a cycle.
      // Prevent going beyond max depth.
      const maxDepth = (f) =>
        Math.max(
          f.depth,
          ...f.children.filter((n) => n.folder).map((n) => maxDepth(n.folder)),
        )
      if (
        parentFolder.depth + (maxDepth(folder) - folder.depth + 1) >
        maxFolderDepth
      ) {
        ui.notifications.error("FOLDER.ExceededMaxDepth", {
          console: false,
          format: { depth: maxFolderDepth },
        })
        return
      }
    }

    // Determine siblings.
    sortData.siblings = folders.filter((f) => {
      return (
        f.folder?.id === sortData.parentId &&
        f.type === folder.type &&
        f !== folder
      )
    })

    // Handle dropping of some folder that is foreign to this collection.
    if (folders.get(folder.id) !== folder)
      return { closestFolderId, folder, sortData, foreign: true }
    return { folder, sortData }
  }
}
