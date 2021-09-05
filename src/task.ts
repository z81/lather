export class TimeOutError extends Error {
  public readonly _tag = "TimeOutError";
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

enum TaskBranches {
  Success,
  Fail,
}

type SomeFunction = (...args: any[]) => any;

const identity = <T>(t: T) => t;

let taskInstancesCount = 0;

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
  protected stack: {
    name: string;
    fn: Function;
    branch?: TaskBranches;
    repeat?: (val: T) => boolean;
    restore: boolean;
    stop?: boolean;
  }[] = [];
  protected env: ProvEnv = {} as ProvEnv;
  protected branchId = TaskBranches.Success;
  protected branches: [any, any] = [undefined, undefined];
  protected id = taskInstancesCount++;
  protected destroyHandlers: Function[] = [];
  protected rejectMain?: (reason?: any) => void;
  protected isKilled = false;

  private constructor() {}

  // Mutable for performance
  protected castThis<
    R,
    E = ReqENV,
    P = ProvEnv,
    ER = Err,
    A extends boolean = Async
  >() {
    return this as any as Task<R, E, P, ER, A>;
  }

  protected addStack<F extends SomeFunction, R extends ReturnType<F>>(
    name: string,
    fn: F,
    branch = TaskBranches.Success,
    repeat: ((val: T) => boolean) | undefined = undefined,
    restore = false,
    stop = false
  ) {
    this.stack.push({
      fn,
      branch,
      repeat,
      name,
      restore,
      stop,
    });

    return this.castThis<
      R extends Promise<infer P> ? P : R,
      ReqENV,
      ProvEnv,
      Err,
      R extends Promise<infer P> ? true : Async
    >();
  }

  /**
   * Map task value
   * @param fn
   * @returns
   */
  public map<R>(fn: (value: T) => R) {
    return this.addStack("map", fn);
  }

  /**
   * Map task error
   * @param fn
   * @returns
   */
  public mapError<NE>(fn: (value: Err) => NE) {
    return this.addStack("mapError", fn, TaskBranches.Fail).castThis<
      T,
      ReqENV,
      ProvEnv,
      NE,
      Async
    >();
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
    return this.addStack("chain", (val: T) =>
      fn(val).provide<any>(this.env).run()
    ).castThis<NT, ReqENV & NRE, ProvEnv & NPE, NER, NA>();
  }

  /**
   * Map to value
   * @param value
   * @returns
   */
  public mapTo<R>(value: R) {
    return this.addStack("mapTo", () => value);
  }

  /**
   * Tap like forEach
   * @param fn
   * @returns
   */
  public tap<R>(fn: (value: T) => R) {
    return this.addStack("tap", (val: T) => {
      fn(val);
      return val;
    });
  }

  /**
   * Repeat next functions when(condition function)
   * @param fn
   * @returns
   */
  public repeatWhile<U extends (value: T) => boolean>(fn: U) {
    return this.addStack(
      "repeatWhile",
      identity,
      TaskBranches.Success,
      fn
    ).castThis<T>();
  }

  /**
   *  Repeat next functions @count times
   * @param count
   * @returns
   */
  public repeat(count: number) {
    return this.addStack(
      "repeat",
      (t) => t,
      TaskBranches.Success,
      () => count-- > 0
    );
  }

  /**
   * Sequence from generator
   * @param fn
   * @returns
   */
  private sequenceGen(fn: <R>(val: T) => Generator<T, unknown, R>) {
    let gen: Generator;
    let next: IteratorResult<unknown, any>;

    return this.addStack(
      "sequenceGen",
      (value: T) => {
        if (!gen) {
          gen = fn(value);
          next = gen.next();
        }

        const val = next.value;
        next = gen.next();

        return val;
      },
      TaskBranches.Success,
      () => !next?.done,
      false,
      true
    ).castThis<T>();
  }

  /**
   * Reduce like native reduce
   * @param fn
   * @param initial
   * @returns
   */
  public reduce<R>(fn: (value: T, current: R) => R, initial: R) {
    return this.addStack("reduce", (item: T) => {
      initial = fn(item, initial);
      return initial;
    });
  }

  /**
   * repeat next functions if task is failed
   * @param fn
   * @returns
   */
  public retryWhile(fn: () => boolean) {
    let count = 0;
    return this.addStack(
      "retryWhile",
      identity,
      undefined,
      () => (count++ === 0 || this.branchId === TaskBranches.Fail) && fn(),
      true,
      true
    ).castThis<T>();
  }

  public timeout(time: number) {
    this.addStack("timeout", (val: T) => {
      const timeoutId = setTimeout(() => this.kill(new TimeOutError()), time);
      this.destroyHandlers.push(() => clearTimeout(timeoutId));
      return val;
    });
    return this.castThis<T, ReqENV, ProvEnv, Err | TimeOutError>();
  }

  protected kill(reason: Error) {
    this.branches[TaskBranches.Fail] = reason;
    this.branchId = TaskBranches.Fail;
    this.isKilled = true;
    this.rejectMain?.(reason);
  }

  /**
   * Required dependencies
   * @returns
   */
  public access<E>() {
    return this.addStack("access", () => this.env).castThis<
      E & ReqENV,
      E & ReqENV
    >();
  }

  /**
   * Provide dependencies
   * @param env
   * @returns
   */
  public provide<E extends Partial<ReqENV>>(env: E) {
    this.stack.unshift({
      name: "provide",
      fn: (v: T) => {
        this.env = { ...this.env, ...env };
        return v;
      },
      branch: TaskBranches.Success,
      restore: false,
    });
    return this.castThis<T, ReqENV, ProvEnv & E>();
  }

  private runPartial(start = 0) {
    for (let i = start; i < this.stack.length; i++) {
      const item = this.stack[i];

      try {
        if (item.branch !== undefined && item.branch !== this.branchId) {
          continue;
        }

        const value = this.branches[this.branchId];

        if (item.repeat && i + 1 < this.stack.length) {
          const [left, right] = this.branches;

          let prevBranch = this.branchId;

          const r = (): any => {
            const isRepeat = item.repeat?.(value) ?? false;
            if (!isRepeat) {
              if (item.restore && start === 0) {
                this.branchId = prevBranch;
              }
              // if (item.stop) {
              //   return this.branches[this.branchId];
              // }

              return this.branches[this.branchId];
            }

            if (item.restore) {
              prevBranch = this.branchId;
              this.branchId = item.branch ?? this.branchId;
            }

            this.branches[this.branchId] = item.fn(value);

            const res: any = this.runPartial(i + 1);

            if (!item.stop) {
              this.branches[0] = left;
              this.branches[1] = right;
            }

            if (res instanceof Promise) {
              return res
                .then((v) => {
                  return r();
                })
                .catch((e) => {
                  return r();
                });
            } else {
              return r();
            }
          };

          return r();

          // while (item.repeat(value)) {
          //   if (item.restore) {
          //     prevBranch = this.branchId;
          //     this.branchId = item.branch;
          //   }

          //   this.branches[this.branchId] = item.fn(value);

          //   this.runPartial(i + 1);

          //   if (!item.stop) {
          //     this.branches[0] = left;
          //     this.branches[1] = right;
          //   }
          // }
          // if (item.restore && start === 0) {
          //   this.branchId = prevBranch;
          // }
          // if (item.stop) {
          //   return this.branches[this.branchId];
          // }
        } else {
          this.branches[this.branchId] =
            value instanceof Promise
              ? value.then(item.fn as any)
              : item.fn(value);

          if (this.branches[this.branchId] instanceof Promise) {
            this.branches[this.branchId] = this.branches[this.branchId].then(
              (d: any) => {
                this.branches[this.branchId] = d;
                return this.runPartial(i + 1);
              },
              (err: any) => {
                this.branchId = TaskBranches.Fail;
                this.branches[this.branchId] = err;

                const t = this.runPartial(i + 1);
                return t instanceof Promise ? t : this.branches[this.branchId];
              }
            );

            return this.branches[this.branchId];
          }
        }
      } catch (e) {
        this.branchId = TaskBranches.Fail;
        this.branches[this.branchId] = e;
      }
    }

    return this.branches[this.branchId];
  }

  /**
   * Run task, return promise or pure value
   * @param _
   * @returns
   */
  public run<R = Async extends true ? Promise<T> : T | Err>(
    ..._: ProvEnv extends ReqENV
      ? EmptyArray
      : [
          Errors: {
            [k in keyof DiffErr<ReqENV, ProvEnv>]: DiffErr<ReqENV, ProvEnv>[k];
          }
        ]
  ): R {
    const q = this.runPartial();

    let result = this.branches[this.branchId];

    // result
    //   .then((d) => console.log("res then", d))
    //   .catch((err) => console.log("res catch", err));
    // console.log("res", result);

    if (result instanceof Promise) {
      let r = result;
      result = new Promise((res, rej) => {
        r.then((r) => {
          if (this.branchId === TaskBranches.Fail) {
            rej(r);
          } else {
            res(r);
          }
        }).catch(rej);

        this.rejectMain = rej;
      })
        // .catch((e) => e)
        .finally(() => {
          this.ensureAll();
        });
    } else {
      this.ensureAll();
    }

    if (this.branchId === TaskBranches.Fail) {
      if (result instanceof Promise) {
        return Promise.reject(0).catch(() => result) as any;
      }

      return result instanceof Error ? result : (new Error(result) as any);
    }

    return result;
  }

  /**
   * Collect elements with predicate
   * @param fn
   * @returns
   */
  public collectWhen(fn: (item: T) => boolean) {
    const all: T[] = [];
    return this.addStack("collectWhen", (item: T) => {
      if (fn(item)) {
        all.push(item);
      }

      return all;
    });
  }

  /**
   * Collect all values to array
   * @returns
   */
  public collectAll() {
    return this.collectWhen(() => true);
  }

  protected ensureAll() {
    this.destroyHandlers.forEach((handler) => handler());
  }

  /**
   * Run callback after task finished
   * @param handler
   * @returns
   */
  public ensure(handler: <U>(value: T) => U) {
    this.addStack("ensure", (val: T) => {
      this.destroyHandlers.push(() => handler(val));
      return val;
    });

    return this;
  }

  /**
   * delay task on @time ms, change type to async task
   * @param time
   * @returns
   */
  public delay(time: number) {
    return this.addStack("delay", (value: T) => {
      return new Promise<T>((resolve) =>
        setTimeout(() => resolve(value), time)
      );
    });
  }

  protected switchBranch(branch: TaskBranches) {
    return this.addStack("", (val: T) => {
      this.branchId = branch;
      return val;
    });
  }

  /**
   * Create succeed task from any value
   * @param value
   * @returns
   */
  static succeed<T>(value: T) {
    return new Task()
      .switchBranch(TaskBranches.Success)
      .addStack("succeed", () => value);
  }

  /**
   * Create succeed task from Generator
   * @param fn
   * @returns
   */
  static sequenceGen<T>(fn: () => Generator<T, void, any>) {
    return new Task()
      .switchBranch(TaskBranches.Success)
      .sequenceGen(fn)
      .castThis<T>();
  }

  /**
   * Create succeed task from iterable
   * @param fn
   * @returns
   */
  static sequenceFrom<T, R>(iter: Iterable<R>) {
    return new Task()
      .switchBranch(TaskBranches.Success)
      .sequenceGen(() => (iter as any)[Symbol.iterator]())
      .castThis<R>();
  }

  /**
   * Create succeed task from object with task, runs parallel
   * @param fn
   * @returns
   */
  static structPar<
    T extends Record<string, Task<any>>,
    R extends { [k in keyof T]: T[k] extends Task<infer U> ? U : never }
  >(struct: T): Task<R> {
    return new Task()
      .switchBranch(TaskBranches.Success)
      .addStack("structPar", async () => {
        return Object.fromEntries(
          await Promise.all(
            Object.entries(struct).map(async ([name, task]) => [
              name,
              await task.run(),
            ])
          )
        );
      });
  }

  /**
   * Create succeed task from object with task
   * @param struct
   * @returns
   */
  static struct<
    T extends Record<string, Task<any>>,
    R extends { [k in keyof T]: T[k] extends Task<infer U> ? U : never }
  >(struct: T): Task<R> {
    return new Task()
      .switchBranch(TaskBranches.Success)
      .addStack("struct", () => {
        const obj: Record<string, T> = {};
        const res = Object.entries(struct).reduce((val, [name, task]) => {
          if (val instanceof Promise) {
            return val.then(async () => {
              obj[name] = await task.run();
            });
          }

          const res = task.run();

          if (res instanceof Promise) {
            return res.then(async () => {
              obj[name] = await task.run();
            });
          }

          obj[name] = res;
          return res;
        }, {});
        return res instanceof Promise ? (res.then(() => obj) as any) : obj;
      }) as any;
  }

  /**
   * Create failed task from any value
   * @param err
   * @returns
   */
  static fail<ERR>(err: ERR) {
    return new Task()
      .switchBranch(TaskBranches.Fail)
      .addStack("fail", () => err, TaskBranches.Fail)
      .castThis<Error, {}, {}, ERR, false>();
  }
}
