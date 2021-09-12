import { z } from "zod";

export const schema = z.object({
  rates: z.record(
    z.object({
      name: z.string(),
      unit: z.string(),
      value: z.number(),
      type: z.string(),
    })
  ),
});
