export const Retry = {
  always: () => true,
  times: (count: number) => count-- > 0,
};
