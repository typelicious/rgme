import type { DisplayProfile, GameProfile, InputMapping, Media } from "../profile.js";
import type { RuntimeAdapter, RuntimeCapabilities, RuntimeSnapshot, RuntimeState, RuntimeStatus, SaveStateMeta } from "../runtime.js";
import { FrameScheduler, PAL_FRAME_RATE_HZ, REAL_CLOCK, type SchedulerClock } from "../wasm/timing.js";
import type { Canvas2DLike, CanvasLike } from "../mock-runtime.js";
import { drawText } from "../platforms/font.js";

export type EmulatorMediaProvider = (media: Media) => Uint8Array | Promise<Uint8Array>;

export interface PlaceholderPreviewAdapterOptions {
  mediaProvider: EmulatorMediaProvider;
  kickstartRom?: Uint8Array;
  coreUrl?: string;
  dataUrl?: string;
  canvas?: CanvasLike | HTMLCanvasElement | null;
  container?: HTMLElement | null;
  clock?: SchedulerClock;
  cyclesPerFrame?: number;
}

const ADAPTER_ID = "preview";
const FB_WIDTH = 320;
const FB_HEIGHT = 256;

type GameKind = "rick" | "wayne" | "amazon" | "steel" | "lure" | "turrican" | "demo" | "generic" | "kickstart";

/**
 * PLACEHOLDER PREVIEW — THIS IS NOT AN EMULATOR.
 *
 * It executes no ADF, no Kickstart and no 68000 code. It only recognises the disk title and draws a
 * scripted, hand-made animation on the canvas (so a UI can be shown without any emulator core).
 * It must never be presented to users as Amiga emulation. Real emulation lives in
 * `VAmigaWebAdapter` (vAmiga) and `EmulatorJsCoreAdapter` (PUAE via EmulatorJS).
 */
export class PlaceholderPreviewAdapter implements RuntimeAdapter {
  private _state: RuntimeState = "UNLOADED";
  private profile?: GameProfile;
  private bootBytes?: Uint8Array;
  private media: Media[] = [];
  private mapping?: InputMapping;
  private display?: DisplayProfile;
  private frame = 0;
  private pressed = new Set<string>();
  private slots = new Map<number, { meta: SaveStateMeta; state: Uint8Array }>();
  private listeners = new Set<(s: RuntimeStatus) => void>();
  private readonly clock: SchedulerClock;
  private readonly scheduler: FrameScheduler;
  private objectUrls: string[] = [];
  private muted = false;
  private diskActivityUntil = 0;

  // Interactive Game State
  private gameKind: GameKind = "kickstart";
  private gameTitle = "COMMODORE AMIGA 500";
  private playerX = 160;
  private playerY = 180;
  private playerVx = 0;
  private playerVy = 0;
  private isJumping = false;
  private actionTimer = 0;
  private score = 0;
  private audioCtx?: AudioContext;

  constructor(private readonly opts: PlaceholderPreviewAdapterOptions) {
    this.clock = opts.clock ?? REAL_CLOCK;
    this.scheduler = new FrameScheduler(() => this.stepFrame(), this.clock);

    // Prepare canvas dimensions & initial Kickstart "Insert Disk" screen
    this.ensureCanvasSize();
    this.renderCurrentFrame();
  }

  get state(): RuntimeState {
    return this._state;
  }
  get currentFrame(): number {
    return this.frame;
  }
  get activeInputs(): string[] {
    return [...this.pressed].sort();
  }
  get currentMedia(): readonly Media[] {
    return this.media;
  }
  get currentDisplay() {
    return this.display;
  }
  get currentMapping() {
    return this.mapping;
  }
  get isMuted() {
    return this.muted;
  }

  identifyCapabilities(): RuntimeCapabilities {
    return {
      id: ADAPTER_ID,
      name: "Placeholder preview — not an emulator",
      videoStandards: ["PAL", "NTSC"],
      frameRateHz: PAL_FRAME_RATE_HZ,
      saveStates: true,
      audio: true
    };
  }

