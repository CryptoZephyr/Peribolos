declare module "@langchain/core/tools" {
  import type { z } from "zod";

  export function tool<TSchema extends z.ZodTypeAny>(
    fn: (input: z.infer<TSchema>) => string | Promise<string>,
    fields: {
      name: string;
      description?: string;
      schema: TSchema;
    },
  ): unknown;
}
