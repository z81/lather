// import { Task } from "../..";

/*
map, mapError, mapTo, tap, chain 1 -> 1
repeatWhile, repeat
sequenceGen
reduce T
retryWhile -> err
timeout -> err
// access, provide
collectWhen T -> T[]
ensureAll
ensure
delay


*/

// // Mock http request

// let callCount = 0;
// const getPage = (url: string) => {
//   let id = ++callCount;
//   return new Promise<string>(
//     (res, rej) =>
//       setTimeout(() => {
//         if (id % 2 !== 0) {
//           rej(`Error: 500 - ${url}`);
//         } else {
//           res(`<html>#{${id}} hello from ${url}<html>`);
//         }
//       }, 100) // Math.random() * 100 + (id % 10 ? 100000 : 1))
//   );
// };

// const urlPrefixes = [
//   "google",
//   "fb",
//   "fbi",
//   "instagram",
//   "ford",
//   "csi",
//   "twitter",
//   "teasl",
//   "twitch",
//   "gmail",
//   "apple",
//   "twillo",
//   "yahoo",
//   "github",
//   "gitlab",
//   "link",
//   "run",
//   "check",
//   "test",
//   "todo",
//   "trello",
// ];

// const domainZones = ["com", "space", "cat"];

// const urls = urlPrefixes.flatMap((pref) => domainZones.map((dom) => `${pref}.${dom}`));

// const getPages = (urls: string[]) =>
//   Task.succeed(urls[0])
//     // .timeout(150)
//     .map(getPage)
//     .tap((t) => console.log("tap", t))
//     // .mapError((e) => console.error("err", e))
//     // .retryWhile(() => true)
//     // .collectAll()
//     .run(); //
// // Task.sequenceFrom(urls)
// //   // .timeout(150)
// //   .map(getPage)
// //   .tap((t) => console.log("tap", t))
// //   // .mapError((e) => console.error("err", e))
// //   .retryWhile(() => true)
// //   .collectAll()
// //   .run(); //

// (async () => {
//   try {
//     const res = await getPages(urls);
//     console.log("Res", res);
//   } catch (e) {
//     console.log("pages", e);
//   }
// })();
