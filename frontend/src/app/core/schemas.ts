import { z } from 'zod';

export const emailSchema = z.email();
export const uuidV4Schema = z.uuidv4();
export const posthogUiOriginSchema = z.enum([
  'https://us.posthog.com',
  'https://eu.posthog.com',
]);

export function tokenSchema(min = 10, max = 200) {
  return z
    .string()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+$/);
}

const httpsHostSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
});

export const analyticsRuntimeSchema = z.object({
  enabled: z.literal(true),
  projectToken: tokenSchema().refine((token) => !token.startsWith('phx_')),
  apiHost: httpsHostSchema,
  uiHost: httpsHostSchema
    .refine((value) => posthogUiOriginSchema.safeParse(new URL(value).origin.toLowerCase()).success)
    .optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
});

export const contactFormSchema = z.object({
  intent: z.enum(['freelance', 'hi']),
  name: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .refine((name) => [...name].some((ch) => ch.toLowerCase() !== ch.toUpperCase())),
  email: z.email().max(254),
  phone: z.union([
    z.literal(''),
    z
      .string()
      .max(40)
      .regex(/^[+]?[\d\s().-]+$/)
      .refine((value) => {
        let digits = 0;
        for (const ch of value) if (ch >= '0' && ch <= '9') digits++;
        return digits >= 7 && digits <= 15;
      }),
  ]),
  message: z.string().trim().min(1).max(5000),
});

export function looksLikeEmail(value: unknown): value is string {
  return emailSchema.safeParse(value).success;
}

export function isUuidV4(value: unknown): value is string {
  return uuidV4Schema.safeParse(value).success;
}

export function isSafeToken(value: string, min = 10, max = 200): boolean {
  return tokenSchema(min, max).safeParse(value).success;
}

export function isOfficialPosthogUi(origin: string): boolean {
  return posthogUiOriginSchema.safeParse(origin.toLowerCase()).success;
}
