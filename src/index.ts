// import { Fiber } from "./fiber";

// const fiber = Fiber.resolve(1);
// const r = fiber
//   .then((a) => a * 2)
//   // .then((a) => Promise.resolve(1 + a))
//   .then((a) => {
//     if (1 === 1) {
//       throw "wtf";
//     }
//     return 1;
//   })
//   .catch((e) => "test")
//   .then((a) => 1 + a);

// console.log(r, r.status);

// (async () => {
//   console.log(await r);
// })();

// import { Task } from "./task";

// export * from "./task";

// const run = async () => {
//   // await new Promise((r) => {
//   //   setTimeout(r, 100);
//   // });

//   // debugger;

//   const d = await Task.succeed("google")
//     .map((q) => new Promise((res, rej) => rej(0)))
//     .mapError((e) => "3")
//     .run();
//   console.log(d);

//   // try {
//   //   console.log(
//   //     (await Task.fail("6")
//   //       .mapError((s) => Promise.reject(s))
//   //       .run()) && 123
//   //   );
//   // } catch (e) {
//   //   console.log("Err", e);
//   // }
// };

// run();
