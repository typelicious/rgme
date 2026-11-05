import { z } from "zod";

export const GAME_PROFILE_SCHEMA = "rgme.game/v0.2" as const;

export const PlatformSchema = z.enum([
  "amiga",
  "c64",
  "atari_st",
  "dos",
  "megadrive",
  "snes",
  "nes"
]);
export type Platform = z.infer<typeof PlatformSchema>;

export const MediaKindSchema = z.enum([
  "adf",
  "ipf",
  "dms",
  "d64",
  "t64",
  "g64",
  "st",
  "msa",
  "rom",
  "bin",
  "md",
  "sfc",
  "smc",
  "nes",
  "img",
  "iso"
]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

const sha256 = z.string().regex(/^[0-9a-fA-F]{64}$/, "SHA-256 must be 64 hex characters");

export const MachineConfigSchema = z
  .object({
    model: z.string().min(1),
    chipset: z.string().optional(),
    video: z.enum(["PAL", "NTSC"]).default("PAL"),
    ram: z.object({ chipKb: z.number().int().positive(), fastKb: z.number().int().min(0) }).partial().optional(),
    kickstart: z.string().optional()
  })
  .passthrough();

export const MediaSchema = z
  .object({
    id: z.string().min(1),
    kind: MediaKindSchema,
    filename: z.string().min(1),
    label: z.string().optional(),
    sha256
  })
  .strict();

export const InputMappingSchema = z
  .object({
    id: z.string().min(1),
    keyboard: z.record(z.string(), z.enum(["up", "down", "left", "right", "fire", "fire2"])).default({}),
    gamepad: z.record(z.string(), z.enum(["up", "down", "left", "right", "fire", "fire2"])).default({})
  })
  .strict();

export const DisplayProfileSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().optional(),
    aspect: z.literal("4:3").default("4:3"),
    scaling: z.enum(["integer", "fit"]).default("integer"),
    crt: z.boolean().default(false),
    aspectAltered: z.boolean().default(false)
  })
  .strict();

export const GameProfileSchema = z
  .object({
    schema: z.literal(GAME_PROFILE_SCHEMA),
    id: z.string().min(1),
    title: z.string().min(1),
    platform: PlatformSchema.default("amiga"),
    machine: MachineConfigSchema,
    media: z.array(MediaSchema).min(1),
    runtime: z
      .object({
        preferredAdapter: z.string().min(1),
        fallbackAdapters: z.array(z.string()).optional(),
        options: z.record(z.string(), z.unknown()).optional()
      })
      .strict(),
    launch: z.object({ bootMediaId: z.string().min(1), autoStart: z.boolean().optional() }).strict(),
    input: InputMappingSchema,
    display: DisplayProfileSchema,
    rights: z.object({ recordId: z.string().min(1) }).strict()
  })
  .strict()
  .superRefine((p, ctx) => {
    if (!p.media.some((m) => m.id === p.launch.bootMediaId)) {
      ctx.addIssue({ code: "custom", path: ["launch", "bootMediaId"], message: "bootMediaId must reference a media entry" });
    }
  });

export type MachineConfig = z.infer<typeof MachineConfigSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type InputMapping = z.infer<typeof InputMappingSchema>;
export type DisplayProfile = z.infer<typeof DisplayProfileSchema>;
export type GameProfile = z.infer<typeof GameProfileSchema>;

export function parseGameProfile(data: unknown): GameProfile {
  return GameProfileSchema.parse(data);
}

export function safeParseGameProfile(data: unknown) {
  return GameProfileSchema.safeParse(data);
}

export const DEFAULT_INPUT_MAPPING: InputMapping = {
  id: "default-keyboard",
  keyboard: { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Space: "fire", ControlLeft: "fire", AltLeft: "fire2" },
  gamepad: { "12": "up", "13": "down", "14": "left", "15": "right", "0": "fire", "1": "fire2" }
};

export const DEFAULT_DISPLAY_PROFILE: DisplayProfile = {
  id: "authentic-pal",
  label: "Authentic PAL",
  aspect: "4:3",
  scaling: "integer",
  crt: false,
  aspectAltered: false
};
