type EmptyArray = unknown[] & { length: 0 };

type DiffErr<RE, PD> = {
  [k in keyof RE as k extends keyof PD ? (PD[k] extends RE[k] ? never : k) : k]: {
    Error: "Incorrect dependencies";
    RequiredValue: RE[k];
    // @ts-expect-error
    ReceivedValue: unknown extends PD[k] ? undefined : PD[k];
  };
};

enum TaskBranches {
  Success,
  Fail,
}

// type TaskStackType = { fn: Function; branch: TaskBranches } | TaskStackType[];

// class TaskStack {
//   private stack: TaskStackType[] = [];

//   public add(fn: Function, branch = TaskBranches.Success) {
//     this.stack.push({ fn, branch });
//     return this;
//   }

//   public addArray(arr: TaskStackType[]) {
//     this.stack.push(arr);
//     return this;
//   }

//   public clear() {
//     this.stack = [];
//     return this;
//   }

//   public *[Symbol.iterator]() {
//     // const self: any = this as any;
//     for (const s of this.stack) {
//       if (s ){}
//       yield s;
//     }
//   }
// }

// const stack = new TaskStack();
// stack
//   .add(() => 1)
//   .add(() => 2)
//   .addArray([
//     {
//       fn: () => 3,
//       branch: TaskBranches.Success,
//     },
//     {
//       fn: () => 4,
//       branch: TaskBranches.Success,
//     },
//   ])
//   .add(() => 5);

// for (const e of stack) {
//   console.log("e", Array.isArray(e));
// }
// class Future<T, E> extends Promise<T> {}

type SomeFunction = (...args: any[]) => any;

let taskInstancesCount = 0;

interface Iterable<T> {
  [Symbol.iterator](): IterableIterator<T>;
}

export class Task<
  T,
  ReqENV extends Object = {},
  ProvEnv extends Object = {},
  Err extends unknown = undefined,
  Async extends boolean = false