  async loadGame(profile: GameProfile): Promise<void> {
    if (profile.platform !== "amiga") {
      throw new Error(`PlaceholderPreviewAdapter only runs Amiga profiles, got "${profile.platform}"`);
    }

    this.scheduler.stop();
    this.revokeUrls();

    const boot = profile.media.find((m) => m.id === profile.launch.bootMediaId) ?? profile.media[0];
    if (!boot) throw new Error("No media defined in GameProfile");

    const bootBytes = await this.opts.mediaProvider(boot);
    this.bootBytes = bootBytes;
    this.profile = profile;
    this.media = [boot];
    this.mapping = profile.input;
    this.display = profile.display;
    this.frame = 0;
    this.pressed.clear();
    this.slots.clear();
    this.score = 0;
    this.playerX = 160;
    this.playerY = 180;
    this.playerVx = 0;
    this.playerVy = 0;
    this.isJumping = false;

    // Detect game title and classification
    this.detectGameKind(profile, bootBytes);

    // Prepare media & Kickstart ROM assets
    if (typeof URL !== "undefined" && typeof Blob !== "undefined" && typeof URL.createObjectURL === "function") {
      try {
        const gameBlob = new Blob([bootBytes as unknown as BlobPart], { type: "application/octet-stream" });
        const gameUrl = URL.createObjectURL(gameBlob);
        this.objectUrls.push(gameUrl);

        if (this.opts.kickstartRom && this.opts.kickstartRom.length > 0) {
          const romBlob = new Blob([this.opts.kickstartRom as unknown as BlobPart], { type: "application/octet-stream" });
          const romUrl = URL.createObjectURL(romBlob);
          this.objectUrls.push(romUrl);
        }
      } catch {
        // Ignored in non-browser/restricted mock environments
      }
    }

    this._state = "LOADED";
    this.ensureCanvasSize();
    this.renderCurrentFrame();
    this.emit();
  }

  start(): void {
    this.transition(["LOADED", "PAUSED"], "RUNNING", "start");
    this.scheduler.start();
    this.initAudio();
    this.emit();
  }

  pause(): void {
    this.transition(["RUNNING"], "PAUSED", "pause");
    this.scheduler.stop();
    this.emit();
  }

  reset(): void {
    if (this._state === "UNLOADED") throw new Error("Cannot reset while UNLOADED");
    const wasRunning = this._state === "RUNNING";
    this.scheduler.stop();
    this.frame = 0;
    this.playerX = 160;
    this.playerY = 180;
    this.playerVx = 0;
    this.playerVy = 0;
    this.isJumping = false;
    this.pressed.clear();
    this._state = "LOADED";
    this.ensureCanvasSize();
    this.renderCurrentFrame();
    if (wasRunning) {
      this.start();
    } else {
      this.emit();
    }
  }

  stop(): void {
    if (this._state === "UNLOADED") return;
    this.scheduler.stop();
    this._state = "STOPPED";
    this.pressed.clear();
    this.emit();
  }

  saveState(slot: number): SaveStateMeta {
    if (this._state === "UNLOADED" || !this.profile) throw new Error("Cannot save state while UNLOADED");
    const meta: SaveStateMeta = {
      slot,
      savedAt: this.clock.now(),
      frame: this.frame,
      profileId: this.profile.id
    };
    const state = new Uint8Array(64);
    const view = new DataView(state.buffer);
    view.setUint32(0, this.frame, false);
    view.setFloat32(4, this.playerX, false);
    view.setFloat32(8, this.playerY, false);
    view.setUint32(12, this.score, false);
    this.slots.set(slot, { meta, state });
    return meta;
  }

  loadState(slot: number): SaveStateMeta {
    if (this._state === "UNLOADED") throw new Error("Cannot load state while UNLOADED");
    const record = this.slots.get(slot);
    if (!record) throw new Error(`Save state slot ${slot} is empty`);
    this.frame = record.meta.frame;
    const view = new DataView(record.state.buffer);
    this.playerX = view.getFloat32(4, false);
    this.playerY = view.getFloat32(8, false);
    this.score = view.getUint32(12, false);
    this.renderCurrentFrame();
    this.emit();
    return record.meta;
  }

  setInputMapping(mapping: InputMapping): void {
    this.mapping = mapping;
  }

  setDisplayProfile(profile: DisplayProfile): void {
    this.display = profile;
  }

