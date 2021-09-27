import { TaskRuntime } from './taskRuntime';
export declare class TimeOutError extends Error {
    readonly _tag = "TimeOutError";
}
export declare class Result<T> {
    readonly value: T;
    readonly _tag = "Result";
    constructor(value: T);
    toString(): string;
}
export declare class Fail<E> {
    readonly error: E;
    constructor(error: E);
    toString(): string;
}
declare type ArrayReturnGuard<T> = T extends (infer Z)[] ? [] : [
    {
        Error: 'TypeError: Works only with Array';
    }
];
declare type EmptyArray = unknown[] & {
    length: 0;
};
declare type DiffErr<RE, PD> = {
    [k in keyof RE as k extends keyof PD ? (PD[k] extends RE[k] ? never : k) : k]: {
        Error: 'Incorrect dependencies';
        Field: k;
        RequiredValue: RE[k];
        ExceptedValue: unknown extends PD[k] ? undefined : PD[k];
    };
};
declare type TaskValue<T extends Object> = {
    [k in keyof T]: T[k] extends Task<infer U, any, any, any, any> ? U : never;
};
declare type TaskReqEnv<T extends Object> = {
    [k in keyof T]: T[k] extends Task<any, infer U, any, any, any> ? U : never;
}[keyof T];
declare type TaskProvEnv<T extends Object> = {
    [k in keyof T]: T[k] extends Task<any, any, infer U> ? U : never;
}[keyof T];
declare type TaskError<T extends Object> = {
    [k in keyof T]: T[k] extends Task<any, any, any, infer U> ? U : never;
}[keyof T];
declare type TaskAsync<T extends Object> = {
    [k in keyof T]: T[k] extends Task<any, any, any, any, infer U> ? U : never;
}[keyof T];
interface Iterable<T> {
    [Symbol.iterator](): IterableIterator<T>;
}
interface AsyncIterable<T> {
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}
export declare class Task<T, ReqENV extends Object = {}, ProvEnv extends Object = {}, Err extends unknown = Error, Async extends boolean = false> {
    protected env: ProvEnv;
    protected runtime: TaskRuntime<T>;
    private constructor();
    protected castThis<R, E = ReqENV, P = ProvEnv, ER = Err, A extends boolean = Async>(): Task<R extends Promise<infer Z> ? Z : R, E, P, ER, R extends Promise<infer Z_1> ? true : A>;
    /**
     * Map task value
     * @param fn
     * @returns
     */
    map<R>(fn: (value: T) => R): Task<R extends Promise<infer Z> ? Z : R, ReqENV, ProvEnv, Err, R extends Promise<infer Z_1> ? true : Async>;
    /**
     * Map task error
     * @param fn
     * @returns
     */
    mapError<NE>(fn: (value: Err) => NE): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, NE, T extends Promise<infer Z_1> ? true : Async>;
    /**
     * Chain another task
     * @param fn
     * @returns
     */
    chain<NT, NRE, NPE, NER, A extends boolean, NA extends boolean = Async extends true ? true : A>(fn: (value: T) => Task<NT, NRE, NPE, NER, A>): Task<NT extends Promise<infer Z> ? Z : NT, ReqENV & NRE, ProvEnv & NPE, NER, NT extends Promise<infer Z_1> ? true : NA>;
    /**
     * Map to value
     * @param value
     * @returns
     */
    mapTo<R>(value: R): Task<R extends Promise<infer Z> ? Z : R, ReqENV, ProvEnv, Err, R extends Promise<infer Z_1> ? true : Async>;
    /**
     * Tap like forEach
     * @param fn
     * @returns
     */
    tap<R, NT, NRE, NPE, NER = Err, A extends boolean = Async, NA extends boolean = Async extends true ? true : A>(fn: (value: T) => R | Task<NT, NRE, NPE, NER, A>): Task<T extends Promise<infer Z> ? Z : T, NA extends never ? ReqENV : ReqENV & NRE, NA extends never ? ProvEnv : ProvEnv & NPE, NA extends never ? Err : NER, T extends Promise<infer Z_1> ? true : NA extends never ? Async : NA>;
    protected repeatWhileCond<U extends (value: T) => boolean>(fn: U, name: string, toReject?: boolean): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, Err, T extends Promise<infer Z_1> ? true : Async>;
    /**
     * Repeat next functions when(condition function)
     * @param fn
     * @returns
     */
    repeatWhile<U extends (value: T) => boolean>(fn: U): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, Err, T extends Promise<infer Z_1> ? true : Async>;
    restoreWhen(fn: (e: Err) => boolean): this;
    /**
     *  Repeat next functions @count times
     * @param count
     * @returns
     */
    repeat(count: number): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, Err, T extends Promise<infer Z_1> ? true : Async>;
    /**
     * Sequence from generator
     * @param fn
     * @returns
     */
    private sequenceGen;
    /**
     * Reduce like native reduce
     * @param fn
     * @param initial
     * @returns
     */
    reduce<R>(fn: (current: R, value: T) => R, initial: R): Task<R extends Promise<infer Z> ? Z : R, ReqENV, ProvEnv, Err, R extends Promise<infer Z_1> ? true : Async>;
    /**
     * repeat next functions if task is failed
     * @param fn
     * @returns
     */
    retryWhile(fn: () => boolean): this;
    timeout(max: number): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, TimeOutError | Err, T extends Promise<infer Z_1> ? true : Async>;
    /**
     * Required dependencies
     * @returns
     */
    access<E>(): Task<E extends Promise<infer Z> ? Z : E, E, ProvEnv, Err, E extends Promise<infer Z_1> ? true : Async>;
    /**
     * Provide dependencies
     * @param env
     * @returns
     */
    provide<E extends Partial<ReqENV>>(env: E): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv & E, Err, T extends Promise<infer Z_1> ? true : Async>;
    /**
     * Run task
     * @param _
     * @returns
     */
    runUnsafe<R = Async extends true ? Promise<T> : T>(..._: ProvEnv extends ReqENV ? EmptyArray : [
        Errors: {
            [k in keyof DiffErr<ReqENV, ProvEnv>]: DiffErr<ReqENV, ProvEnv>[k];
        }
    ]): R;
    /**
     * Run task, return promise or pure value
     * @param _
     * @returns
     */
    run<R = Async extends true ? Promise<T> : Result<T> | Fail<Err>>(..._: ProvEnv extends ReqENV ? EmptyArray : [
        Errors: {
            [k in keyof DiffErr<ReqENV, ProvEnv>]: DiffErr<ReqENV, ProvEnv>[k];
        }
    ]): R;
    /**
     * Collect elements with predicate
     * @param fn
     * @returns
     */
    collectWhen(fn: (item: T) => boolean): Task<T[], ReqENV, ProvEnv, Err, Async>;
    /**
     * Collect all values to array
     * @returns
     */
    collectAll(): Task<T[], ReqENV, ProvEnv, Err, Async>;
    /**
     * Run callback after task finished
     * @param handler
     * @returns
     */
    ensure(handler: (value: T) => any): this;
    flat<R extends T extends (infer Z)[] ? Z : never>(...error: ArrayReturnGuard<T>): Task<R extends Promise<infer Z> ? Z : R, ReqENV, ProvEnv, Err, R extends Promise<infer Z_1> ? true : Async>;
    throttle(time: number): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, Err, T extends Promise<infer Z_1> ? true : Async>;
    filter(cond: (val: T) => boolean): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, Err, T extends Promise<infer Z_1> ? true : Async>;
    /**
     * delay task on @time ms, change type to async task
     * @param time
     * @returns
     */
    delay(time: number): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, Err, T extends Promise<infer Z_1> ? true : Async>;
    protected succeed(value?: T): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, Err, T extends Promise<infer Z_1> ? true : Async>;
    protected fail<ERR>(value: ERR): Task<Error, {}, {}, ERR, false>;
    /**
     * Create succeed task from any value
     * @param value
     * @returns
     */
    static succeed<T>(value: T): Task<T extends Promise<infer Z> ? Z : T, {}, {}, Error, T extends Promise<infer Z_1> ? true : false>;
    /**
     * Create succeed task from Generator
     * @param fn
     * @returns
     */
    static sequenceFromGen<T>(fn: () => Generator<T, void, unknown> | AsyncGenerator<T, void, unknown>): Task<T extends Promise<infer Z> ? Z : T, {}, {}, Error, T extends Promise<infer Z_1> ? true : false>;
    /**
     * Create succeed task from iterable
     * @param fn
     * @returns
     */
    static sequenceFromIterable<R>(itererable: Iterable<R> | AsyncIterable<R>): Task<R extends Promise<infer Z> ? Z : R, {}, {}, Error, R extends Promise<infer Z_1> ? true : false>;
    static sequenceFromObject<T extends Object, R extends {
        [k in keyof T]: [k, T[k]];
    }[keyof T]>(obj: T): Task<R extends Promise<infer Z> ? Z : R, {}, {}, Error, R extends Promise<infer Z_1> ? true : false>;
    structPar<T extends Record<string, Task<any, any>>, R extends TaskValue<T>, RENV extends TaskReqEnv<T>, PENV extends TaskProvEnv<T>, Err extends TaskError<T>, A extends TaskAsync<T>>(struct: T): Task<R extends Promise<infer Z> ? Z : R, RENV, PENV, Err, R extends Promise<infer Z_1> ? true : A>;
    /**
     * Create succeed task from object with task, runs parallel
     * @param fn
     * @returns
     */
    static structPar<T extends Record<string, Task<any, any>>, R extends TaskValue<T>, RENV extends TaskReqEnv<T>, PENV extends TaskProvEnv<T>, Err extends TaskError<T>, A extends TaskAsync<T>>(struct: T): Task<TaskValue<T> extends Promise<infer Z> ? Z : TaskValue<T>, TaskReqEnv<T>, TaskProvEnv<T>, TaskError<T>, TaskValue<T> extends Promise<infer Z_1> ? true : TaskAsync<T>>;
    protected struct<T extends Record<string, Task<any, any>>, R extends TaskValue<T>, RENV extends TaskReqEnv<T>, PENV extends TaskProvEnv<T>, Err extends TaskError<T>, A extends TaskAsync<T>>(struct: T): Task<R extends Promise<infer Z> ? Z : R, RENV, PENV, Err, R extends Promise<infer Z_1> ? true : A>;
    fromCallback<T>(fn: (cb: (value: T) => void) => unknown): Task<T extends Promise<infer Z> ? Z : T, ReqENV, ProvEnv, Err, T extends Promise<infer Z_1> ? true : true>;
    /**
     * Create succeed task from object with task
     * @param struct
     * @returns
     */
    static struct<T extends Record<string, Task<any, any>>, R extends TaskValue<T>, RENV extends TaskReqEnv<T>, PENV extends TaskProvEnv<T>, Err extends TaskError<T>, A extends TaskAsync<T>>(struct: T): Task<TaskValue<T> extends Promise<infer Z> ? Z : TaskValue<T>, TaskReqEnv<T>, TaskProvEnv<T>, TaskError<T>, TaskValue<T> extends Promise<infer Z_1> ? true : TaskAsync<T>>;
    /**
     * Create failed task from any value
     * @param err
     * @returns
     */
    static fail<ERR>(err: ERR): Task<Error, {}, {}, ERR, false>;
    static get empty(): Task<unknown, {}, {}, Error, false>;
    static fromCallback<T>(fn: (cb: (value: T) => void) => unknown): Task<T extends Promise<infer Z> ? Z : T, {}, {}, Error, T extends Promise<infer Z_1> ? true : true>;
}
export {};
