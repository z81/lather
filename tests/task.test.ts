import { Fail, Result, Task, TimeOutError } from '../src/task';
import { makeTestRunner } from './configure';
import { delay, flow } from '../src/fn';

const makeTest = makeTestRunner(__filename);

makeTest(
  () => Task.succeed(3).runUnsafe(),
  (r) => r.toBe(3),
);

makeTest(
  () =>
    Task.succeed(3)
      .map((a) => a * 2)
      .runUnsafe(),
  (r) => r.toBe(6),
);

makeTest(
  () =>
    Task.succeed(3)
      .tap((a) => a * 2)
      .runUnsafe(),
  (r) => r.toBe(3),
);

makeTest(
  async (fn) => (await Task.succeed(3).tap(fn).runUnsafe()) && fn.mock.calls.length,
  (r) => r.toBe(1),
);

makeTest(
  () =>
    Task.succeed(3)
      .chain((a) => Task.succeed(a + 3))
      .runUnsafe(),
  (r) => r.toBe(6),
);

makeTest(
  () =>
    Task.succeed(3)
      .access<{ a: number }>()
      .chain(({ a }) =>
        Task.succeed(0)
          .access<{ b: number }>()
          .map(({ b }) => a + b),
      )
      .provide({ a: 3, b: 3 })
      .runUnsafe(),
  (r) => r.toBe(6),
);

makeTest(
  () =>
    Task.succeed(3)
      .access<{ a: number }>()
      .chain(({ a }) => Task.succeed(0).access<{ b: number }>())
      .map(({ b }) => b)
      .provide({ a: 3, b: 3 })
      .runUnsafe(),
  (r) => r.toBe(3),
);

makeTest(
  () =>
    Task.succeed(1)
      .chain((a) => Task.succeed(a + 1).map((b) => b + 1))
      .map((a) => a + 1)
      .chain((a) => Task.succeed(a + 1).map((b) => b + 1))
      .map((a) => a + 1)
      .runUnsafe(),
  (r) => r.toBe(7),
);

makeTest(
  () => Task.succeed(3).mapTo(6).runUnsafe(),
  (r) => r.toBe(6),
);

makeTest(
  () =>
    Task.succeed(3)
      .access<{ n: number }>()
      .map(({ n }) => n * 2)
      .provide({ n: 5 })
      .runUnsafe(),
  (r) => r.toBe(10),
);

makeTest(
  () =>
    Task.succeed(2)
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .runUnsafe(),
  (r) => r.toBe(14),
);

makeTest(
  () =>
    Task.succeed(2)
      .map((q) => Promise.resolve(q + 2))
      .chain((s) =>
        Task.succeed(Promise.resolve(s * 2))
          .delay(5)
          .map((q) => q + 2),
      )
      .chain((s) => Task.succeed(Promise.resolve(s * 3)).map((q) => q + 3))
      .map((s) => Promise.resolve(s + 4))
      .runUnsafe(),
  (r) => r.toBe(37),
);

makeTest(
  () =>
    Task.succeed(2)
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .mapError(() => '2')
      .runUnsafe(),
  (r) => r.toBe(6),
);

// fail

makeTest(
  async () => Task.fail('6').run().toString(),
  (r) => r.toBe('Fail: 6'),
);

makeTest(
  async () =>
    Task.fail(6)
      .mapError((err) => 1)
      .run()
      .toString(),
  (r) => r.toBe('Fail: 1'),
);

makeTest(
  async () =>
    Task.succeed('6')
      .map((s) => Promise.resolve(s))
      .runUnsafe(),
  (r) => r.toBe('6'),
);

makeTest(
  async () => {
    try {
      (await Task.fail('6')
        .mapError((s) => Promise.reject(s))
        .run()) && 123;
    } catch (e) {
      return e;
    }
  },
  (r) => r.toBe(undefined),
);

makeTest(
  async () =>
    Task.succeed('6')
      .map((t) => {
        if (1) {
          throw new Error('err');
        }
        return t;
      })
      .mapTo(6)
      .run()
      .toString(),
  (r) => r.toBe('Fail: Error: err'),
);

makeTest(
  async () =>
    Task.succeed('6')
      .map((t) => {
        if (!0) {
          throw new Error('err');
        }
        return t;
      })
      .mapTo(6)
      .mapError(() => 9)
      .run()
      .toString(),
  (r) => r.toBe('Fail: 9'),
);

