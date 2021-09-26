/**
 *
 */
export const flow =
  <T>(value: T) =>
  () =>
    value;

export const delay = (time: number) => new Promise<void>((r) => setTimeout(r, time));
