/**
 * @file Creates Item documents from an array of compendium UUIDs.
 * Used primarily during character creation to add starting equipment, abilities,
 * or spells from compendium packs.
 */

/**
 * Fetches items from compendium UUIDs and creates them on a parent actor.
 * This is particularly useful when populating a new character with their class's
 * starting equipment or abilities. The optional transform function allows you to
 * modify item data before creation (like adjusting quantities or equipped status).
 * @param {string[]} uuids - Array of compendium UUIDs (e.g., "Compendium.bags.equipment.sword")
 * @param {Actor} parent - The actor to create the items on
 * @param {Function|null} transformFn - Optional function to modify item data before creation
 * @returns {Promise<Item[]>} The newly created Item documents
 * @example
 * // Create basic items from compendium
 * await createItemsFromUUIDs(
 *   ["Compendium.bags.equipment.sword", "Compendium.bags.equipment.shield"],
 *   actor
 * )
 * 
 * // Create items with transformation
 * await createItemsFromUUIDs(
 *   ["Compendium.bags.equipment.sword"],
 *   actor,
 *   (data) => ({ ...data, system: { ...data.system, equipped: true } })
 * )
 */
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