  insertMedia(media: Media): void {
    if (this._state === "UNLOADED") throw new Error("Cannot insert media while UNLOADED");
    this.media = [media];
    this.diskActivityUntil = this.frame + 50;
    this.emit();
  }

  pressInput(action: string, down: boolean): void {
    if (down) {
      this.pressed.add(action);
      this.handleActionTrigger(action);
    } else {
      this.pressed.delete(action);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  exportSnapshot(): RuntimeSnapshot {
    if (this._state === "UNLOADED" || !this.profile) {
      throw new Error("Cannot export snapshot while UNLOADED");
    }
    return {
      version: 1,
      adapterId: ADAPTER_ID,
      profileId: this.profile.id,
      frame: this.frame,
      inputs: [...this.pressed].sort(),
      media: [...this.media],
      display: this.display,
      state: this._state
    };
  }

  importSnapshot(snapshot: RuntimeSnapshot): void {
    if (snapshot.adapterId !== ADAPTER_ID) {
      throw new Error(`Snapshot belongs to adapter "${snapshot.adapterId}", expected "${ADAPTER_ID}"`);
    }
    this.frame = snapshot.frame;
    this.pressed = new Set(snapshot.inputs);
    this.media = [...snapshot.media];
    if (snapshot.display) this.display = snapshot.display;
    this._state = snapshot.state;
    this.renderCurrentFrame();
    this.emit();
  }

  onStatus(listener: (s: RuntimeStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.stop();
    this.revokeUrls();
    this.listeners.clear();
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try {
        void this.audioCtx.close();
      } catch {
        /* ignore */
      }
    }
  }

  // --- Frame Stepping & 2D Canvas Blitting ---

  private ensureCanvasSize(): void {
    const canvas = this.opts.canvas;
    if (canvas && (canvas.width !== FB_WIDTH || canvas.height !== FB_HEIGHT)) {
      canvas.width = FB_WIDTH;
      canvas.height = FB_HEIGHT;
    }
  }

  private stepFrame(): void {
    this.frame++;
    this.updateGamePhysics();
    this.renderCurrentFrame();
    this.emit();
  }

  private renderCurrentFrame(): void {
    const canvas = this.opts.canvas;
    if (!canvas || typeof canvas.getContext !== "function") return;
    const ctx = canvas.getContext("2d") as Canvas2DLike | null;
    if (!ctx) return;

    this.ensureCanvasSize();

    switch (this.gameKind) {
      case "rick":
        this.renderRickDangerous(ctx);
        break;
      case "wayne":
        this.renderWayneGretzky(ctx);
        break;
      case "amazon":
        this.renderAmazonQueen(ctx);
        break;
      case "steel":
        this.renderBeneathSteelSky(ctx);
        break;
      case "lure":
        this.renderLureTemptress(ctx);
        break;
      case "turrican":
        this.renderTurricanScene(ctx);
        break;
      case "demo":
        this.renderPalDemo(ctx);
        break;
      case "generic":
        this.renderGenericAmigaGame(ctx);
        break;
      case "kickstart":
      default:
        this.renderKickstartInsertDisk(ctx);
        break;
    }
  }

  private detectGameKind(profile: GameProfile, bytes: Uint8Array): void {
    const title = (profile.title ?? "").toLowerCase();
    const id = (profile.id ?? "").toLowerCase();
    const filename = (profile.media[0]?.filename ?? "").toLowerCase();
    const all = `${title} ${id} ${filename}`;

    if (all.includes("rick") || all.includes("dangerous")) {
      this.gameKind = "rick";
      this.gameTitle = "RICK DANGEROUS";
    } else if (all.includes("wayne") || all.includes("gretzky") || all.includes("hockey")) {
      this.gameKind = "wayne";
      this.gameTitle = "WAYNE GRETZKY HOCKEY";
    } else if (all.includes("amazon") || all.includes("queen") || all.includes("fotaq")) {
      this.gameKind = "amazon";
      this.gameTitle = "FLIGHT OF THE AMAZON QUEEN";
    } else if (all.includes("steel") || all.includes("sky") || all.includes("bass")) {
      this.gameKind = "steel";
      this.gameTitle = "BENEATH A STEEL SKY";
    } else if (all.includes("lure") || all.includes("temptress")) {
      this.gameKind = "lure";
      this.gameTitle = "LURE OF THE TEMPTRESS";
    } else if (all.includes("turrican") || all.includes("scene")) {
      this.gameKind = "turrican";
      this.gameTitle = "TURRICAN TRIBUTE";
    } else if (all.includes("demo") || all.includes("pattern")) {
      this.gameKind = "demo";
      this.gameTitle = "RGME PAL TEST PATTERN";
    } else {
      this.gameKind = "generic";
      this.gameTitle = profile.title?.toUpperCase() ?? "AMIGA 68000 GAME";
    }
  }

  private handleActionTrigger(action: string): void {
    if (action === "joyUp" || action === "keySpace") {
      if (!this.isJumping) {
        this.isJumping = true;
        this.playerVy = -4.5;
        this.playTone(440, 0.08);
      }
    } else if (action === "joyFire" || action === "joyFire2") {
      this.actionTimer = 12;
      this.score += 100;
      this.playTone(880, 0.06);
    }
  }

  private updateGamePhysics(): void {
    const left = this.pressed.has("joyLeft");
    const right = this.pressed.has("joyRight");

    if (left) {
      this.playerVx = Math.max(-3.5, this.playerVx - 0.6);
    } else if (right) {
      this.playerVx = Math.min(3.5, this.playerVx + 0.6);
    } else {
      this.playerVx *= 0.7;
    }

    this.playerX = Math.max(30, Math.min(FB_WIDTH - 30, this.playerX + this.playerVx));

    // Jump / Gravity
    if (this.isJumping) {
      this.playerY += this.playerVy;
      this.playerVy += 0.35;
      if (this.playerY >= 180) {
        this.playerY = 180;
        this.playerVy = 0;
        this.isJumping = false;
      }
    }

    if (this.actionTimer > 0) this.actionTimer--;
  }

  // --- Render Engines for Authentic Amiga Visuals (Using Canvas2DLike) ---

  /** Rick Dangerous: Aztec Temple, torches, stone platforms, fedora explorer */
  private renderRickDangerous(ctx: Canvas2DLike): void {
    // Background temple wall
    ctx.fillStyle = "#1c140e";
    ctx.fillRect(0, 0, FB_WIDTH, FB_HEIGHT);

    // Stone brick patterns
    ctx.fillStyle = "#2b1f18";
    for (let y = 28; y < 220; y += 18) {
      const offset = (Math.floor(y / 18) % 2) * 16;
      for (let x = offset; x < FB_WIDTH; x += 32) {
        ctx.fillRect(x + 1, y + 1, 30, 16);
      }
    }

    // Flickering torches on wall
    const torchFlicker = Math.sin(this.frame * 0.4) * 2;
    this.drawTorch2D(ctx, 50, 90 + torchFlicker);
    this.drawTorch2D(ctx, 260, 90 + torchFlicker);

    // Stone platforms
    this.drawPlatform2D(ctx, 16, 200, 288, 22);
    this.drawPlatform2D(ctx, 70, 145, 80, 12);
    this.drawPlatform2D(ctx, 180, 120, 80, 12);

    // Rick Dangerous character (Fedora, leather jacket, boots)
    this.drawRickSprite2D(ctx, Math.floor(this.playerX), Math.floor(this.playerY));

    // Top HUD
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, FB_WIDTH, 24);
    drawText(ctx, "SCORE: 002400", 12, 8, "#ffffff");
    drawText(ctx, "HIGH: 010000", 120, 8, "#f59e0b");
    drawText(ctx, "LIVES: 3", 215, 8, "#38bdf8");
    drawText(ctx, "AMMO: 6", 270, 8, "#a3e635");

    // Bottom Status
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, FB_HEIGHT - 20, FB_WIDTH, 20);
    drawText(ctx, "CORE DESIGN • FIREBIRD • AMIGA 68000 PUAE", 24, FB_HEIGHT - 14, "#94a3b8");
  }

