const createItemsFromUUIDs = async (uuids, parent, transformFn = null) => {
  const items = await Promise.all(
    uuids.map(async (uuid) => {
      const source = await fromUuid(uuid)
      const data = {
        name: source.name,
        type: source.type,
        img: source.img,
        system: source.system,
      }
      return transformFn ? transformFn(data) : data
    }),
  )

  return Item.implementation.createDocuments(items, { parent })
}

export default createItemsFromUUIDs
