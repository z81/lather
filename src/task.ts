import { callHandled } from "./callHandled";
import { TaskBranches, TaskRuntime, Triggers } from "./taskRuntime";

export class TimeOutError extends Error {
  public readonly _tag = "TimeOutError";
}

export class Result<T> {
  public readonly _tag = "Result";

  constructor(public readonly value: T) {}

  toString() {
    return `Result: ${this.value}`;
  }
}

export class Fail<E> {
  constructor(public readonly error: E) {}

  toString() {
    return `Fail: ${this.error}`;
  }
}

type EmptyArray = unknown[] & { length: 0 };

type DiffErr<RE, PD> = {
  [k in keyof RE as k extends keyof PD
    ? PD[k] extends RE[k]
      ? never
      : k
    : k]: {
    Error: "Incorrect dependencies";
    Field: k;
    RequiredValue: RE[k];
    // @ts-expect-error
    ExceptedValue: unknown extends PD[k] ? undefined : PD[k];
  };
};

interface Iterable<T> {
  [Symbol.iterator](): IterableIterator<T>;
}

export class Task<
  T,
  ReqENV extends Object = {},
  ProvEnv extends Object = {},
  Err extends unknown = Error,
  Async extends boolean = false
> {
  protected env: ProvEnv = {} as ProvEnv;
  protected runtime = new TaskRuntime<T>();

  private constructor() {}

  // Mutable for performance
  protected castThis<
    R,
    E = ReqENV,
    P = ProvEnv,
    ER = Err,
    A extends boolean = Async
  >() {
    return this as unknown as Task<
      R extends Promise<infer Z> ? Z : R,
      E,
      P,
      ER,
      R extends Promise<infer Z> ? true : A
    >;
  }

  /**
   * Map task value
   * @param fn
   * @returns
   */
  public map<R>(fn: (value: T) => R) {
    this.runtime.then({
      fn,
      name: "map",
      branch: TaskBranches.Success,
    });

    return this.castThis<R>();
  }

  /**
   * Map task error
   * @param fn
   * @returns
   */
  public mapError<NE>(fn: (value: Err) => NE) {
    this.runtime.then({
      fn: fn as any,
      name: "mapError",
      branch: TaskBranches.Fail,
    });

    return this.castThis<T, ReqENV, ProvEnv, NE>();
  }

  /**
   * Chain another task
   * @param fn
   * @returns
   */
  public chain<
    NT,
    NRE,
    NPE,
    NER,
    A extends boolean,
    NA extends boolean = Async extends true ? true : A
  >(fn: (value: T) => Task<NT, NRE, NPE, NER, A>) {
    this.runtime.then({
      fn: (val: T) => fn(val).provide<any>(this.env).runUnsafe(),
      name: "chain",
      branch: TaskBranches.Success,
    });

    return this.castThis<NT, ReqENV & NRE, ProvEnv & NPE, NER, NA>();
  }

  public tapChain<
    NT,
    NRE,
    NPE,
    NER,
    A extends boolean,
    NA extends boolean = Async extends true ? true : A
  >(fn: (value: T) => Task<NT, NRE, NPE, NER, A>) {
    this.runtime.then({
      fn: (val: T) =>
        callHandled(
          () => fn(val).provide<any>(this.env).runUnsafe(),
          [],
          () => val,
          (err) => {
            throw err;
          }
        ),
      name: "tapChain",
      branch: TaskBranches.Success,
    });

    return this.castThis<T, ReqENV & NRE, ProvEnv & NPE, NER, NA>();
  }

  /**
   * Map to value
   * @param value
   * @returns
   */
  public mapTo<R>(value: R) {
    this.runtime.then({
      fn: () => value,
      name: "mapTo",
      branch: TaskBranches.Success,
    });
    return this.castThis<R>();
  }

  /**
   * Tap like forEach
   * @param fn
   * @returns
   */
  public tap<R>(fn: (value: T) => R) {
    this.runtime.then({
      fn: (val: T) => {
        fn(val);
        return val;
      },
      name: "tap",
      branch: TaskBranches.Success,
    });

    return this.castThis<T>();
  }

  protected repeatWhileCond<U extends (value: T) => boolean>(
    fn: U,
    name: string,
    toReject = false
  ) {
    this.runtime.then({
      fn: (val: T) => {
        let pos = this.runtime.position;
        this.runtime.addHook(Triggers.End, () => {
          if (
            this.runtime.position >= this.runtime.callbacks.length &&
            fn(this.runtime.branches[this.runtime.branchId] as T)
          ) {
            this.runtime.position = toReject
              ? this.runtime.rejectPosition!
              : pos;
            this.runtime.rejectPosition = undefined;
          }
        });
        return val;
      },
      name,
    });

    return this.castThis<T>();
  }

  /**
   * Repeat next functions when(condition function)
   * @param fn
   * @returns
   */
  public repeatWhile<U extends (value: T) => boolean>(fn: U) {
    return this.repeatWhileCond(fn, "repeatWhile");
  }

  /**
   *  Repeat next functions @count times
   * @param count
   * @returns
   */
  public repeat(count: number) {
    return this.repeatWhileCond(() => count-- > 0, "repeat");
  }

  /**
   * Sequence from generator
   * @param fn
   * @returns
   */
  private sequenceGen<R>(fn: (val: T) => Generator<T, unknown, R>) {
    let gen: Generator;
    let next: IteratorResult<unknown, unknown>;
    this.runtime.then({
      fn: (val: T) => {
        if (!gen) {
          gen = fn(val);
          next = gen.next();
        }

        let pos = this.runtime.position;
        this.runtime.addHook(Triggers.End, (branchId) => {
          if (!next.done && branchId === TaskBranches.Success) {
            next = gen.next();

            if (!next.done) {
              this.runtime.position = pos;
              this.runtime.branches[TaskBranches.Success] = next.value;
            }
          }
        });

        return next.value;
      },
      name: "sequenceGen",
    });

    return this.castThis<R>();
  }

  /**
   * Reduce like native reduce
   * @param fn
   * @param initial
   * @returns
   */
  public reduce<R>(fn: (value: T, current: R) => R, initial: R) {
    this.runtime.then({
      name: "reduce",
      fn: (item: T) => {
        initial = fn(item, initial);
        return initial;
      },
    });

    return this.castThis<R>();
  }

  /**
   * repeat next functions if task is failed
   * @param fn
   * @returns
   */
  public retryWhile(fn: () => boolean) {
    this.repeatWhileCond(
      () => {
        if (this.runtime.branchId === TaskBranches.Fail && fn()) {
          this.runtime.branchId = TaskBranches.Success;
          return true;
        }

        return false;
      },
      "retryWhile",
      true
    );

    return this;
  }

  public timeout(max: number) {
    this.runtime.then({
      name: "timeout",
      fn: (v) => {
        const pos = this.runtime.position;
        const time = Date.now();
        this.runtime.addHook(Triggers.Step, () => {
          if (
            // this.runtime.branchId === TaskBranches.Success &&
            Date.now() - time >=
            max
          ) {
            this.runtime.branches[TaskBranches.Fail] = new TimeOutError(
              `TimeOutError: ${Date.now() - time} > ${max}`
            );
            this.runtime.branchId = TaskBranches.Fail;
            this.runtime.rejectPosition = pos - 1;
          }
        });

        return v;
      },
    });

    return this.castThis<T, ReqENV, ProvEnv, Err | TimeOutError>();
  }

  /**
   * Required dependencies
   * @returns
   */
  public access<E>() {
    this.runtime.then({
      name: "access",
      fn: () => this.env,
      branch: TaskBranches.Success,
    });

    return this.castThis<E, E>();
  }

  /**
   * Provide dependencies
   * @param env
   * @returns
   */
  public provide<E extends Partial<ReqENV>>(env: E) {
    this.runtime.then(
      {
        name: "provide",
        fn: (v: T) => {
          this.env = { ...env, ...this.env };
          return v;
        },
        branch: TaskBranches.Success,
      },
      false
    );

    return this.castThis<T, ReqENV, ProvEnv & E>();
  }

  /**
   * Run task
   * @param _
   * @returns
   */
  public runUnsafe<R = Async extends true ? Promise<T> : T>(
    ..._: ProvEnv extends ReqENV
      ? EmptyArray
      : [
          Errors: {
            [k in keyof DiffErr<ReqENV, ProvEnv>]: DiffErr<ReqENV, ProvEnv>[k];
          }
        ]
  ): R {
    return callHandled(
      () => this.runtime.run(),
      [],
      (v) => {
        if (this.runtime.branchId === TaskBranches.Fail) {
          throw v;
        }

        return v;
      },
      (err) => {
        throw err;
      }
    ) as any;
  }

  /**
   * Run task, return promise or pure value
   * @param _
   * @returns
   */
  public run<R = Async extends true ? Promise<T> : Result<T> | Fail<Err>>(
    ..._: ProvEnv extends ReqENV
      ? EmptyArray
      : [
          Errors: {
            [k in keyof DiffErr<ReqENV, ProvEnv>]: DiffErr<ReqENV, ProvEnv>[k];
          }
        ]
  ): R {
    const mapError = <E>(e: E) => new Fail(e);

    return callHandled(
      () => this.runtime.run(),
      [],
      (v) => {
        if (this.runtime.branchId === TaskBranches.Fail) {
          return mapError(v);
        }

        return new Result(v);
      },
      mapError
    ) as any;
  }

  /**
   * Collect elements with predicate
   * @param fn
   * @returns
   */
  public collectWhen(fn: (item: T) => boolean) {
    const all: T[] = [];

    this.runtime.then({
      name: "collectWhen",
      fn: (item: T) => {
        if (fn(item)) {
          all.push(item);
        }

        return all;
      },
      branch: TaskBranches.Success,
    });

    return this.castThis<T[]>();
  }

  /**
   * Collect all values to array
   * @returns
   */
  public collectAll() {
    return this.collectWhen(() => true);
  }

  /**
   * Run callback after task finished
   * @param handler
   * @returns
   */
  public ensure(handler: (value: T) => any) {
    this.runtime.then({
      name: "ensure",
      fn: (val: T) => {
        this.runtime.addHook(Triggers.End, () => handler(val));
        return val;
      },
    });

    return this;
  }

  /**
   * delay task on @time ms, change type to async task
   * @param time
   * @returns
   */
  public delay(time: number) {
    this.runtime.then({
      name: "delay",
      fn: (value: T) => {
        return new Promise<T>((resolve) =>
          setTimeout(() => resolve(value), time)
        );
      },
    });

    return this.castThis<T>();
  }

  protected succeed(value?: T) {
    this.runtime.then({
      name: "succeed",
      fn: () => {
        this.runtime.branchId = TaskBranches.Success;
        return value;
      },
    });

    return this.castThis<T>();
  }

  protected fail<ERR>(value: ERR) {
    this.runtime.then({
      name: "fail",
      fn: () => {
        this.runtime.branchId = TaskBranches.Fail;
        this.runtime.branches[TaskBranches.Fail] = value;
        throw value;
      },
    });

    return this.castThis<Error, {}, {}, ERR, false>();
  }

  /**
   * Create succeed task from any value
   * @param value
   * @returns
   */
  static succeed<T>(value: T) {
    return new Task<T>().succeed(value);
  }

  /**
   * Create succeed task from Generator
   * @param fn
   * @returns
   */
  static sequenceGen<T>(fn: () => Generator<T, void, unknown>) {
    return new Task().sequenceGen(fn).castThis<T>();
  }

  /**
   * Create succeed task from iterable
   * @param fn
   * @returns
   */
  static sequenceFrom<T, R>(iter: Iterable<R>) {
    return new Task()
      .succeed()
      .sequenceGen(() =>
        (iter as Generator<R, unknown, undefined>)[Symbol.iterator]()
      )
      .castThis<R>();
  }

  protected structPar<
    T extends Record<string, Task<unknown>>,
    R extends { [k in keyof T]: T[k] extends Task<infer U> ? U : never }
  >(struct: T) {
    this.runtime.then({
      name: "structPar",
      fn: async () => {
        return Object.fromEntries(
          await Promise.all(
            Object.entries(struct).map(async ([name, task]) => [
              name,
              await task.runUnsafe(),
            ])
          )
        );
      },
    });

    return this.castThis<R>();
  }

  /**
   * Create succeed task from object with task, runs parallel
   * @param fn
   * @returns
   */
  static structPar<T extends Record<string, Task<any>>>(struct: T) {
    return new Task().structPar(struct);
  }

  protected struct<
    T extends Record<string, Task<any>>,
    R extends { [k in keyof T]: T[k] extends Task<infer U> ? U : never }
  >(struct: T) {
    this.runtime.then({
      name: "struct",
      fn: () => {
        const obj: Record<string, T> = {};
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

    return this.castThis<R>();
  }

  public fromCallback<T>(fn: (cb: (value: T) => void) => unknown) {
    this.runtime.then({
      fn: () => new Promise<T>((res) => fn(res)),
      name: "fromCallback",
      branch: TaskBranches.Success,
    });

    return this.castThis<T>();
  }

  /**
   * Create succeed task from object with task
   * @param struct
   * @returns
   */
  static struct<T extends Record<string, Task<any>>>(struct: T) {
    return new Task().struct(struct);
  }

  /**
   * Create failed task from any value
   * @param err
   * @returns
   */
  static fail<ERR>(err: ERR) {
    return new Task().fail(err);
  }

  static get empty() {
    return new Task().succeed(undefined);
  }

  static fromCallback<T>(fn: (cb: (value: T) => void) => unknown) {
    return new Task().fromCallback(fn);
  }
}
