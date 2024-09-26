/**
 * @file A helper function that makes editors provide syntax highlighting for css.
 */

export const css = (strings, ...values) =>
  String.raw({ raw: strings }, ...values)

export default css
