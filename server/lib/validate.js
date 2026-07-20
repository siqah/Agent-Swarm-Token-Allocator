import { z } from 'zod';

const MAX_PROMPT_LENGTH = parseInt(process.env.MAX_PROMPT_LENGTH, 10) || 100000;

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().max(MAX_PROMPT_LENGTH, `content must not exceed ${MAX_PROMPT_LENGTH} characters`),
  name: z.string().optional(),
});

export const chatCompletionSchema = z.object({
  model: z.string().min(1, 'model must be a non-empty string'),
  messages: z.array(messageSchema).min(1, 'messages must be a non-empty array'),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stream: z.boolean().optional(),
});

export const configUpdateSchema = z.object({
  totalBudget: z.number().nonnegative('totalBudget must be a non-negative number').optional(),
  selectedModel: z.string().min(1, 'selectedModel must be a non-empty string').optional(),
  departments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    allocation: z.number().min(0).max(100),
    agents: z.array(z.object({
      id: z.string(),
      name: z.string(),
      allocation: z.number().min(0).max(100),
      description: z.string().optional(),
    })),
  })).min(1, 'departments must be a non-empty array').optional(),
  thresholds: z.object({
    warning: z.number().min(0).max(100).optional(),
    danger: z.number().min(0).max(100).optional(),
  }).optional(),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return res.status(400).json({
        error: {
          message: firstError.message,
          type: 'invalid_request_error',
          code: 'validation_error',
          field: firstError.path.join('.'),
        },
      });
    }
    req.validatedBody = result.data;
    next();
  };
}
