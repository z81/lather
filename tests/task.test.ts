import { Task } from "../src/task";
import { makeTestRunner } from "./configure";

const makeTest = makeTestRunner(__filename);

makeTest(
  () => Task.succeed(3).runPromise(),
  (r) => r.toBe(3)
);

makeTest(
  () =>
    Task.succeed(3)
      .map((a) => a * 2)
      .runPromise(),
  (r) => r.toBe(6)
);

makeTest(
  () =>
    Task.succeed(3)
      .tap((a) => a * 2)
      .runPromise(),
  (r) => r.toBe(3)
);

makeTest(
  async (fn) => (await Task.succeed(3).tap(fn).runPromise()) && fn.mock.calls.length,
  (r) => r.toBe(1)
);

makeTest(
  () =>
    Task.succeed(3)
      .chain((a) => Task.succeed(a + 3))
      .runPromise(),
  (r) => r.toBe(6)
);

makeTest(
  () =>
    Task.succeed(3)
      .access<{ a: number }>()
      .chain(({ a }) =>
        Task.succeed(0)
          .access<{ b: number }>()
          .map(({ b }) => a + b)
      )
      .provide({ a: 3, b: 3 })
      .runPromise(),
  (r) => r.toBe(6)
);

makeTest(
  () =>
    Task.succeed(3)
      .access<{ a: number }>()
      .chain(({ a }) => Task.succeed(0).access<{ b: number }>())
      .map(({ b }) => b)
      .provide({ a: 3, b: 3 })
      .runPromise(),
  (r) => r.toBe(3)
);

makeTest(
  () =>
    Task.succeed(1)
      .chain((a) => Task.succeed(a + 1).map((b) => b + 1))
      .map((a) => a + 1)
      .chain((a) => Task.succeed(a + 1).map((b) => b + 1))
      .map((a) => a + 1)
      .runPromise(),
  (r) => r.toBe(7)
);

makeTest(
  () => Task.succeed(3).mapTo(6).runPromise(),
  (r) => r.toBe(6)
);

makeTest(
  () =>
    Task.succeed(3)
      .access<{ n: number }>()
      .map(({ n }) => n * 2)
      .provide({ n: 5 })
      .runPromise(),
  (r) => r.toBe(10)
);

makeTest(
  () =>
    Task.succeed(2)
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .runPromise(),
  (r) => r.toBe(14)
);

makeTest(
  () =>
    Task.succeed(2)
      .map((q) => Promise.resolve(q + 2))
      .chain((s) =>
        Task.succeed(Promise.resolve(s * 2))
          .delay(5)
          .map((q) => q + 2)
      )
      .chain((s) => Task.succeed(Promise.resolve(s * 3)).map((q) => q + 3))
      .map((s) => Promise.resolve(s + 4))
      .runPromise(),
  (r) => r.toBe(37)
);

makeTest(
  () =>
    Task.succeed(2)
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .mapError(() => "2")
      .runPromise(),
  (r) => r.toBe(6)
);

// fail

makeTest(
  async () => Task.fail("6").runPromise().toString(),
  (r) => r.toBe("Error: 6")
);

makeTest(
  async () =>
    Task.fail(6)
      .mapError((err) => 1)
      .runPromise()
      .toString(),
  (r) => r.toBe("Error: 1")
);

makeTest(
  async () =>
    Task.succeed("6")
      .map((s) => Promise.resolve(s))
      .runPromise(),
  (r) => r.toBe("6")
);

makeTest(
  async () => {
    try {
      await Task.fail("6")
        .mapError((s) => Promise.reject(s))
        .runPromise();
    } catch (e) {
      return e;
    }
  },
  (r) => r.toBe("6")
);

makeTest(
  async () =>
    Task.succeed("6")
      .map((t) => {
        if (!0) {
          throw new Error("err");
        }
        return t;
      })
      .mapTo(6)
      .runPromise()
      .toString(),
  (r) => r.toBe("Error: err")
);

// repeat
makeTest(
  async (fn) => Task.succeed("6").repeat(5).tap(fn).runPromise().toString() && fn.mock.calls.length,
  (r) => r.toBe(6)
);

let count = 0;
makeTest(
  async (fn) =>
    Task.succeed(4)
      .repeatWhile((max) => count++ < max)
      .tap(fn)
      .runPromise()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(5)
);

makeTest(
  async (fn) => Task.succeed("6").repeat(2).repeat(2).tap(fn).runPromise().toString() && fn.mock.calls.length,
  (r) => r.toBe(5)
);

makeTest(
  async (fn) =>
    Task.succeed("6")
      .chain(() => Task.succeed(0).repeat(2))
      .repeat(2)
      .tap(fn)
      .runPromise()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(3)
);

makeTest(
  async (fn) =>
    Task.succeed("6")
      .chain(() => Task.succeed(0).repeat(2).tap(fn))
      .repeat(2)
      .tap(fn)
      .runPromise()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(6)
);

makeTest(
  async () =>
    Task.succeed(2)
      .repeat(2)
      .reduce((a, b) => a + b, 0)
      .runPromise(),
  (r) => r.toBe(6)
);

let i = 0;
makeTest(
  async (fn) =>
    Task.succeed(2)
      .retryWhile(() => i++ < 10)
      .tap(fn)
      .tap(() => {
        if (i <= 3) {
          throw "err";
        }
      })
      .runPromise()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(4)
);

i = 0;
makeTest(
  async (fn) =>
    Task.succeed(2)
      .retryWhile(() => i++ < 7)
      .tap(fn)
      .runPromise()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(1)
);

