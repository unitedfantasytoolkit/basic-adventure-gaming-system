/**
 * @file A function that sorts Documents.
 */

export default (key = "sort", isDescending = false) =>
  (a, b) => {
    const sortFn = (c, d) => {
      try {
        const x = foundry.utils.getProperty(c, key)
        const y = foundry.utils.getProperty(d, key)
        if (x < y) return -1
        if (x > y) return 1
      } catch {
        /* noop */
      }
      return 0
    }

    return isDescending ? sortFn(b, a) : sortFn(a, b)
  }
