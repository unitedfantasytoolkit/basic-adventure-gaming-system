/**
 * @file A function that sorts Documents.
 */
/**
 * A function to be passed into `Array.sort()` that sorts Documents.
 * @param {{sort: number}} a - The first Documenr in the comparison
 * @param {{sort: number}} b - The second Documenr in the comparison
 * @returns {number} Whether or not the item goes before, after, or alongside
 * the compared item.
 */
export default (a, b) => {
  if (a.sort < b.sort) return -1
  if (a.sort > b.sort) return 1
  return 0
}
