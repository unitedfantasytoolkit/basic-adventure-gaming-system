/**
 * Given a set of IDs, turn them into a list of Items.
 * @param {any} sources - The list of IDs, enriched with the type of storage
 * they represent (local folder vs. compendium)
 * @returns {[TODO:return]} [TODO:description]
 */
const getItemsFromSources = async (
  sources,
  { type = null, sort = true } = {},
) => {
  function filterItemsByType(d) {
    return Array.isArray(type) ? type.includes(d.type) : d.type === type
  }
  const items = await Promise.all(
    sources.map(async ({ id, type: sourceType }) => {
      if (sourceType === "compendium") {
        const documents = (await game.packs.get(id).getDocuments()) || []
        return type ? documents.filter(filterItemsByType) : documents
      }

      return (
        game.folders.get(id).contents.filter((i) => !type || i.type === type) ||
        []
      )
    }),
  )

  const flatItems = items.flat()
  return sort
    ? flatItems.sort((a, b) => a.name.localeCompare(b.name))
    : flatItems
}

export default getItemsFromSources
