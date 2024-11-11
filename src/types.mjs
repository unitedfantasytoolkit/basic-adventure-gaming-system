/**
 * @file Types for the project.
 */

/**
 * A navigation item for a Sheet application.
 * @typedef SheetNavTab
 * @property {string} id - The tab's ID. This string should match its
 * corresponding template name.
 * @property {string} group - The tab group this tab is part of. For top level
 * tabs, this should be `sheet`.
 * @property {string} icon - The FontAwesome CSS classes to use for the tab UI.
 * @property {string} label - i18n-friendly text string to be displayed on
 * hover of a tab. Also serves as the tab's `aria-label`.
 * @property {string} cssClass - CSS classes to be applied to the tab element.
 * This should typically follow BEM syntax (example: `tab--description`)
 * @property {boolean} [active=false] - Is this the active tab in its group?
 * Note: *do not set this manually*. The sheet should manage it.
 * @example A typical tab.
 * ```
 * {
 *   id: "summary",
 *   group: "sheet",
 *   icon: "fa-solid fa-square-list",
 *   label: "BAGS.CharacterClass.Tabs.Summary",
 *   cssClass: "tab--summary",
 * }
 * ```
 */
