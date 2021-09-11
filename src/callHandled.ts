export const callHandled = <F extends (args: A[]) => T, T, A>(
  fn: F,
  args: A[],
  success: (value: T) => void,
  error: (error: unknown) => void
) => {
  try {
    // @ts-expect-error
    const value = fn(...args);

    return value instanceof Promise
      ? value.then(success).catch(error)
      : success(value);
  } catch (e) {
    return error(e);
  }
};
