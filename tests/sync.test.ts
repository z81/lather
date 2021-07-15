import { Task } from "../src";
import { makeTestRunner } from "./configure";

const makeTest = makeTestRunner(__filename);

makeTest(
  () => Task.succeed(3).run(),
  (r) => r.toBe(3)
);

makeTest(
  () =>
    Task.succeed(3)
      .map((a) => a * 2)
      .run(),
  (r) => r.toBe(6)
);

makeTest(
  () =>
    Task.succeed(3)
      .tap((a) => a * 2)
      .run(),
  (r) => r.toBe(3)
);

makeTest(
  async (fn) => (await Task.succeed(3).tap(fn).run()) && fn.call.length,
  (r) => r.toBe(1)
);

makeTest(
  () =>
    Task.succeed(3)
      .chain((a) => Task.succeed(a + 3))
      .run(),
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
      .run(),
  (r) => r.toBe(6)
);

makeTest(
  () =>
    Task.succeed(3)
      .access<{ a: number }>()
      .chain(({ a }) => Task.succeed(0).access<{ b: number }>())
      .map(({ b }) => b)
      .provide({ a: 3, b: 3 })
      .run(),
  (r) => r.toBe(3)
);

makeTest(
  () =>
    Task.succeed(1)
      .chain((a) => Task.succeed(a + 1).map((b) => b + 1))
      .map((a) => a + 1)
      .chain((a) => Task.succeed(a + 1).map((b) => b + 1))
      .map((a) => a + 1)
      .run(),
  (r) => r.toBe(7)
);

makeTest(
  () => Task.succeed(3).mapTo(6).run(),
  (r) => r.toBe(6)
);

makeTest(
  () =>
    Task.succeed(3)
      .access<{ n: number }>()
      .map(({ n }) => n * 2)
      .provide({ n: 5 })
      .run(),
  (r) => r.toBe(10)
);

makeTest(
  () =>
    Task.succeed(2)
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .run(),
  (r) => r.toBe(14)
);

makeTest(
  () =>
    Task.succeed(2)
      .map((q) => q * 2)
      .map((s) => Promise.resolve(s + 2))
      .mapError(() => "2")
      .run(),
  (r) => r.toBe(6)
);

// fail

makeTest(
  async () => Task.fail("6").run().toString(),
  (r) => r.toBe("Error: 6")
);

makeTest(
  async () =>
    Task.fail(6)
      .mapError((err) => 1)
      .run()
      .toString(),
  (r) => r.toBe("Error: 1")
);

makeTest(
  async () =>
    Task.succeed("6")
      .map((s) => Promise.resolve(s))
      .run(),
  (r) => r.toBe("6")
);

makeTest(
  async () => {
    try {
      await Task.fail("6")
        .mapError((s) => Promise.reject(s))
        .run();
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
      .run()
      .toString(),
  (r) => r.toBe("Error: err")
);
