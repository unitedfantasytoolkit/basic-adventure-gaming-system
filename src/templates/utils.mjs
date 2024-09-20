export const html = (strings, ...values) =>
  String.raw({ raw: strings }, ...values);
export const css = (strings, ...values) =>
  String.raw({ raw: strings }, ...values);
