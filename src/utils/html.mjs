/**
 * @file A helper function that makes editors provide syntax highlighting for HTML.
 */

const html = (strings, ...values) => String.raw({ raw: strings }, ...values)

export default html