// repeat
makeTest(
  async (fn) => Task.succeed('6').repeat(5).tap(fn).run().toString() && fn.mock.calls.length,
  (r) => r.toBe(6),
);

let count = 0;
makeTest(
  async (fn) =>
    Task.succeed(4)
      .repeatWhile((max) => count++ < max)
      .tap(fn)
      .runUnsafe()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(5),
);

makeTest(
  async (fn) => Task.succeed('6').repeat(2).repeat(2).tap(fn).run().toString() && fn.mock.calls.length,
  (r) => r.toBe(5),
);

makeTest(
  async (fn) =>
    Task.succeed('6')
      .chain(() => Task.succeed(0).repeat(2))
      .repeat(2)
      .tap(fn)
      .run()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(3),
);

makeTest(
  async (fn) =>
    Task.succeed('6')
      .chain(() => Task.succeed(0).repeat(2).tap(fn))
      .repeat(2)
      .tap(fn)
      .run()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(6),
);

makeTest(
  async () =>
    Task.succeed(2)
      .repeat(2)
      .reduce((a, b) => a + b, 0)
      .runUnsafe(),
  (r) => r.toBe(8),
);

let i = 0;
makeTest(
  async (fn) =>
    Task.succeed(2)
      .retryWhile(() => i++ < 10)
      .tap(() => {
        fn();
        if (i <= 3) {
          throw 'err';
        }
      })
      .run()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(5),
);

i = 0;
makeTest(
  async (fn) =>
    Task.succeed(2)
      .retryWhile(() => i++ < 7)
      .tap(fn)
      .run()
      .toString() && fn.mock.calls.length,
  (r) => r.toBe(1),
);

// struct
makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1),
      b: Task.succeed(2),
    }).runUnsafe(),
  (r) => r.toEqual({ a: 1, b: 2 }),
);

/* StructPar ordering */
makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1).map(() => Date.now()),
      b: Task.succeed(2).map(() => Date.now()),
    })
      .map(({ a, b }) => Math.abs(Math.round((a - b) / 4)))
      .runUnsafe(),
  (r) => r.toEqual(0),
);

makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1)
        .delay(1)
        .map(() => Date.now()),
      b: Task.succeed(2)
        .delay(50)
        .map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .run(),
  (r) => r.not.toEqual(0),
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
      .runUnsafe(),
  (r) => r.not.toEqual(0),
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
      .runUnsafe(),
  (r) => r.not.toEqual(0),
);

makeTest(
  async () =>
    Task.struct({
      a: Task.succeed(1).map(() => Date.now()),
      b: Task.succeed(2).map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runUnsafe(),
  (r) => r.toEqual(0),
);

makeTest(
  async () =>
    (Task.struct({
      a: Task.succeed(1).map(() => Date.now()),
      b: Task.succeed(2).map(() => Date.now()),
    })
      .map(({ a, b }) => a - b)
      .runUnsafe() as any) instanceof Promise,
  (r) => r.toEqual(false),
);

makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1),
      b: Task.succeed('2'),
    })
      .map(({ a, b }) => a + b)
      .runUnsafe(),
  (r) => r.toEqual('12'),
);

makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1).delay(5).mapTo(1),
      b: Task.succeed('2').delay(5).mapTo(7),
    })
      .map(({ a, b }) => a + b)
      .runUnsafe(),
  (r) => r.toEqual(8),
);


makeTest(
  async () =>
    Task.structPar({
      a: Task.succeed(1).map( () => new Promise<number>(r => r(1))),
      b: Task.succeed('2').delay(5).mapTo(7),
    })
      .map(({ a, b }) => a + b)
      .runUnsafe(),
  (r) => r.toEqual(8),
);

makeTest(
  async () =>
    Task.struct({
      a: Task.succeed(1).delay(5).mapTo(1),
      b: Task.succeed('2').delay(5).mapTo(7),
    })
      .map(({ a, b }) => a + b)
      .runUnsafe(),
  (r) => r.toEqual(8),
);


makeTest(
  async () =>
    Task.succeed(Date.now())
      .delay(10)
      .map((val) => Date.now() - val)
      .map((val) => Math.round(val / 10))
      .runUnsafe(),
  (r) => r.toEqual(1),
);

makeTest(
  async () =>
    Task.succeed(Date.now())
      .delay(10)
      .delay(10)
      .delay(10)
      .map((val) => Date.now() - val)
      .map((val) => Math.round(val / 30))
      .runUnsafe(),
  (r) => r.toEqual(1),
);

