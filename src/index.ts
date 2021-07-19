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

let taskInstancesCount = 0;
export class Task<
  T,
  ReqENV extends Object = {},
  ProvEnv extends Object = {},
  Err extends unknown = undefined,
  Async extends boolean = false
> {
  protected stack: { name: string; fn: Function; branch: TaskBranches; repeat: boolean; restore: boolean }[] = [];
  protected env: ProvEnv = {} as ProvEnv;
  protected branchId = TaskBranches.Success;
  protected branches: [any, any] = [undefined, undefined];
  protected id = taskInstancesCount++;
  protected destroyHandlers: Function[] = [];

  // Mutable for performance
  protected castThis<R, E = ReqENV, P = ProvEnv, ER = Err, A extends boolean = Async>() {
    return this as any as Task<R, E, P, ER, A>;
  }

  protected addStack<F extends Function>(
    name: string,
    fn: F,
    branch = TaskBranches.Success,
    repeat = false,
    restore = false
  ) {
    this.stack.push({ fn, branch, repeat, name, restore });
    return this;
  }

  public map<R, RR = R extends Promise<infer D> ? D : R>(fn: (value: T) => R) {
    const self = this.castThis<RR, ReqENV, ProvEnv, Err, R extends Promise<any> ? true : Async>();
    return self.addStack("map", fn);
  }

  public mapError<NE>(fn: (value: Err) => NE) {
    const self = this.castThis<T, ReqENV, ProvEnv, NE, Async>();
    return self.addStack("mapError", fn, TaskBranches.Fail);
  }

  public chain<NT, NRE, NPE, NER, A extends boolean, NA extends boolean = Async extends true ? true : A>(
    fn: (value: T) => Task<NT, NRE, NPE, NER, A>
  ) {
    const self = this.castThis<NT, ReqENV & NRE, ProvEnv & NPE, NER, NA>();
    return self.addStack("chain", (val: T) => fn(val).provide<any>(self.env).run());
  }

  public mapTo<R>(value: R) {
    return this.map(() => value);
  }

  public tap<R>(fn: (value: T) => R) {
    return this.addStack("tap", (val: T) => {
      fn(val);
      return val;
    });
  }

  public repeatWhile(fn: (value: T) => boolean) {
    return this.addStack("repeatWhile", fn, TaskBranches.Success, true);
  }

  public repeat(count: number) {
    return this.repeatWhile(() => count-- > 0);
  }

  public reduce<R>(fn: (value: T, current: R) => R, initial: R) {
    const self = this.castThis<R>();
    return self.addStack("reduce", (item: T) => {
      initial = fn(item, initial);
      return initial;
    });
  }

  public retryWhile(fn: () => boolean) {
    let count = 0;
    return this.addStack(
      "retryWhile",
      () => (count++ === 0 || this.branchId === TaskBranches.Fail) && fn(),
      TaskBranches.Success,
      true,
      true
    );
  }

  public access<E>() {
    return this.castThis<E, E>().addStack("access", () => this.env);
  }

  public provide<E extends Partial<ReqENV>>(env: E) {
    const self = this.castThis<T, ReqENV, ProvEnv & E>();
    self.env = { ...self.env, ...env };
    return self;
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
          while (item.fn(value)) {
            if (item.restore) {
              prevBranch = this.branchId;
              this.branchId = item.branch;
            }
            this.runPartial(i + 1);
            this.branches[0] = left;
            this.branches[1] = right;
          }
          if (item.restore && start === 0) {
            this.branchId = prevBranch;
          }
          if (item.restore && prevBranch !== TaskBranches.Fail) {
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

  public run<R = Async extends true ? Promise<T> : T | Error>(
    ..._: ProvEnv extends ReqENV
      ? EmptyArray
      : [Errors: { [k in keyof DiffErr<ReqENV, ProvEnv>]: DiffErr<ReqENV, ProvEnv>[k] }]
  ): R {
    this.runPartial();

    const result = this.branches[this.branchId];

    if (this.branchId === TaskBranches.Fail) {
      if (result instanceof Promise) {
        return Promise.reject(0)
          .catch(() => result)
          .finally(() => this.ensureAll()) as any;
      }

      return result instanceof Error ? result : (new Error(result) as any);
    }

    if (result instanceof Promise) {
      return result.finally(() => this.ensureAll()) as any;
    }

    this.ensureAll();

    return result;
  }

  protected ensureAll() {
    this.destroyHandlers.forEach((handler) => handler());
  }

  public ensure(handler: <U>(value: T) => U) {
    this.addStack("ensure", (val: T) => {
      this.destroyHandlers.push(() => handler(val));
      return val;
    });

    return this;
  }

  public sleep(time: number) {
    const self = this.castThis<T, ReqENV, ProvEnv, Err, true>();

    self.addStack("sleep", (value: T) => {
      return new Promise((resolve) => setTimeout(() => resolve(value), time));
    });

    return self;
  }

  protected switchBranch(branch: TaskBranches) {
    return this.tap(() => {
      this.branchId = branch;
    });
  }

  static succeed<T>(value: T) {
    return new Task().switchBranch(TaskBranches.Success).mapTo(value);
  }

  static structPar<
    T extends Record<string, Task<any>>,
    R extends { [k in keyof T]: T[k] extends Task<infer U> ? U : never }
  >(struct: T): Task<R> {
    return new Task().switchBranch(TaskBranches.Success).map(async () => {
      return Object.fromEntries(
        await Promise.all(Object.entries(struct).map(async ([name, task]) => [name, await task.run()]))
      );
    }) as any;
  }

  static fail<ERR>(err: ERR) {
    return new Task<Error, {}, {}, ERR, false>().switchBranch(TaskBranches.Fail).mapError(() => err);
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
