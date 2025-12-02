/**
 * @file Shared inventory sort and filter modes for actor sheets and container displays.
 */

/**
 * Available sorting modes for inventory displays.
 * Used by both actor sheets and item container sheets.
 */
export const INVENTORY_SORT_MODES = {
  DEFAULT: {
    icon: "fa fa-arrow-up-arrow-down",
    id: 0,
    label: "BAGS.Actors.Common.Inventory.Sort.Default",
  },
  NAME_ASCENDING: {
    icon: "fa fa-arrow-down-a-z",
    id: 1,
    key: "name",
    isDescending: false,
    label: "BAGS.Actors.Common.Inventory.Sort.NameAscending",
  },
  NAME_DESCENDING: {
    icon: "fa fa-arrow-up-z-a",
    id: 2,
    key: "name",
    isDescending: true,
    label: "BAGS.Actors.Common.Inventory.Sort.NameDescending",
  },
  ENCUMBRANCE_ASCENDING: {
    icon: "fa fa-arrow-up-big-small",
    id: 3,
    key: "system.weight",
    isDescending: false,
    label: "BAGS.Actors.Common.Inventory.Sort.EncumbranceAscending",
  },
  ENCUMBRANCE_DESCENDING: {
    icon: "fa fa-arrow-down-big-small",
    id: 4,
    key: "system.weight",
    isDescending: true,
    label: "BAGS.Actors.Common.Inventory.Sort.EncumbranceDescending",
  },
  VALUE_ASCENDING: {
    icon: "fa fa-arrow-up-1-9",
    id: 5,
    key: "system.cost",
    isDescending: false,
    label: "BAGS.Actors.Common.Inventory.Sort.ValueAscending",
  },
  VALUE_DESCENDING: {
    icon: "fa fa-arrow-down-9-1",
    id: 6,
    key: "system.cost",
    isDescending: true,
    label: "BAGS.Actors.Common.Inventory.Sort.ValueDescending",
  },
}

/**
 * Available filter modes for inventory displays.
 * Used by both actor sheets and item container sheets.
 */
export const INVENTORY_FILTER_MODES = {
  DEFAULT: {
    icon: "fa-regular fa-filter",
    id: 0,
    label: "BAGS.Actors.Common.Inventory.Filter.Default",
    predicate: () => true,
  },
  TYPE_WEAPON: {
    icon: "fa fa-sword",
    id: 1,
    label: "BAGS.Actors.Common.Inventory.Filter.Weapons",
    predicate: (i) => i.type === "weapon",
  },
  TYPE_ARMOR: {
    icon: "fa fa-shield",
    id: 2,
    label: "BAGS.Actors.Common.Inventory.Filter.Armor",
    predicate: (i) => i.type === "armor",
  },
  TYPE_MISCELLANEOUS: {
    icon: "fa fa-suitcase",
    id: 3,
    label: "BAGS.Actors.Common.Inventory.Filter.Miscellaneous",
    predicate: (i) => i.type === "item",
  },
  CONTAINER: {
    icon: "fa fa-sack",
    id: 4,
    label: "BAGS.Actors.Common.Inventory.Filter.Containers",
    predicate: (i) => i.system.container.isContainer,
  },
  TREASURE: {
    icon: "fa fa-coin",
    id: 5,
    label: "BAGS.Actors.Common.Inventory.Filter.Treasure",
    predicate: (i) => i.system.countsAsTreasure,
  },
  WORTH_XP: {
    icon: "fa fa-trophy",
    id: 6,
    label: "BAGS.Actors.Common.Inventory.Filter.WorthXP",
    predicate: (i) =>
      i.system.countsAsTreasure && !i.system.hasBeenCountedAsTreasure,
  },
}