makeTest(
  async () => Task.succeed(4).delay(5).runUnsafe(),
  (r) => r.toEqual(4),
);

makeTest(
  async (fn) => (await Task.succeed(4).ensure(fn).delay(5).runUnsafe()) && fn.mock.calls.length,
  (r) => r.toEqual(1),
);

makeTest(
  async (fn) => (await Task.succeed(4).delay(5).ensure(fn).runUnsafe()) && fn.mock.calls.length,
  (r) => r.toEqual(1),
);

makeTest(
  async (fn) =>
    (await Task.succeed(4)
      .map(() => Promise.resolve(5))
      .ensure(fn)
      .runUnsafe()) && fn.mock.calls.length,
  (r) => r.toEqual(1),
);

// seq
makeTest(
  async () =>
    Task.sequenceFromGen(function* () {
      yield 1;
      yield 2;
      yield 3;
    })
      .reduce((a, b) => a + b, 0)
      .runUnsafe(),
  (r) => r.toEqual(6),
);

makeTest(
  async () =>
    Task.sequenceFromIterable([1, 2, 3])
      .reduce((a, b) => a + b, 0)
      .runUnsafe(),
  (r) => r.toEqual(6),
);

makeTest(
  async () =>
    Task.sequenceFromIterable('abc')
      .map((s) => `[${s}]`)
      .runUnsafe(),
  (r) => r.toEqual('[c]'),
);

makeTest(
  async () =>
    Task.sequenceFromIterable('abc')
      .collectWhen((s) => s !== 'b')
      .runUnsafe(),
  (r) => r.toEqual(['a', 'c']),
);

makeTest(
  async () => Task.sequenceFromIterable('abc').collectAll().runUnsafe(),
  (r) => r.toEqual(['a', 'b', 'c']),
);

makeTest(
  async () =>
    Task.sequenceFromIterable('abc')
      .reduce((a, b) => `${a}-${b}`, '')
      .runUnsafe(),
  (r) => r.toEqual('-a-b-c'),
);

// modules
makeTest(
  async () => {
    const log = (message: string) =>
      Task.succeed(message)
        .access<{ mLog(m: string): void }>()
        .tap(({ mLog }) => {
          mLog('{Time}: ' + message);
        });

    let logData: string[] = [];

    const mLog = (msg: string) => logData.push(msg);

    return Task.sequenceFromIterable(['one', 'two'])
      .chain((msg) =>
        Task.succeed(msg)
          .access<{ log: typeof log }>()
          .chain(({ log }) => {
            return log(msg);
          }),
      )
      .provide({ log, mLog })
      .mapTo(logData)
      .runUnsafe();
  },
  (r) => r.toEqual(['{Time}: one', '{Time}: two']),
);

// timeout

makeTest(
  async () => {
    return await Task.succeed(0).timeout(1).delay(70).run();
  },
  (r) => r.toBeInstanceOf(Fail),
);

makeTest(
  async () => {
    return await Task.succeed('google')
      .map((q) => new Promise((res, rej) => rej(0)))
      .mapError((e) => '3')
      .run();
  },
  (r) => r.toBeInstanceOf(Fail),
)

makeTest(
  async () => {
    return await Task.succeed('google')
      .map((q) => {
        if (1 === 1) {
          throw "e";
        }
        return 11;
      })
      .restoreWhen(() => true)
      .mapError((e) => 5)
      .runUnsafe();
  },
  (r) => r.toEqual('google'),
);

makeTest(
  async () => {
    let callCount = 0;
    const getPage = (url: string) => {
      let id = ++callCount;
      return new Promise<string>(
        (res, rej) =>
          setTimeout(() => {
            if (id % 2 !== 0) {
              rej(`Error: 500 - ${url}`);
            } else {
              res(`<html>${url}<html>`);
            }
          }, 100), // Math.random() * 100 + (id % 10 ? 100000 : 1))
      );
    };
    try {
      return await Task.succeed('google').retryWhile(flow(true)).map(getPage).runUnsafe();
    } catch (e) {
      return e;
    }
  },
  (r) => r.toBe('<html>google<html>'),
);

makeTest(
  async () => {
    return await Task.succeed(0)
      .timeout(1)
      .delay(50)
      .map((v) => v * 2)
      .run();
  },
  (r) => r.toBeInstanceOf(Fail),
);

