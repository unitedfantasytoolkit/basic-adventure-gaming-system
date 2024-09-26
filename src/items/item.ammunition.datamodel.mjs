/**
 * @file The data model for ammunition -- items that are used to fuel another item's uses.
 */

import PhysicalItemDataMixin from "./item-physical-data-model.mjs"
import { actionsFactory } from "./item.physical.fields.mjs"

export default class BAGSItemAmmunitionDataModel extends PhysicalItemDataMixin({
  actions: actionsFactory(),
}) {}
