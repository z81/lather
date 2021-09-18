export declare const callHandled: <F extends (args: A[]) => T, T, A>(fn: F, args: A[], success: (value: T) => void, error: (error: unknown) => void) => void | Promise<void>;
