import { Task } from "../../task";

// Mock http request

let callCount = 0;
const getPage = (url: string) => {
  let id = ++callCount;
  return new Promise<string>((res, rej) =>
    setTimeout(
      () => {
        if (id % 2 !== 0) {
          // console.log(
          //   "\x1b[31m%s\x1b[0m",
          //   `getPage[reject]  #${id} Error: 500 - ${url}`
          // );

          rej(`Error: 500 - ${url}`);
        } else {
          // console.log(
          //   "\x1b[32m%s\x1b[0m",
          //   `getPage[resolve] #${id} <html>#{${id}} hello from ${url}<html>`
          // );

          res(`<html>#{${id}} hello from ${url}<html>`);
        }
      },
      id % 10 === 0 ? 1000 : 10
    )
  );
};

const urlPrefixes = [
  "google",
  "fb",
  "fbi",
  "instagram",
  "ford",
  "csi",
  "twitter",
  "teasl",
  "twitch",
  "gmail",
  "apple",
  "twillo",
  "yahoo",
  "github",
  "gitlab",
  "link",
  "run",
  "check",
  "test",
  "todo",
  "trello",
];

const domainZones = ["com", "space", "cat"];

const urls = urlPrefixes.flatMap((pref) =>
  domainZones.map((dom) => `${pref}.${dom}`)
);

const getPages = (urls: string[]) =>
  Task.sequenceFrom(urls)
    .timeout(50)
    .map(getPage)
    .mapError((e) => console.error(e?.message ?? e))
    .retryWhile(() => true)
    .collectAll()
    .run();

(async () => {
  try {
    const res = await getPages(urls);
    console.log("Res", res);
  } catch (e) {
    console.log("pages", e);
  }
})();
