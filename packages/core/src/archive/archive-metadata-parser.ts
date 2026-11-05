import type { ArchiveOrgFile } from "./archive-connector.js";

export interface RetroGameVersion {
  filename: string;
  size?: number;
  label: string;
  diskIndex?: number;
  totalDisks?: number;
  region?: string;
  format: "adf" | "ipf" | "d64" | "md" | "zip" | "unknown";
  sourceId: string;
}

export interface RetroGameMetadata {
  id: string;
  canonicalTitle: string;
  genre: string;
  year?: number;
  studio?: string;
  platform: "amiga" | "c64" | "megadrive";
  versions: RetroGameVersion[];
  defaultVersion: RetroGameVersion;
  sourceId: string;
  sourceTitle: string;
  totalDisks?: number;
}

const KNOWN_STUDIOS = [
  "Lucasfilm",
  "LucasArts",
  "Cinemaware",
  "Team17",
  "Psygnosis",
  "Ocean",
  "MicroProse",
  "Delphine Software",
  "Delphine",
  "Revolution Software",
  "Revolution",
  "Bitmap Brothers",
  "Bullfrog",
  "Gremlin Graphics",
  "Gremlin",
  "Commodore",
  "Infocom",
  "Sierra",
  "Maxis",
  "Electronic Arts",
  "EA",
  "Rainbow Arts",
  "Factor 5",
  "Thalion",
  "Silmarils",
  "Core Design",
  "Mirrorsoft",
  "Virgin",
  "US Gold",
  "Codemasters",
  "Titus",
  "Sunsoft",
  "Konami",
  "Capcom",
  "SEGA"
];