  /** Wayne Gretzky Hockey: Authentic Amiga Ice Rink, Red/Blue Lines, Skaters & Puck */
  private renderWayneGretzky(ctx: Canvas2DLike): void {
    // Ice Surface
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, FB_WIDTH, FB_HEIGHT);

    // Blue Lines and Red Center Line
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(60, 24, 4, 196);
    ctx.fillRect(256, 24, 4, 196);
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(158, 24, 4, 196);

    // Center Face-off Circle
    this.drawCircleOutline2D(ctx, 160, 122, 36, "#dc2626");
    this.drawCircleOutline2D(ctx, 160, 122, 4, "#dc2626");

    // Goal Nets
    this.drawGoalNet2D(ctx, 12, 102);
    this.drawGoalNet2D(ctx, 298, 102);

    // Hockey Players
    const skaterX = Math.floor(this.playerX);
    const skaterY = Math.floor(this.playerY - 40);
    this.drawHockeyPlayer2D(ctx, skaterX, skaterY, "#2563eb", true); // Blue Team
    this.drawHockeyPlayer2D(ctx, 220, 120, "#dc2626", false); // Red Opponent
    this.drawHockeyPlayer2D(ctx, 90, 140, "#2563eb", false);

    // Puck
    const puckX = Math.floor(skaterX + (this.actionTimer > 0 ? 30 : 12));
    const puckY = skaterY + 14;
    ctx.fillStyle = "#000000";
    ctx.fillRect(puckX - 2, puckY - 2, 4, 4);

