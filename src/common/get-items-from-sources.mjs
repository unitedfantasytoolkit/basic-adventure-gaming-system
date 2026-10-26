/**
 * @file Collect Items from a mixed list of folder and compendium sources.
 */

/**
 * @typedef {object} ItemSource
 * @property {string} id - A Folder ID, or a compendium collection name
 * @property {"folder"|"compendium"} type - Where the Items live
 */

/**
 * Turn a list of sources into a flat list of Items.
 *
 * A source that has gone away -- a deleted folder, or a compendium from a module
 * that's no longer enabled -- is skipped with a warning rather than throwing, so
 * one stale entry in the settings can't empty an entire list.
 * @param {ItemSource[]} sources - The sources to read
 * @param {object} [options] - Filtering options
 * @param {string|string[]|null} [options.type] - Item type(s) to keep; null
 * keeps everything
 * @param {boolean} [options.sort] - Whether to sort the result by name
 * @returns {Promise<Array>} The matching Items
 */
const getItemsFromSources = async (
  sources,
  { type = null, sort = true } = {},
) => {
  const types = type === null ? null : [type].flat()

  /**
   * Whether a Document is one of the requested types.
   * @param {object} document - The Document to check
   * @returns {boolean} True when the Document should be kept
   */
  const isRequestedType = (document) => !types || types.includes(document.type)

  /**
   * Read a single source, returning an empty list if it can't be resolved.
   * @param {ItemSource} source - The source to read
   * @returns {Promise<Array>} The Items from that source
   */
  const readSource = async ({ id, type: sourceType }) => {
    try {
      if (sourceType === "compendium") {
        const pack = game.packs.get(id)
        if (!pack) throw new Error(`No compendium named "${id}"`)

        const documents = (await pack.getDocuments()) || []
        return documents.filter(isRequestedType)
      }

      const folder = game.folders.get(id)
      if (!folder) throw new Error(`No folder with ID "${id}"`)

      return folder.contents.filter(isRequestedType)
    } catch (error) {
      console.warn(
        `BAGS | Skipping unavailable ${sourceType} source "${id}"`,
        error,
      )
      return []
    }
  }

  const items = await Promise.all((sources || []).map(readSource))
  const flatItems = items.flat()

  return sort
    ? flatItems.sort((a, b) => a.name.localeCompare(b.name))
    : flatItems
}

export default getItemsFromSources
