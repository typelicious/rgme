#!/usr/bin/env node
import { Command } from "commander";
import { formatTable, scanDirectory, writeProfiles } from "./scan.js";
import { describeExport, runExport } from "./export.js";

const program = new Command("rgme").description("RGME — Retro Game Modernization Engine CLI");

program
  .command("scan <directory>")
  .description("Scan a directory for .adf images (read-only), resolve rights and generate game profiles")
  .option("-o, --out <dir>", "output directory for game-profile.yaml files", "./profiles")
  .option("--include-unknown", "also write profiles for unidentified images (local-only)", false)
  .option("--no-write", "do not write profile files")
  .action(async (directory: string, opts: { out: string; includeUnknown: boolean; write: boolean }) => {
    const entries = await scanDirectory(directory);
    if (entries.length === 0) {
      console.log("No .adf files found.");
      return;
    }
    console.log(formatTable(entries));
    if (opts.write) {
      const files = await writeProfiles(entries, opts.out, opts.includeUnknown);
      console.log(`\nWrote ${files.length} profile(s) to ${opts.out}`);
    }
  });

program
  .command("export <game-profile>")
  .description("Export a portable player (cleared titles) or a BYOG package without game data (everything else)")
  .option("--media <file>", "original media file (only read for cleared titles)")
  .option("-o, --out <dir>", "output directory", "./export")
  .option("--rights <id|file>", "freeware registry entry id or freeware-games.json file (must match the media hash)")
  .action(async (profile: string, opts: { media?: string; out: string; rights?: string }) => {
    console.log(describeExport(await runExport(profile, opts)));
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