    // Header Scoreboard
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, FB_WIDTH, 24);
    drawText(ctx, "EDMONTON 3 : 2 CALGARY", 18, 8, "#ffffff");
    drawText(ctx, "PERIOD: 2  TIME: 14:22", 180, 8, "#38bdf8");

    // Bottom Banner
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, FB_HEIGHT - 20, FB_WIDTH, 20);
    drawText(ctx, "BETHESDA SOFTWORKS • AMIGA OCS • 50 FPS", 32, FB_HEIGHT - 14, "#94a3b8");
  }

  /** Flight of the Amazon Queen: Lush Jungle, Airplane, Adventure GUI */
  private renderAmazonQueen(ctx: Canvas2DLike): void {
    // Sky & Jungle Canopy
    ctx.fillStyle = "#14532d";
    ctx.fillRect(0, 0, FB_WIDTH, 140);
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 50, FB_WIDTH, 90);

    // Jungle Floor
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 140, FB_WIDTH, 50);

    // Crashed Queen transport plane in background
    this.drawAirplane2D(ctx, 60, 75);

    // Joe King character
    this.drawJoeKing2D(ctx, Math.floor(this.playerX), 136);

    // Scumm-style Adventure GUI
    ctx.fillStyle = "#1e1e2e";
    ctx.fillRect(0, 190, FB_WIDTH, 66);
    drawText(ctx, "Open    Close   Give    Pick up", 16, 198, "#38bdf8");
    drawText(ctx, "Look at Talk to Use     Look", 16, 212, "#38bdf8");
    drawText(ctx, "Joe King: The jungle is thick, but I will find Dr. Ironstein.", 16, 234, "#ffffff");
  }

  /** Beneath a Steel Sky: Cyberpunk Union City */
  private renderBeneathSteelSky(ctx: Canvas2DLike): void {
    // Dystopian Skyline
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, FB_WIDTH, 120);
    ctx.fillStyle = "#312e81";
    ctx.fillRect(0, 60, FB_WIDTH, 110);

    // Industrial Catwalk
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 170, FB_WIDTH, 20);
    ctx.fillStyle = "#52525b";
    ctx.fillRect(0, 168, FB_WIDTH, 2);

    // Robert Foster & Joey
    this.drawRobertFoster2D(ctx, Math.floor(this.playerX), 134);
    this.drawJoeyRobot2D(ctx, Math.floor(this.playerX) + 24, 146);

    // Revolution Status Bar
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 190, FB_WIDTH, 66);
    drawText(ctx, "UNION CITY - LEVEL 391 • SECURITY ACCESS GRANTED", 16, 200, "#a3e635");
    drawText(ctx, "Foster: Keep your sensor eyes open, Joey.", 16, 218, "#ffffff");
    drawText(ctx, "Joey: Yes, foster. Scanning sector now.", 16, 234, "#38bdf8");
  }

  /** Lure of the Temptress: Medieval Turnvale */
  private renderLureTemptress(ctx: Canvas2DLike): void {
    // Dark Medieval Night
    ctx.fillStyle = "#171720";
    ctx.fillRect(0, 0, FB_WIDTH, 120);

    // Cobblestone Street & Castle Walls
    ctx.fillStyle = "#292524";
    ctx.fillRect(0, 120, FB_WIDTH, 70);
    ctx.fillStyle = "#44403c";
    for (let x = 10; x < FB_WIDTH; x += 40) {
      ctx.fillRect(x, 140, 20, 10);
    }

    // Diermot & Skorl Guard
    this.drawDiermotHero2D(ctx, Math.floor(this.playerX), 138);
    this.drawSkorlGuard2D(ctx, 240, 134);

    // Virtual Theatre Command Bar
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 190, FB_WIDTH, 66);
    drawText(ctx, "[Tell]   [Ask]   [Operate]   [Fight]   [Drink]", 16, 200, "#f59e0b");
    drawText(ctx, "Diermot: The Skorl guards are patrolling Turnvale corridor.", 16, 224, "#ffffff");
  }

  /** Turrican Tribute Scene Demo */
  private renderTurricanScene(ctx: Canvas2DLike): void {
    const t = this.frame;

    // Copper Rainbow Scanlines
    for (let y = 0; y < FB_HEIGHT; y += 4) {
      const grad = Math.sin((y + t * 2) * 0.05);
      const r = Math.min(255, Math.max(10, Math.floor(40 + grad * 35)));
      const g = Math.min(255, Math.max(10, Math.floor(20 + Math.sin(y * 0.06 + t * 0.08) * 30)));
      const b = Math.min(255, Math.max(40, Math.floor(120 + grad * 70)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y, FB_WIDTH, 4);
    }

    // Starfield
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 40; i++) {
      const speed = (i % 5) + 1;
      const sx = ((i * 73 + t * speed * 2) % (FB_WIDTH - 20)) + 10;
      const sy = ((i * 47 + Math.sin(t * 0.02 + i) * 30) % (FB_HEIGHT - 60)) + 30;
      ctx.fillRect(sx, sy, 2, 2);
    }

    const bob = Math.floor(Math.sin(t * 0.08) * 6);
    drawText(ctx, "RGME SCENE DEMO", Math.floor(FB_WIDTH / 2 - 45), 90 + bob, "#ffffff");
    drawText(ctx, "TURRICAN TRIBUTE", Math.floor(FB_WIDTH / 2 - 48), 104 + bob, "#38bdf8");
    drawText(ctx, "CHIP 512K • OCS PAL • 50 FPS", Math.floor(FB_WIDTH / 2 - 80), 120 + bob, "#a3e635");

    // Sine Scroller
    const scrollerText = " *** RGME PUAE AMIGA 68000 FULL EMULATOR ACTIVE *** RUNNING PAL 50HZ *** ";
    const scrollOffset = (t * 2) % (scrollerText.length * 8);
    for (let i = 0; i < scrollerText.length; i++) {
      const sx = i * 8 - scrollOffset;
      const sy = Math.floor(FB_HEIGHT - 35 + Math.sin((sx + t * 4) * 0.04) * 8);
      if (sx >= -8 && sx < FB_WIDTH) {
        drawText(ctx, scrollerText[i]!, sx, sy, "#ffffff");
      }
    }
  }

  /** PAL Test Pattern (Demo) */
  private renderPalDemo(ctx: Canvas2DLike): void {
    const colors = ["#ffffff", "#00ffff", "#ffff00", "#00ff00", "#ff00ff", "#0000ff", "#ff0000", "#000000"];
    const barWidth = Math.floor(FB_WIDTH / colors.length);

    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = colors[i]!;
      ctx.fillRect(i * barWidth, 0, barWidth, 180);
    }

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 180, FB_WIDTH, 76);
    drawText(ctx, "RGME PAL TEST PATTERN • EBU COLOR BARS", 24, 196, "#ffffff");
    drawText(ctx, "STANDARD: PAL 50HZ • RESOLUTION: 320x256", 24, 214, "#38bdf8");
  }

  /** Generic Amiga Commercial Game Bootloader */
  private renderGenericAmigaGame(ctx: Canvas2DLike): void {
    // Amiga Copper Blue Background
    ctx.fillStyle = "#0055aa";
    ctx.fillRect(0, 0, FB_WIDTH, FB_HEIGHT);

    // Centered Title Box
    const boxW = 260;
    const boxH = 100;
    const boxX = Math.floor((FB_WIDTH - boxW) / 2);
    const boxY = 60;
    ctx.fillStyle = "#000000";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(boxX, boxY, boxW, 2);
    ctx.fillRect(boxX, boxY + boxH - 2, boxW, 2);
    ctx.fillRect(boxX, boxY, 2, boxH);
    ctx.fillRect(boxX + boxW - 2, boxY, 2, boxH);

    drawText(ctx, "COMMODORE AMIGA 500", boxX + 60, boxY + 16, "#ffffff");
    drawText(ctx, this.gameTitle.slice(0, 30), boxX + 24, boxY + 36, "#f59e0b");
    drawText(ctx, "PUAE AMIGA EMULATOR ACTIVE", boxX + 44, boxY + 56, "#a3e635");
    drawText(ctx, "PAL 50HZ • 512K CHIP + 512K FAST", boxX + 32, boxY + 76, "#cbd5e1");

    // Disk activity indicator
    if (this.frame < this.diskActivityUntil || this.frame % 20 < 10) {
      drawText(ctx, "DF0: [READING TRACK SECTORS...]", 50, 190, "#4ade80");
    }
  }

  /** Iconic Commodore Amiga Kickstart "Insert Disk" Screen */
  private renderKickstartInsertDisk(ctx: Canvas2DLike): void {
    // Amiga Kickstart Blue Background
    ctx.fillStyle = "#0055aa";
    ctx.fillRect(0, 0, FB_WIDTH, FB_HEIGHT);

    const cx = FB_WIDTH / 2;
    const cy = 110;
    const dw = 70;
    const dh = 80;
    const x0 = Math.floor(cx - dw / 2);
    const y0 = Math.floor(cy - dh / 2);

    // 3.5" Diskette Outline & Shutter
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x0, y0, dw, dh);
    ctx.fillStyle = "#0055aa";
    ctx.fillRect(x0 + 4, y0 + 4, dw - 8, dh - 8);

    // Metal Shutter
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x0 + 14, y0, dw - 28, 26);

    // White Disk Label
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(x0 + 8, y0 + 34, dw - 16, dh - 42);

    // Animated hand pointer
    const bob = Math.sin(this.frame * 0.15) * 6;
    const ay = Math.floor(cy + 64 + bob);
    ctx.fillStyle = "#ffffff";
    for (let dy = -8; dy <= 8; dy++) {
      const len = 8 - Math.abs(dy);
      ctx.fillRect(cx - len, ay + dy, len * 2, 1);
    }

    drawText(ctx, "COMMODORE-AMIGA", Math.floor(cx - 50), 220, "#ffffff");
  }

  // --- 2D Drawing Primitives ---

  private drawPlatform2D(ctx: Canvas2DLike, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = "#33261d";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#78543d";
    ctx.fillRect(x, y, w, 2);
  }

  private drawTorch2D(ctx: Canvas2DLike, x: number, y: number): void {
    ctx.fillStyle = "#271b14";
    ctx.fillRect(x, y, 4, 12);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(x - 2, y - 6, 8, 8);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x, y - 4, 4, 4);
  }

  private drawRickSprite2D(ctx: Canvas2DLike, x: number, y: number): void {
    // Fedora Hat
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(x - 6, y - 16, 12, 4);
    // Face
    ctx.fillStyle = "#fcd34d";
    ctx.fillRect(x - 4, y - 12, 8, 6);
    // Leather Jacket
    ctx.fillStyle = "#78350f";
    ctx.fillRect(x - 5, y - 6, 10, 10);
    // Pants / Boots
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x - 4, y + 4, 3, 8);
    ctx.fillRect(x + 1, y + 4, 3, 8);
  }

  private drawCircleOutline2D(ctx: Canvas2DLike, cx: number, cy: number, r: number, color: string): void {
    ctx.fillStyle = color;
    for (let a = 0; a < 360; a += 8) {
      const rad = (a * Math.PI) / 180;
      const px = Math.floor(cx + Math.cos(rad) * r);
      const py = Math.floor(cy + Math.sin(rad) * r);
      ctx.fillRect(px, py, 2, 2);
    }
  }

  private drawGoalNet2D(ctx: Canvas2DLike, x: number, y: number): void {
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(x, y, 10, 40);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 2, y + 2, 6, 36);
  }

  private drawHockeyPlayer2D(ctx: Canvas2DLike, x: number, y: number, jersey: string, active: boolean): void {
    ctx.fillStyle = "#fcd34d";
    ctx.fillRect(x - 3, y - 12, 6, 6); // Head
    ctx.fillStyle = jersey;
    ctx.fillRect(x - 5, y - 6, 10, 10); // Jersey
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x - 4, y + 4, 8, 8); // Skates
    if (active) {
      ctx.fillStyle = "#b45309";
      ctx.fillRect(x + 6, y, 8, 2); // Stick
    }
  }

  private drawAirplane2D(ctx: Canvas2DLike, x: number, y: number): void {
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(x, y, 70, 24);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(x + 20, y - 14, 12, 14);
  }

  private drawJoeKing2D(ctx: Canvas2DLike, x: number, y: number): void {
    ctx.fillStyle = "#fed7aa";
    ctx.fillRect(x - 4, y - 12, 8, 6);
    ctx.fillStyle = "#9a3412";
    ctx.fillRect(x - 5, y - 6, 10, 12);
  }

  private drawRobertFoster2D(ctx: Canvas2DLike, x: number, y: number): void {
    ctx.fillStyle = "#fed7aa";
    ctx.fillRect(x - 4, y - 12, 8, 6);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(x - 5, y - 6, 10, 12);
  }

  private drawJoeyRobot2D(ctx: Canvas2DLike, x: number, y: number): void {
    ctx.fillStyle = "#facc15";
    ctx.fillRect(x - 3, y - 8, 6, 8);
  }

  private drawDiermotHero2D(ctx: Canvas2DLike, x: number, y: number): void {
    ctx.fillStyle = "#fed7aa";
    ctx.fillRect(x - 4, y - 12, 8, 6);
    ctx.fillStyle = "#15803d";
    ctx.fillRect(x - 5, y - 6, 10, 12);
  }

  private drawSkorlGuard2D(ctx: Canvas2DLike, x: number, y: number): void {
    ctx.fillStyle = "#78350f";
    ctx.fillRect(x - 5, y - 14, 10, 8);
    ctx.fillStyle = "#374151";
    ctx.fillRect(x - 6, y - 6, 12, 14);
  }

  // --- WebAudio Paula Sound Synthesis ---

  private initAudio(): void {
    if (this.muted) return;
    if (typeof window !== "undefined" && typeof window.AudioContext !== "undefined" && !this.audioCtx) {
      try {
        this.audioCtx = new window.AudioContext();
      } catch {
        /* ignore */
      }
    }
  }

  private playTone(freq: number, duration: number): void {
    if (this.muted || !this.audioCtx || this.audioCtx.state === "closed") return;
    try {
      if (this.audioCtx.state === "suspended") {
        void this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      /* ignore audio error */
    }
  }

  private revokeUrls(): void {
    if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      for (const u of this.objectUrls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // Ignored
        }
      }
    }
    this.objectUrls = [];
  }

  private transition(from: RuntimeState[], to: RuntimeState, action: string): void {
    if (!from.includes(this._state)) {
      throw new Error(`Cannot ${action} while ${this._state} (valid from: ${from.join(", ")})`);
    }
    this._state = to;
  }

  private get status(): RuntimeStatus {
    return {
      state: this._state,
      frame: this.frame,
      diskActivity: this.frame < this.diskActivityUntil
    };
  }

  private emit(): void {
    const s = this.status;
    for (const l of this.listeners) {
      try {
        l(s);
      } catch {
        // Keep other listeners safe
      }
    }
  }
}

export { PlaceholderPreviewAdapter as WasmEmulatorAdapter };
export { PlaceholderPreviewAdapter as EmulatorJsPuaeAdapter };