> {
  protected stack: {
    name: string;
    fn: Function;
    branch: TaskBranches;
    repeat?: (val: T) => boolean;
    restore: boolean;
    stopMain?: boolean;
  }[] = [];
  protected env: ProvEnv = {} as ProvEnv;
  protected branchId = TaskBranches.Success;
  protected branches: [any, any] = [undefined, undefined];
  protected id = taskInstancesCount++;
  protected destroyHandlers: Function[] = [];

  private constructor() {}

  // Mutable for performance
  protected castThis<R, E = ReqENV, P = ProvEnv, ER = Err, A extends boolean = Async>() {
    return this as any as Task<R, E, P, ER, A>;
  }

  protected addStack<F extends SomeFunction, R extends ReturnType<F>>(
    name: string,
    fn: F,
    branch = TaskBranches.Success,
    repeat: ((val: T) => boolean) | undefined = undefined,
    restore = false,
    stopMain = false
  ) {
    this.stack.push({ fn, branch, repeat, name, restore, stopMain });

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
    return this.addStack("mapError", fn, TaskBranches.Fail).castThis<T, ReqENV, ProvEnv, NE, Async>();
  }

  /**
   * Chain another task
   * @param fn
   * @returns
   */
  public chain<NT, NRE, NPE, NER, A extends boolean, NA extends boolean = Async extends true ? true : A>(
    fn: (value: T) => Task<NT, NRE, NPE, NER, A>
  ) {
    const self = this.castThis<NT, ReqENV & NRE, ProvEnv & NPE, NER, NA>();
    return self.addStack("chain", (val: T) => fn(val).provide<any>(self.env).run());
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
    return this.addStack("repeatWhile", (t) => t, TaskBranches.Success, fn);
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
      "sequenceFrom",
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
      (t) => t,
      TaskBranches.Success,
      () => (count++ === 0 || this.branchId === TaskBranches.Fail) && fn(),
      true,
      true
    ).castThis<T>();
  }

  /**
   * Required dependencies
   * @returns
   */
  public access<E>() {
    return this.addStack("access", () => this.env).castThis<E, E>();
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
        if (item.branch !== this.branchId) {
          continue;
        }

        const value = this.branches[this.branchId];

        if (item.repeat && i + 1 < this.stack.length) {
          const [left, right] = this.branches;

          let prevBranch = this.branchId;
          while (item.repeat(value)) {
            if (item.restore) {
              prevBranch = this.branchId;
              this.branchId = item.branch;
            }

            this.branches[this.branchId] = item.fn(value);
            this.runPartial(i + 1);

            if (!item.stopMain) {
              this.branches[0] = left;
              this.branches[1] = right;
            }
          }
          if (item.restore && start === 0) {
            this.branchId = prevBranch;
          }
          if (item.stopMain) {
            return;
          }
        } else {
          this.branches[this.branchId] = value instanceof Promise ? value.then(item.fn as any) : item.fn(value);
        }
      } catch (e) {
        this.branchId = TaskBranches.Fail;
        this.branches[this.branchId] = e;
      }
    }
  }

  /**
   * Run task, return promise or pure value
   * @param _
   * @returns
   */
  public run<R = Async extends true ? Promise<T> : T | Error>(
    ..._: ProvEnv extends ReqENV
      ? EmptyArray
      : [Errors: { [k in keyof DiffErr<ReqENV, ProvEnv>]: DiffErr<ReqENV, ProvEnv>[k] }]
  ): R {
    this.runPartial();

    let result = this.branches[this.branchId];

    if (result instanceof Promise) {
      result = result.finally(() => {
        this.ensureAll();
      }) as any;
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
  public sleep(time: number) {
    return this.addStack("sleep", (value: T) => {
      return new Promise<T>((resolve) => setTimeout(() => resolve(value), time));
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
    return new Task().switchBranch(TaskBranches.Success).addStack("succeed", () => value);
  }

  /**
   * Create succeed task from Generator
   * @param fn
   * @returns
   */
  static sequenceGen<T>(fn: () => Generator<T, void, any>) {
    return new Task().switchBranch(TaskBranches.Success).sequenceGen(fn).castThis<T>();
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
    return new Task().switchBranch(TaskBranches.Success).addStack("structPar", async () => {
      return Object.fromEntries(
        await Promise.all(Object.entries(struct).map(async ([name, task]) => [name, await task.run()]))
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
    return new Task().switchBranch(TaskBranches.Success).addStack("struct", () => {
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

// const makeEff = <T>(fn: () => T) => {
//   const stack: Function[] = [fn];

//   let eff = {
//     map: <R>(fn: (value: T) => R) => {
//       stack.push(fn);
//       return eff;
//     },

//     tap: <R>(fn: (value: T) => R) => {
//       stack.push((val: T) => {
//         fn(val);
//         return val;
//       });
//       return eff;
//     },

//     run: () => stack.reduce((r, fn) => fn(r), undefined),
//   };

//   return eff;
// };

// const D = {
//   succeed: <T>(value: T) => makeEff(() => value),
// };
// //
// const T = Task; //
// console.log(
//   T.succeed(1)
//     .map((v) => v * 2)
//     .access<{ log: number }>()
//     .map((q) => `@1_env${q.log}`)
//     .provide({ log: 2 })
//     .run()
// );

// console.log(
//   T.succeed(1)
//     .map((v) => v * 2)
//     .map((q) => new Promise<string>((r) => r(`@${q}`)))
//     .map((q) => q)
//     .run()
//     .then((d) => console.log("promise", d))
// );

// console.log(
//   "errr=",
//   T.fail("errr" as const)
//     .mapError((m) => `mapError ${m}`)
//     .map((m) => "mmm")
//     .run()
// );

// T.succeed(1)
//   .map((s) => new Promise<number>((res) => res(1)))
//   .chain(() => T.fail("errr"))
//   .mapError((m) => `mapError ${m}`)
//   .map((m) => "mmm")
//   .run()
//   .catch((err) => {
//     console.error("errr catch xpromise=", err);
//   })
//   .then((err) => {
//     console.error("errr then xpromise=", err);
//   });
// console.log(
//   "chain=",
//   T.succeed(1)
//     .chain((v) => T.succeed(`ch${v}`).map((s) => s.toUpperCase()))
//     .run()
// );
// console.log(
//   "chain acess=",
//   T.succeed(1)
//     .access<{ k: "1" }>()
//     .chain((v) => T.succeed(v).access<{ d: 1 }>())
//     .provide({ d: 1 })
//     .provide({ k: "1" })
//     .run()
// );

// let min = 0;

// const bench = (name: string, fn: (stop: Function) => any) => {
//   let startTime = Date.now();
//   return fn(() => {
//     const d = Date.now() - startTime;
//     if (min === 0) {
//       min = d;
//     }
//     console.log(name, `${d}ms`, `${Math.round((d / min) * 100 - 100)}% slower`);
//   });
// };

// const max = 800_000;

// setTimeout(async () => {
//   //   bench("sync", (stop) => {
//   //     let s = "";

//   //     for (let i = 0; i < max; i++) {
//   //       let a = (a: number) => a * 2;
//   //       let b = (b: number) => b + 1;
//   //       let c = (c: number) => `@${c}`;
//   //       const arr = [a, b, c];
//   //       s += arr.reduce((r, fn: any) => fn(r), 1);
//   //     }
//   //     // console.log(s);
//   //     stop();
//   //   });
//   //

//   bench("efff sync", (stop) => {
//     let s = "";
//     for (let i = 0; i < max; i++) {
//       s = Task.succeed(1)
//         .map((v) => v * 2)
//         .map((v) => v + 1)
//         .access<{ log: number }>()
//         .map((e) => `@+${e.log}`)
//         .provide({ log: 5 })
//         .run();
//     } //

//     console.log(s);
//     stop();
//   });

//   //   await bench("efff", async (stop) => {
//   //     let s = "";
//   //     for (let i = 0; i < max; i++) {
//   //       s = await T.succeed(1)
//   //         .map((v) => v * 2)
//   //         .map((v) => v + 1)
//   //         .access<{ log: number }>()
//   //         .map((e) => new Promise<string>((r) => r(`@+${e.log}`)))
//   //         .provide({ log: 5 })
//   //         .run();
//   //     }

//   //     console.log(s);
//   //     stop();
//   //   });
// }, 1000);

// bench("ddd efff", (stop) => {
//   let s = "";
//   for (let i = 0; i < max; i++) {
//     s += D.succeed(1)
//       .map((v) => v * 2)
//       .map((v) => v + 1)
//       .map((v) => `@${v}`)
//       .run();
//   }
//   // console.log(s);
//   stop();
// });

// bench("promise", async (stop) => {
//   let s = "";
//   for (let i = 0; i < max; i++) {
//     s += await Promise.resolve(1)
//       .then((v) => v * 2)
//       .then((v) => v + 1)
//       .then((v) => `@${v}`);
//   }
//   // console.log(s);
//   stop();
// });

// bench("sync", (stop) => {
//   let s = "";
//   for (let i = 0; i < max; i++) {
//     s += `@${1 * 2 + 1}`;
//   }
//   // console.log(s);
//   stop();
// });
// const sync = () => Math.random();
// bench("sync", (stop) => {
//   let s = 0;
//   for (let i = 0; i < max; i++) {
//     s += sync();
//   }
//   console.log(s);
//   stop();
// });

// const promise = () => new Promise<number>((r) => r(Math.random()));
// bench("promise", async (stop) => {
//   let s = 0;
//   for (let i = 0; i < max; i++) {
//     s += await promise();
//   }
//   console.log(s);
//   stop();
// });

// const micro = (cb: Function) => {
//   queueMicrotask(() => {
//     cb(Math.random());
//   });
// };

// bench("micro", (stop) => {
//   let c = 0;
//   let s = 0;
//   let next = (stop: any) => {
//     micro((v: any) => {
//       s += v;
//       if (++c === max) {
//         stop();
//       } else {
//         next(stop);
//       }
//     });
//   };

//   next(() => {
//     console.log(s);
//     stop();
//   });
// });

// const t = () => new Promise(r => r(Math.random()))

// let s = 0
// for (let i = 0; i < 1000; i++) {
//   s+= t()
// }