// struct
makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1),
      b: Task.succeed(2),
    }).runPromise(),
  (r) => r.toEqual({ a: 1, b: 2 })
);

/* StructPar ordering */
makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1).map(() => Date.now()),
      b: Task.succeed(2).map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runPromise(),
  (r) => r.toEqual(0)
);

makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1)
        .delay(1)
        .map(() => Date.now()),
      b: Task.succeed(2)
        .delay(4)
        .map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runPromise(),
  (r) => r.not.toEqual(0)
);

makeTest(
  async () =>
    Task.struct({
      a: Task.succeed(1)
        .delay(1)
        .map(() => Date.now()),
      b: Task.succeed(2)
        .delay(4)
        .map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runPromise(),
  (r) => r.not.toEqual(0)
);

makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1)
        .delay(5)
        .map(() => Date.now()),
      b: Task.succeed(2)
        .delay(5)
        .map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runPromise(),
  (r) => r.toEqual(0)
);

makeTest(
  async () =>
    Task.struct({
      a: Task.succeed(1)
        .delay(5)
        .map(() => Date.now()),
      b: Task.succeed(2)
        .delay(5)
        .map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runPromise(),
  (r) => r.not.toEqual(0)
);

makeTest(
  async () =>
    Task.struct({
      a: Task.succeed(1).map(() => Date.now()),
      b: Task.succeed(2).map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runPromise(),
  (r) => r.toEqual(0)
);

makeTest(
  async () =>
    Task.struct({
      a: Task.succeed(1).map(() => Date.now()),
      b: Task.succeed(2).map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runPromise() instanceof Promise,
  (r) => r.toEqual(false)
);

makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1),
      b: Task.succeed("2"),
    })
      .map(({ a, b }) => a + b)
      .runPromise(),
  (r) => r.toEqual("12")
);

makeTest(
  async () =>
    Task.succeed(Date.now())
      .delay(10)
      .map((val) => Date.now() - val)
      .map((val) => Math.round(val / 10))
      .runPromise(),
  (r) => r.toEqual(1)
);

makeTest(
  async () =>
    Task.succeed(Date.now())
      .delay(10)
      .delay(10)
      .delay(10)
      .map((val) => Date.now() - val)
      .map((val) => Math.round(val / 30))
      .runPromise(),
  (r) => r.toEqual(1)
);

makeTest(
  async () => Task.succeed(4).delay(5).runPromise(),
  (r) => r.toEqual(4)
);

makeTest(
  async (fn) => (await Task.succeed(4).ensure(fn).delay(5).runPromise()) && fn.mock.calls.length,
  (r) => r.toEqual(1)
);

makeTest(
  async (fn) => (await Task.succeed(4).delay(5).ensure(fn).runPromise()) && fn.mock.calls.length,
  (r) => r.toEqual(1)
);

makeTest(
  async (fn) =>
    (await Task.succeed(4)
      .map(() => Promise.resolve(5))
      .ensure(fn)
      .runPromise()) && fn.mock.calls.length,
  (r) => r.toEqual(1)
);

// seq
makeTest(
  async () =>
    Task.sequenceGen(function* () {
      yield 1;
      yield 2;
      yield 3;
    })
      .reduce((a, b) => a + b, 0)
      .runPromise(),
  (r) => r.toEqual(6)
);

makeTest(
  async () =>
    Task.sequenceFrom([1, 2, 3])
      .reduce((a, b) => a + b, 0)
      .runPromise(),
  (r) => r.toEqual(6)
);

makeTest(
  async () =>
    Task.sequenceFrom("abc")
      .map((s) => `[${s}]`)
      .runPromise(),
  (r) => r.toEqual("[c]")
);

makeTest(
  async () =>
    Task.sequenceFrom("abc")
      .collectWhen((s) => s !== "b")
      .runPromise(),
  (r) => r.toEqual(["a", "c"])
);

makeTest(
  async () => Task.sequenceFrom("abc").collectAll().runPromise(),
  (r) => r.toEqual(["a", "b", "c"])
);

makeTest(
  async () =>
    Task.sequenceFrom("abc")
      .reduce((a, b) => `${b}-${a}`, "")
      .runPromise(),
  (r) => r.toEqual("-a-b-c")
);

// modules
makeTest(
  async () => {
    const log = (message: string) =>
      Task.succeed(message)
        .access<{ mLog(m: string): void }>()
        .tap(({ mLog }) => {
          mLog("{Time}: " + message);
        });

    let logData: string[] = [];

    const mLog = (msg: string) => logData.push(msg);

    return Task.sequenceFrom(["one", "two"])
      .chain((msg) =>
        Task.succeed(msg)
          .access<{ log: typeof log }>()
          .chain(({ log }) => {
            return log(msg);
          })
      )
      .provide({ log, mLog })
      .mapTo(logData)
      .runPromise();
  },
  (r) => r.toEqual(["{Time}: one", "{Time}: two"])
);

// type checks
const a = Task.succeed(4).runPromise();
const aa: number | Error = a;

const b = Task.succeed(Promise.resolve(5)).runPromise();
const bb: Promise<Error | number> = b;

const c = Task.succeed(5);
const cc: Task<number, {}, {}, unknown, false> = c;

const d = Task.succeed(Promise.resolve(5));
const dd: Task<number, {}, {}, unknown, false> = d;

const e = Task.succeed(5).mapTo(5);
const ee: Task<number, {}, {}, unknown, false> = c;
