/**
 * @file A utility function to filter an object of properties with falsy keys.
 */

const filterFalsyKeyVals = (source) => ({
  ...Object.keys(source)
    .filter((k) => !!source[k])
    .reduce(
      (obj, k) => ({
        ...obj,
        [k]: source[k],
      }),
      {},
    ),
})

export default filterFalsyKeyVals