makeTest(
  async (fn) => (await Task.succeed(0).timeout(1).delay(50).map(fn).run()) && fn.mock.calls.length,
  (r) => r.toBe(0),
);

makeTest(
  async (fn) =>
    await Task.succeed(0)
      .ensure(fn)
      .timeout(1)
      .delay(50)
      .map(() => 1)
      .run(),
  (r) => r.toBeInstanceOf(Fail),
);

makeTest(
  async (fn) => {
    try {
      await Task.succeed(0).timeout(50).delay(5).map(fn).delay(500).map(fn).runUnsafe();
    } catch (e) {
      return fn.mock.calls.length;
    }
  },

  (r) => r.toBe(1),
);

makeTest(
  async () =>
    Task.succeed([1, 2, 3])
      .flat()
      .reduce((a, b) => a + b, '')
      .runUnsafe(),
  (r) => r.toEqual('123'),
);

makeTest(
  async () =>
    Task.sequenceFromGen(async function* () {
      for (let i = 0; i < 10; i++) {
        yield Task.succeed(i).delay(100).runUnsafe();
      }
    })
      .throttle(500)
      .collectAll()
      .runUnsafe(),
  (r) => r.toEqual([0, 5]),
);

// max call stack
makeTest(
  async () => {
    let task = Task.succeed(0);
    for (let i = 0; i < 20000; i++) {
      task = task.map((s) => s + 1);
    }

    return task.runUnsafe();
  },
  (r) => r.toEqual(20000),
);

makeTest(
  async () => {
    let task = Task.succeed(0);
    for (let i = 0; i < 10000; i++) {
      task = task.map((s) => s + 1);
    }

    return task
      .chain((t) => {
        let task = Task.succeed(t);
        for (let i = 0; i < 10000; i++) {
          task = task.map((s) => s + 1);
        }
        return task;
      })
      .chain((t) => {
        let task = Task.succeed(t);
        for (let i = 0; i < 10000; i++) {
          task = task.map((s) => s - 1);
        }
        return task;
      })
      .runUnsafe();
  },
  (r) => r.toEqual(10000),
);

// filter
makeTest(
  () =>
    Task.sequenceFromIterable([1, 2, 3, 4])
      .filter((i) => i % 2 === 0)
      .collectAll()
      .runUnsafe(),
  (r) => r.toEqual([2, 4]),
);

makeTest(
  () =>
    Task.sequenceFromIterable([1, 2, 3, 4, 5])
      .filter((i) => i % 2 === 0)
      .collectAll()
      .runUnsafe(),
  (r) => r.toEqual([2, 4]),
);

makeTest(
  () =>
    Task.sequenceFromIterable([1, 2, 3, 4, 5])
      .filter(() => false)
      .collectAll()
      .runUnsafe(),
  (r) => r.toEqual([]),
);

makeTest(
  () =>
    Task.sequenceFromGen(async function* () {
      for (let i = 0; i < 10; i++) {
        yield i;
        await delay(30);
      }
    })
      .throttle(45)
      .collectAll()
      .runUnsafe(),
  (r) => r.toEqual([0, 2, 4, 6, 8]),
);

makeTest(
  (fn: any) =>
    Task.succeed(1)
      .tap(flow(Task.succeed(6).tap(fn)))
      .runUnsafe() && fn.mock.calls.length,
  (r) => r.toEqual(1),
);

makeTest(
  (fn) =>
    Task.succeed(0)
      .tap(flow(Task.succeed(1).tap(fn)))
      .runUnsafe(),
  (r) => r.toEqual(0),
);

makeTest(
  (fn: any) => Task.succeed(0).tap(fn).runUnsafe() || fn.mock.calls.length,
  (r) => r.toEqual(1),
);

// type checks
const a = Task.succeed(4).run();
const aa: Result<number> | Fail<Error> = a;

const b = Task.succeed(Promise.resolve(5)).runUnsafe();
const bb: Promise<Error | number> = b;

const c = Task.succeed(5);
const cc: Task<number, {}, {}, unknown, false> = c;

const d = Task.succeed(Promise.resolve(5));
const dd: Task<number, {}, {}, unknown, false> = d;

const e = Task.succeed(5).mapTo(5);
const ee: Task<number, {}, {}, unknown, false> = c;

const f = Task.succeed(5).mapTo(5).timeout(5).runUnsafe();
const ff: Task<number, {}, {}, unknown, false> = c;
