"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = exports.Fail = exports.Result = exports.TimeOutError = void 0;
const callHandled_1 = require("./callHandled");
const taskRuntime_1 = require("./taskRuntime");
class TimeOutError extends Error {
    _tag = 'TimeOutError';
}
exports.TimeOutError = TimeOutError;
class Result {
    value;
    _tag = 'Result';
    constructor(value) {
        this.value = value;
    }
    toString() {
        return `Result: ${this.value}`;
    }
}
exports.Result = Result;
class Fail {
    error;
    constructor(error) {
        this.error = error;
    }
    toString() {
        return `Fail: ${this.error}`;
    }
}
exports.Fail = Fail;
class Task {
    env = {};
    runtime = new taskRuntime_1.TaskRuntime();
    constructor() { }
    // Mutable for performance
    castThis() {
        return this;
    }
    /**
     * Map task value
     * @param fn
     * @returns
     */
    map(fn) {
        this.runtime.then({
            fn,
            name: 'map',
            branch: taskRuntime_1.TaskBranches.Success,
        });
        return this.castThis();
    }
    /**
     * Map task error
     * @param fn
     * @returns
     */
    mapError(fn) {
        this.runtime.then({
            fn: fn,
            name: 'mapError',
            branch: taskRuntime_1.TaskBranches.Fail,
        });
        return this.castThis();
    }
    /**
     * Chain another task
     * @param fn
     * @returns
     */
    chain(fn) {
        this.runtime.then({
            fn: (val) => fn(val).provide(this.env).runUnsafe(),
            name: 'chain',
            branch: taskRuntime_1.TaskBranches.Success,
        });
        return this.castThis();
    }
    /**
     * Map to value
     * @param value
     * @returns
     */
    mapTo(value) {
        this.runtime.then({
            fn: () => value,
            name: 'mapTo',
            branch: taskRuntime_1.TaskBranches.Success,
        });
        return this.castThis();
    }
    /**
     * Tap like forEach
     * @param fn
     * @returns
     */
    tap(fn) {
        this.runtime.then({
            fn: (val) => (0, callHandled_1.callHandled)(() => {
                const res = fn(val);
                return res instanceof Task ? res.provide(this.env).runUnsafe() : res;
            }, [], () => val, (err) => {
                throw err;
            }),
            name: 'tap',
            branch: taskRuntime_1.TaskBranches.Success,
        });
        return this.castThis();
    }
    repeatWhileCond(fn, name, toReject = false) {
        this.runtime.then({
            fn: (val) => {
                let pos = this.runtime.position;
                this.runtime.addHook(taskRuntime_1.Triggers.Cycle, () => {
                    if (this.runtime.position === Infinity && fn(this.runtime.branches[this.runtime.branchId])) {
                        this.runtime.position = toReject ? this.runtime.rejectPosition : pos;
                        this.runtime.rejectPosition = undefined;
                    }
                });
                return val;
            },
            name,
        });
        return this.castThis();
    }
    /**
     * Repeat next functions when(condition function)
     * @param fn
     * @returns
     */
    repeatWhile(fn) {
        return this.repeatWhileCond(fn, 'repeatWhile');
    }
    /**
     *  Repeat next functions @count times
     * @param count
     * @returns
     */
    repeat(count) {
        return this.repeatWhileCond(() => count-- > 0, 'repeat');
    }
    /**
     * Sequence from generator
     * @param fn
     * @returns
     */
    sequenceGen(fn) {
        let gen;
        let next;
        this.runtime.then({
            fn: (val) => {
                if (!gen) {
                    gen = fn(val);
                    next = gen.next();
                }
                let pos = this.runtime.position;
                this.runtime.addHook(taskRuntime_1.Triggers.Cycle, (branchId) => {
                    // @ts-expect-error
                    if (!next.done && branchId === taskRuntime_1.TaskBranches.Success) {
                        return (0, callHandled_1.callHandled)(() => {
                            next = gen.next();
                            return next;
                        }, [], (res) => {
                            if (!res.done) {
                                this.runtime.position = pos;
                                this.runtime.branches[taskRuntime_1.TaskBranches.Success] = res.value;
                            }
                        }, () => { });
                    }
                });
                return next instanceof Promise ? next.then((v) => v.value) : next.value;
            },
            name: 'sequenceGen',
        });
        return this.castThis();
    }
    /**
     * Reduce like native reduce
     * @param fn
     * @param initial
     * @returns
     */
    reduce(fn, initial) {
        this.runtime.then({
            name: 'reduce',
            fn: (item) => {
                initial = fn(initial, item);
                return initial;
            },
        });
        return this.castThis();
    }
    /**
     * repeat next functions if task is failed
     * @param fn
     * @returns
     */
    retryWhile(fn) {
        this.repeatWhileCond(() => {
            if (this.runtime.branchId === taskRuntime_1.TaskBranches.Fail && fn()) {
                this.runtime.branchId = taskRuntime_1.TaskBranches.Success;
                return true;
            }
            return false;
        }, 'retryWhile', true);
        return this;
    }
    timeout(max) {
        this.runtime.then({
            name: 'timeout',
            fn: (v) => {
                const pos = this.runtime.position;
                const time = Date.now();
                this.runtime.addHook(taskRuntime_1.Triggers.Step, () => {
                    if (Date.now() - time >= max) {
                        this.runtime.branches[taskRuntime_1.TaskBranches.Fail] = new TimeOutError(`TimeOutError: ${Date.now() - time} > ${max}`);
                        this.runtime.branchId = taskRuntime_1.TaskBranches.Fail;
                        this.runtime.rejectPosition = pos - 1;
                    }
                });
                return v;
            },
        });
        return this.castThis();
    }
    /**
     * Required dependencies
     * @returns
     */
    access() {
        this.runtime.then({
            name: 'access',
            fn: () => this.env,
            branch: taskRuntime_1.TaskBranches.Success,
        });
        return this.castThis();
    }
    /**
     * Provide dependencies
     * @param env
     * @returns
     */
    provide(env) {
        this.runtime.then({
            name: 'provide',
            fn: (v) => {
                this.env = { ...env, ...this.env };
                return v;
            },
            branch: taskRuntime_1.TaskBranches.Success,
        }, false);
        return this.castThis();
    }
    /**
     * Run task
     * @param _
     * @returns
     */
    runUnsafe(..._) {
        return (0, callHandled_1.callHandled)(() => this.runtime.run(), [], (v) => {
            if (this.runtime.branchId === taskRuntime_1.TaskBranches.Fail) {
                throw v;
            }
            return v;
        }, (err) => {
            throw err;
        });
    }
    /**
     * Run task, return promise or pure value
     * @param _
     * @returns
     */
    run(..._) {
        const mapError = (e) => new Fail(e);
        return (0, callHandled_1.callHandled)(() => this.runtime.run(), [], (v) => {
            if (this.runtime.branchId === taskRuntime_1.TaskBranches.Fail) {
                return mapError(v);
            }
            return new Result(v);
        }, mapError);
    }
    /**
     * Collect elements with predicate
     * @param fn
     * @returns
     */
    collectWhen(fn) {
        const all = [];
        this.runtime.addHook(taskRuntime_1.Triggers.End, () => {
            if (all.length === 0) {
                this.runtime.branches[taskRuntime_1.TaskBranches.Success] = [];
            }
        }, 'collect');
        this.runtime.then({
            name: 'collectWhen',
            fn: (item) => {
                if (fn(item)) {
                    all.push(item);
                }
                return all;
            },
            branch: taskRuntime_1.TaskBranches.Success,
        });
        return this.castThis();
    }
    /**
     * Collect all values to array
     * @returns
     */
    collectAll() {
        return this.collectWhen(() => true);
    }
    /**
     * Run callback after task finished
     * @param handler
     * @returns
     */
    ensure(handler) {
        this.runtime.then({
            name: 'ensure',
            fn: (val) => {
                this.runtime.addHook(taskRuntime_1.Triggers.End, () => handler(val));
                return val;
            },
        });
        return this;
    }
    flat(...error) {
        this.castThis().runtime.then({
            name: 'flat',
            fn: (value) => {
                const pos = this.runtime.position;
                this.runtime.addHook(taskRuntime_1.Triggers.Cycle, () => {
                    if (this.runtime.branchId === taskRuntime_1.TaskBranches.Success && value.length > 0) {
                        this.runtime.branches[taskRuntime_1.TaskBranches.Success] = value.shift();
                        this.runtime.position = pos + 1;
                    }
                });
                return value.shift();
            },
        });
        return this.castThis();
    }
    throttle(time) {
        let enabled = true;
        let endValue = undefined;
        this.runtime.then({
            name: 'throttle',
            fn: (value) => {
                this.runtime.addHook(taskRuntime_1.Triggers.Cycle, () => {
                    endValue = this.runtime.branches[taskRuntime_1.TaskBranches.Success];
                });
                if (enabled) {
                    enabled = false;
                    setTimeout(() => {
                        enabled = true;
                    }, time);
                }
                else {
                    this.runtime.position = this.runtime.callbacks.length - 1;
                    return endValue;
                }
                return value;
            },
        });
        return this.castThis();
    }
    filter(cond) {
        let endValue = undefined;
        this.runtime.then({
            name: 'filter',
            fn: (value) => {
                this.runtime.addHook(taskRuntime_1.Triggers.Cycle, (id, _, val) => {
                    endValue = val;
                });
                if (!cond(value)) {
                    this.runtime.position = this.runtime.callbacks.length - 1;
                    return endValue;
                }
                return value;
            },
        });
        return this.castThis();
    }
    /**
     * delay task on @time ms, change type to async task
     * @param time
     * @returns
     */
    delay(time) {
        this.runtime.then({
            name: 'delay',
            fn: (value) => {
                return new Promise((resolve) => setTimeout(() => resolve(value), time));
            },
        });
        return this.castThis();
    }
    succeed(value) {
        this.runtime.then({
            name: 'succeed',
            fn: () => {
                this.runtime.branchId = taskRuntime_1.TaskBranches.Success;
                return value;
            },
        });
        return this.castThis();
    }
    fail(value) {
        this.runtime.then({
            name: 'fail',
            fn: () => {
                this.runtime.branchId = taskRuntime_1.TaskBranches.Fail;
                this.runtime.branches[taskRuntime_1.TaskBranches.Fail] = value;
                throw value;
            },
        });
        return this.castThis();
    }
    /**
     * Create succeed task from any value
     * @param value
     * @returns
     */
    static succeed(value) {
        return new Task().succeed(value);
    }
    /**
     * Create succeed task from Generator
     * @param fn
     * @returns
     */
    static sequenceFromGen(fn) {
        return new Task().sequenceGen(fn).castThis();
    }
    /**
     * Create succeed task from iterable
     * @param fn
     * @returns
     */
    static sequenceFromIterable(itererable) {
        const iter = itererable; // TODO: FIX
        // | Generator<R, unknown, undefined>
        // | AsyncGenerator<R, unknown, undefined>;
        return Task.empty.sequenceGen(() => (iter[Symbol.iterator] || iter[Symbol.asyncIterator]).call(iter)).castThis();
    }
    static sequenceFromObject(obj) {
        return new Task()
            .succeed()
            .sequenceGen(() => Object.entries(obj)[Symbol.iterator]())
            .castThis();
    }
    structPar(struct) {
        this.runtime.then({
            name: 'structPar',
            fn: async () => {
                return Object.fromEntries(await Promise.all(Object.entries(struct).map(async ([name, task]) => [name, await task.provide(this.env).runUnsafe()])));
            },
        });
        return this.castThis();
    }
    /**
     * Create succeed task from object with task, runs parallel
     * @param fn
     * @returns
     */
    static structPar(struct) {
        return new Task().structPar(struct);
    }
    struct(struct) {
        this.runtime.then({
            name: 'struct',
            fn: () => {
                const obj = {};
                const res = Object.entries(struct).reduce((val, [name, task]) => {
                    if (val instanceof Promise) {
                        return val.then(async () => {
                            obj[name] = await task.runUnsafe();
                        });
                    }
                    const res = task.runUnsafe();
                    if (res instanceof Promise) {
                        return res.then(async () => {
                            obj[name] = await task.runUnsafe();
                        });
                    }
                    obj[name] = res;
                    return res;
                }, {});
                return res instanceof Promise ? res.then(() => obj) : obj;
            },
        });
        return this.castThis();
    }
    fromCallback(fn) {
        this.runtime.then({
            fn: () => new Promise((res) => fn(res)),
            name: 'fromCallback',
            branch: taskRuntime_1.TaskBranches.Success,
        });
        return this.castThis();
    }
    /**
     * Create succeed task from object with task
     * @param struct
     * @returns
     */
    static struct(struct) {
        return new Task().struct(struct);
    }
    /**
     * Create failed task from any value
     * @param err
     * @returns
     */
    static fail(err) {
        return new Task().fail(err);
    }
    static get empty() {
        return new Task().succeed(undefined);
    }
    static fromCallback(fn) {
        return new Task().fromCallback(fn);
    }
}
exports.Task = Task;
