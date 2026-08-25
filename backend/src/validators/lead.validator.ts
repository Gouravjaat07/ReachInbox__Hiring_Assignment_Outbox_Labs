import { z } from 'zod';

export const parseLeadSchema = z.object({
  text: z.string().optional(),
});
