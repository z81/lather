export declare class Queue<T> {
    private queue;
    private resolvers;
    private thisResolver;
    add: (value: T) => void;
    clear: () => void;
    private makeResolver;
    [Symbol.asyncIterator](): AsyncGenerator<NonNullable<T>, void, unknown>;
}
