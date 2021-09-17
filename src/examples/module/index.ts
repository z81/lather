import https from "https";
import { app } from "./app";

const API_URL = "https://api.coingecko.com/api/v3/exchange_rates";

app
  .provide({
    timestamp: true,
    https,
    API_URL,
  })
  .run();
