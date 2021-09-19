/**
 *
 */
export const _ =
  <T>(value: T) =>
  () =>
    value;

export const delay = (time: number) => new Promise<void>((r) => setTimeout(r, time));
