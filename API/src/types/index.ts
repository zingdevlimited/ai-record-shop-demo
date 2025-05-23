import { z } from "zod";

export const wsMessageSchema = z.object({
  type: z.string(),
  voicePrompt: z.string().optional(),
  lang: z.string().optional(),
  last: z.boolean().optional(),
  from: z.string().optional(),
  utteranceUntilInterrupt: z.string().optional(),
});

export type wsMessage = z.infer<typeof wsMessageSchema>;
