import { Task } from "../..";

export const makeLogger =
  (type: "log" | "info" | "error") => (message: string) =>
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

export const log = makeLogger("log");
export const info = makeLogger("info");
export const error = makeLogger("error");
export const loggerModule = { log, info, error };
