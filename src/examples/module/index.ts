import { Task } from "../..";
import https from "https";
import { z } from "zod";

const makeLogger = (type: "log" | "info" | "error") => (message: string) =>
  Task.empty
    .access<{
      timestamp: boolean;
      prefix?: string;
    }>()
    .tap(({ timestamp, prefix }) => {
      let logPrefix = timestamp ? `[${Date.now()}]` : "";
      logPrefix += prefix ? ` ${prefix}` : "";

      console[type](logPrefix, message);
    });

const log = makeLogger("log");
const info = makeLogger("info");
const error = makeLogger("error");
const loggerModule = { log, info, error };
// ----
const get = (url: string) =>
  //              could be override for tests
  Task.empty.access<{ https: typeof https }>().chain(({ https }) =>
    Task.empty.fromCallback<string>((cb) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("close", () => cb(data));
      });
    })
  );

// apps
const schema = z.object({
  rates: z.record(
    z.object({
      name: z.string(),
      unit: z.string(),
      value: z.number(),
      type: z.string(),
    })
  ),
});

const API_URL = "https://api.coingecko.com/api/v3/exchange_rates";

const app = Task.empty
  .chain(() => log(" Fetching data..."))
  .chain(() => get(API_URL))
  .chain((data) =>
    Task.empty
      .chain(() => log("Fetching success").mapTo(data))
      .map(JSON.parse)
      .mapError((e) => `Parsing Failed: ${e.message}`)
      .chain((_) => log("Parsing success").mapTo(_))
      .map(schema.parse)
  )
  .chain(({ rates }) =>
    Task.sequenceFrom(
      Object.values(rates).sort((a, b) => a.value - b.value)
    ).chain((rate) =>
      info(
        ` ${rate.value} ${rate.unit}`.padEnd(18) +
          ` = 1BTC  ${rate.name} [${rate.type}]`
      )
    )
  );

//
app
  .provide({
    timestamp: true,
    https,
  })
  .run();