const GENRE_RULES: Array<{ genre: string; regex: RegExp }> = [
  {
    genre: "Point & Click Adventure",
    regex: /(adventure|quest|monkey island|maniac mansion|loom|indy|indiana jones|simon the sorcerer|beneath a steel sky|flight of the amazon queen|lure of the temptress|zack|deja vu|shadowgate|uninvited|gobliiins)/i
  },
  {
    genre: "Cinematic Action",
    regex: /(another world|flashback|fade to black|cinemaware|defender of the crown|it came from the desert|rocket ranger|wings)/i
  },
  {
    genre: "Shoot 'Em Up",
    regex: /(turrican|r-type|xenon|project-x|swiv|hybris|battle squadron|apidya|katakis|blood money|silkworm|menace|stardust)/i
  },
  {
    genre: "Platformer",
    regex: /(platform|mario|sonic|giana sisters|super frog|lionheart|brian the lion|chuck rock|james pond|cool spot|ruff 'n' tumble|titus the fox|prehistorik)/i
  },
  {
    genre: "Strategy & Simulation",
    regex: /(colonization|civilization|settlers|populous|powermonger|dune|megalomania|simcity|f-15|f-16|f-19|f-29|gunship|railroad tycoon|theme park|syndicate|caesar|anno|centurion)/i
  },
  {
    genre: "RPG & Dungeon Crawler",
    regex: /(rpg|dungeon master|eye of the beholder|black crypt|amberstar|ambermoon|ishar|bloodwych|bard's tale|might and magic|ultima|wizardry|elivra)/i
  },
  {
    genre: "Racing & Sports",
    regex: /(racing|f1|formula|speedball|sensible soccer|kick off|lotus|jaguar xj220|super cars|overdrive|stunt car|micro machines|pga|golf|tennis|ski)/i
  },
  {
    genre: "Puzzle & Arcade",
    regex: /(lemmings|tetris|klax|pang|pacman|bubble bobble|parasol stars|boulder dash|pinball dreams|pinball fantasies|pinball illu|arkanoid)/i
  },
  {
    genre: "Demoscene & Music",
    regex: /(demo|scene|music disk|trackmo|party|state of the art|second reality|desert dream|hardwired)/i
  }
];

export function extractYear(filename: string): number | undefined {
  const match = filename.match(/[\(\[\s_](19[89][0-9]|20[0-2][0-9])[\)\]\s_\.]/);
  if (match && match[1]) {
    const y = parseInt(match[1], 10);
    if (y >= 1980 && y <= 2026) return y;
  }
  return undefined;
}

export function extractStudio(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  for (const studio of KNOWN_STUDIOS) {
    if (lower.includes(studio.toLowerCase())) {
      return studio;
    }
  }
  return undefined;
}

export function extractGenre(filename: string): string {
  for (const rule of GENRE_RULES) {
    if (rule.regex.test(filename)) {
      return rule.genre;
    }
  }
  return "Classic Retro";
}

export function extractRegion(filename: string): string | undefined {
  const m = filename.match(/[\(\[](EU|DE|GE|US|FR|IT|ES|UK|JP)[\)\]]/i);
  if (m && m[1]) return m[1].toUpperCase();
  return undefined;
}

export function extractDiskInfo(filename: string): { diskIndex?: number; totalDisks?: number } {
  // Pattern: "Disk 1 of 4", "Disk 1 of 11", "Disk1", "Disk 2"
  const m1 = filename.match(/Disk\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
  if (m1 && m1[1] && m1[2]) {
    return { diskIndex: parseInt(m1[1], 10), totalDisks: parseInt(m1[2], 10) };
  }
  const m2 = filename.match(/Disk\s*(\d+)/i);
  if (m2 && m2[1]) {
    return { diskIndex: parseInt(m2[1], 10) };
  }
  return {};
}

export function extractCanonicalTitle(filename: string): string {
  let title = filename
    // Strip file extension
    .replace(/\.(adf|ipf|d64|md|zip|m3u)$/i, "")
    // Strip multi-disk tags
    .replace(/[\(\[\s_]*Disk\s*\d+\s*(?:of|\/)?\s*\d*[\)\]\s_]*/gi, " ")
    .replace(/[\(\[\s_]*Dis[ck]s?\s*\d*[\)\]\s_]*/gi, " ")
    // Strip region tags (EU), (DE), (US), etc.
    .replace(/[\(\[](EU|DE|GE|US|FR|IT|ES|UK|JP)[\)\]]/gi, " ")
    // Strip year tags (1992), [1990]
    .replace(/[\(\[](19[89][0-9]|20[0-2][0-9])[\)\]]/g, " ")
    // Strip format tags (AGA), (OCS), (ECS), (WHDLoad), (v1.2), etc.
    .replace(/[\(\[](AGA|OCS|ECS|WHDLoad|v\d+[\.\d]*|cr\s*\w+|MFM)[\)\]]/gi, " ")
    // Strip underscores and duplicate spaces
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title || filename;
}

export function parseArchiveFilesToCatalog(
  sourceId: string,
  sourceTitle: string,
  files: ArchiveOrgFile[]
): RetroGameMetadata[] {
  const groups: Map<string, { title: string; files: ArchiveOrgFile[] }> = new Map();

  for (const f of files) {
    const canonical = extractCanonicalTitle(f.name);
    const key = canonical.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.files.push(f);
    } else {
      groups.set(key, { title: canonical, files: [f] });
    }
  }

  const catalog: RetroGameMetadata[] = [];

  for (const [key, group] of groups.entries()) {
    const versions: RetroGameVersion[] = group.files.map((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const format = ext === "adf" || ext === "ipf" || ext === "d64" || ext === "md" || ext === "zip" ? ext : "unknown";
      const { diskIndex, totalDisks } = extractDiskInfo(file.name);
      const region = extractRegion(file.name);

      let label = file.name;
      if (diskIndex !== undefined && totalDisks !== undefined) {
        label = `Disk ${diskIndex} of ${totalDisks}${region ? ` (${region})` : ""}`;
      } else if (diskIndex !== undefined) {
        label = `Disk ${diskIndex}${region ? ` (${region})` : ""}`;
      } else if (region) {
        label = `${region} Edition (${format.toUpperCase()})`;
      }

      return {
        filename: file.name,
        size: file.size,
        label,
        diskIndex,
        totalDisks,
        region,
        format,
        sourceId
      };
    });

    // Sort versions by disk index or name
    versions.sort((a, b) => {
      if (a.diskIndex !== undefined && b.diskIndex !== undefined) {
        return a.diskIndex - b.diskIndex;
      }
      return a.filename.localeCompare(b.filename);
    });

    const defaultVersion = versions[0]!;
    const primaryFile = group.files[0]!.name;
    const year = extractYear(primaryFile);
    const studio = extractStudio(primaryFile);
    const genre = extractGenre(group.title);
    const totalDisks = Math.max(
      ...versions.map((v) => v.totalDisks ?? (v.diskIndex !== undefined ? v.diskIndex : 1))
    );

    catalog.push({
      id: `${sourceId}:${key}`,
      canonicalTitle: group.title,
      genre,
      year,
      studio,
      platform: "amiga",
      versions,
      defaultVersion,
      sourceId,
      sourceTitle,
      totalDisks: totalDisks > 1 ? totalDisks : undefined
    });
  }

  // Sort catalog by canonical title
  return catalog.sort((a, b) => a.canonicalTitle.localeCompare(b.canonicalTitle));
}

export interface CatalogFilterOptions {
  query?: string;
  genre?: string;
  studio?: string;
  year?: number | "all";
  sourceId?: string;
}

export function filterCatalog(items: RetroGameMetadata[], opts: CatalogFilterOptions): RetroGameMetadata[] {
  return items.filter((item) => {
    if (opts.sourceId && opts.sourceId !== "all" && item.sourceId !== opts.sourceId) {
      return false;
    }
    if (opts.genre && opts.genre !== "all" && item.genre !== opts.genre) {
      return false;
    }
    if (opts.studio && opts.studio !== "all" && item.studio !== opts.studio) {
      return false;
    }
    if (opts.year && opts.year !== "all" && item.year !== opts.year) {
      return false;
    }
    if (opts.query && opts.query.trim()) {
      const q = opts.query.toLowerCase().trim();
      const matchTitle = item.canonicalTitle.toLowerCase().includes(q);
      const matchStudio = item.studio?.toLowerCase().includes(q);
      const matchGenre = item.genre.toLowerCase().includes(q);
      const matchVersion = item.versions.some((v) => v.filename.toLowerCase().includes(q));
      if (!matchTitle && !matchStudio && !matchGenre && !matchVersion) {
        return false;
      }
    }
    return true;
  });
}
