import { Task } from "../..";
import https from "https";

export const get = (url: string) =>
  //              could be override for tests
  Task.empty.access<{ https: typeof https }>().chain(({ https }) =>
    Task.fromCallback<string>((cb) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("close", () => cb(data));
      });
    })
  );
