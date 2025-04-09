import { string, z } from "zod";

export const wsMessageSchema = z.object({
  type: z.string(),
  voicePrompt: z.string().optional(),
  lang: z.string().optional(),
  last: z.boolean().optional(),
});

export type wsMessage = z.infer<typeof wsMessageSchema>;
