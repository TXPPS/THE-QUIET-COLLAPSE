import { DisposeBag } from '@/core/DisposeBag';
import { GameLoop } from '@/core/GameLoop';
import { DeviceCapabilityService } from '@/device/DeviceCapabilityService';
import { DISTRICT_LEVEL } from '@/game/level/districtLevel';
import type { DocumentDef } from '@/game/level/types';
import { GameSession } from '@/game/GameSession';
import { PISTOL } from '@/config/gameplay';
import { resolveEnemyStats } from '@/config/enemies';
import { createNewRun, validateRunState } from '@/game/sim/runState';
import type { RunState } from '@/game/sim/types';
import { InputManager } from '@/input/InputManager';
import { SaveSystem } from '@/persistence/SaveSystem';
import { SettingsStore } from '@/persistence/SettingsStore';
import type { Settings } from '@/persistence/settingsSchema';
import { AssetLibrary } from '@/assets/AssetLibrary';
import { assetFile, assetKeys, hasAsset } from '@/assets/manifest';
import { RecastNavigation } from '@/game/nav/RecastNavigation';
import { CharacterAssets } from '@/render/character/CharacterAssets';
import { AudioEngine } from '@/audio/AudioEngine';
import { SampleBank } from '@/audio/SampleBank';
import { PromptSprite } from '@/ui/PromptSprite';
import { GameAudio } from '@/audio/GameAudio';
import { AutoQuality } from '@/render/AutoQuality';
import { Vector2 } from 'three';
import type { FrameStats } from '@/core/GameLoop';
import { GameView } from '@/render/GameView';
import { MenuBackdrop } from '@/render/MenuBackdrop';
import { ServiceWorkerClient } from './ServiceWorkerClient';
import { ShellNotices } from './ShellNotices';
import { PointerLockController } from './PointerLockController';
import { ErrorGuard } from './ErrorGuard';
import { DebugOverlay } from './DebugOverlay';
import { ServiceWorkerClient as SwClient } from './ServiceWorkerClient';
import { QUALITY_PROFILES, Renderer, isWebGLAvailable } from '@/render/Renderer';
import { Hud } from '@/ui/hud/Hud';
import { Prompts } from '@/ui/Prompts';
import { ScreenManager } from '@/ui/ScreenManager';
import { Toasts } from '@/ui/Toasts';
import { BootScreen } from '@/ui/screens/BootScreen';
import { ChooseControlsScreen } from '@/ui/screens/ChooseControlsScreen';
import { ControllerTestScreen } from '@/ui/screens/ControllerTestScreen';
import { RemapScreen } from '@/ui/screens/RemapScreen';
import { ConfirmDialog, type ConfirmOptions } from '@/ui/screens/ConfirmDialog';
import { CreditsScreen } from '@/ui/screens/CreditsScreen';
import { DocumentScreen } from '@/ui/screens/DocumentScreen';
import { EndingScreen } from '@/ui/screens/EndingScreen';
import { ErrorScreen } from '@/ui/screens/ErrorScreen';
import { GameOverScreen } from '@/ui/screens/GameOverScreen';
import { InventoryScreen } from '@/ui/screens/InventoryScreen';
import { MainMenuScreen } from '@/ui/screens/MainMenuScreen';
import { MapScreen } from '@/ui/screens/MapScreen';
import { OptionsScreen } from '@/ui/screens/OptionsScreen';
import { PauseScreen } from '@/ui/screens/PauseScreen';
import { SlotSelectScreen, type SlotMode } from '@/ui/screens/SlotSelectScreen';
import { TouchLayoutEditorScreen } from '@/ui/screens/TouchLayoutEditorScreen';
import { WarningScreen } from '@/ui/screens/WarningScreen';
import type { ProfileKind, TouchProfile, TouchProfiles } from '@/ui/touch/touchProfiles';
import { createLayers, type Layers } from './layers';
import { TouchShell } from './TouchShell';


const DEBUG_SIZE = new Vector2();

/* eslint-disable max-lines -- composition root: wiring and screen flow only; logic lives in the
   extracted controllers (TouchShell, ShellNotices, PointerLockController, ErrorGuard, layers). */

/**
 * Composition root and screen flow. Owns every long-lived service; the GameSession is the only
 * thing created and destroyed per run.
 */
export class App {
  readonly settings = new SettingsStore();
  readonly input: InputManager;
  readonly device: DeviceCapabilityService;
  readonly saves = new SaveSystem<RunState>(validateRunState);
  readonly screens: ScreenManager;
  readonly prompts: Prompts;
  readonly toasts: Toasts;
  readonly layers: Layers;
  readonly loop: GameLoop;
  renderer: Renderer | null = null;
  assets: AssetLibrary | null = null;
  characters: CharacterAssets | null = null;
  /** Baked district navmesh bytes; null keeps the grid A* (headless behaviour). */
  private navBytes: ArrayBuffer | null = null;
  hud: Hud | null = null;
  session: GameSession | null = null;
  readonly touch: TouchShell;
  readonly audio: AudioEngine;
  private gameAudio: GameAudio | null = null;
  private samples: SampleBank | null = null;
  private backdrop: MenuBackdrop | null = null;
  private readonly autoQuality = new AutoQuality();
  private readonly sw: ServiceWorkerClient;
  private readonly notices: ShellNotices;
  /** Number of sessions created since boot (diagnostics and tests). */
  sessionsStarted = 0;
  private readonly bag = new DisposeBag();
  private fatal = false;
  private tierSuggested = false;
  private hiResRequested = false;
  private readonly pointerLock = new PointerLockController({
    canvas: () => this.renderer?.canvas ?? null,
    wantsLock: () => this.session !== null && this.screens.depth === 0 && this.input.registry.activeFamily === 'keyboard',
    onLockLost: () => this.pause(),
  });
  private readonly errors = new ErrorGuard((reason) => this.onErrorBurst(reason));
  private debug: DebugOverlay | null = null;

  constructor(private readonly root: HTMLElement) {
    this.layers = createLayers(root);
    this.input = new InputManager(this.settings);
    this.device = new DeviceCapabilityService();
    this.touch = new TouchShell(this.layers.touch, this.layers.system, this.input, this.device);
    this.audio = new AudioEngine(this.settings.get().audio);
    this.toasts = new Toasts(this.layers.toast);
    this.notices = new ShellNotices(this.audio, this.toasts);
    this.sw = new ServiceWorkerClient({
      onUpdateReady: (apply) => this.notices.offerUpdate(apply),
      onOffline: () => this.notices.offline(),
      onOnline: () => this.notices.online(),
    });
    this.prompts = new Prompts(this.input.glyphs);
    this.screens = new ScreenManager(this.layers.screens, this.layers.modal, this.input);
    this.loop = new GameLoop({
      beginFrame: (dt) => this.input.update(dt),
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      update: (dt, alpha) => this.update(dt, alpha),
      render: () => this.render(),
    });
    this.applySettings(this.settings.get());
    this.settings.events.on('change', ({ settings }) => this.applySettings(settings));
    this.screens.events.on('changed', ({ depth }) => this.onScreensChanged(depth));
    this.screens.events.on('feedback', ({ kind }) => this.notices.playUi(kind));
    this.bag.listen(document, 'visibilitychange', () => this.onVisibility());
    this.bag.listen(window, 'resize', () => this.renderer?.resize());
    this.prompts.onActivate = (action) => this.activatePrompt(action);
    this.device.events.on('change', () => this.onDeviceChanged());
    this.input.registry.events.on('gamepadConnected', ({ source }) => this.onGamepadConnected(source.label));
    // Touch controls follow the active source: hide under a pad or keyboard, return on the first touch.
    this.input.registry.events.on('activeChanged', () => this.updateOverlays());
    this.input.registry.events.on('primaryLost', ({ source }) => this.onPrimaryLost(source.label));
    this.touch.onLookHintUsed = () => this.settings.update({ meta: { touchLookHintSeen: true } });
  }

  /* ---------- boot ---------- */

  async boot(): Promise<void> {
    const boot = new BootScreen(this);
    this.screens.reset(boot);
    this.loop.start();
    boot.setProgress(0.1, 'Checking the display');
    if (!isWebGLAvailable()) {
      this.showFatal('This browser cannot run the game', 'WebGL is unavailable. Try a current version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
      return;
    }
    try {
      boot.setProgress(0.4, 'Starting the renderer');
      this.renderer = new Renderer(this.root, this.settings.get().video.quality !== 'low');
      this.input.keyboardMouse.lockTarget = this.renderer.canvas;
      this.bag.listen(this.renderer.canvas, 'click', () => this.pointerLock.request());
      this.hud = new Hud(this.layers.hud, this.prompts);
      this.hud.setVisible(false);
      this.onDeviceChanged();
      this.applySettings(this.settings.get());
      this.assets = new AssetLibrary(this.renderer.three);
      this.characters = new CharacterAssets(this.assets);
      await this.preloadAssets(boot);
      boot.setProgress(1, 'Ready');
      if (this.settings.loadStatus === 'recovered') this.toasts.show('Settings were reset after unreadable data was found', 'warning', 6);
      if (this.settings.get().meta.warningsAccepted) this.showMainMenu();
      else this.screens.reset(new WarningScreen(this));
      this.debug = new DebugOverlay(this.layers.system, () => this.loop.resetStats());
      this.debug.onSpawnRays = (visible) => this.session?.view.setSpawnRays(visible);
      this.debug.onSocket = (item, socket) => this.session?.view.setSocket(item, socket);
      if (import.meta.env.PROD) {
        const bypassed = await SwClient.bypassIfRequested();
        if (bypassed) this.toasts.show('Caches cleared: fresh load', 'info', 4);
        void this.sw.register();
      }
    } catch (error) {
      boot.showFailure(`Startup failed: ${error instanceof Error ? error.message : String(error)}`, () => void this.boot());
    }
  }

  /** Loads every precached asset with progress; failures fall back to placeholders and are logged once. */
  private async preloadAssets(boot: BootScreen): Promise<void> {
    const assets = this.assets;
    if (!assets) return;
    const keys = assetKeys('', true);
    const failures = await assets.preload(keys, ({ ratio, key }) => boot.setProgress(0.5 + ratio * 0.45, `Loading ${key.split('.')[0]}`));
    await this.characters?.load();
    await this.loadNavigation(assets);
    await this.renderer?.applyEnvironment(assets);
    await this.installPrompts(assets);
    this.samples = new SampleBank(assets);
    this.notices.samples = this.samples;
    const samples = this.samples;
    this.audio.onUnlocked((ctx) => void samples.decodePrecached(ctx));
    if (failures.length > 0) console.warn(`[tqc] ${failures.length} asset(s) failed to load; placeholders in use:`, failures.join(', '));
    if (this.characters?.failure) console.warn(`[tqc] character assets unavailable: ${this.characters.failure}`);
  }

  /** Kenney prompt icons: the sprite goes into the DOM and every chip re-renders with its icon. */
  private async installPrompts(assets: AssetLibrary): Promise<void> {
    if (!hasAsset('ui.prompts')) return;
    try {
      if (PromptSprite.install(await assets.text('ui.prompts'))) this.prompts.refreshAll();
    } catch {
      // Text chips remain.
    }
  }

  private async loadNavigation(assets: AssetLibrary): Promise<void> {
    if (!hasAsset('nav.district')) return;
    try {
      await RecastNavigation.ensureInit();
      this.navBytes = await assets.bytes('nav.district');
    } catch (error) {
      console.warn('[tqc] navmesh unavailable, using grid pathing:', error);
      this.navBytes = null;
    }
  }

  /** Crowd navigation for a fresh world, or null when the bake is stale or missing. */
  private createNavigation(): RecastNavigation | null {
    if (!this.navBytes) return null;
    const signature = (assetFile('nav.district') as { signature?: string }).signature ?? '';
    const navigation = RecastNavigation.fromBytes(this.navBytes.slice(0), DISTRICT_LEVEL, signature);
    if (!navigation) console.warn('[tqc] navmesh signature does not match the level; run pnpm assets:build');
    return navigation;
  }

  /* ---------- flow ---------- */

  showMainMenu(): void {
    this.ensureBackdrop();
    this.screens.reset(new MainMenuScreen(this));
  }

  private ensureBackdrop(): void {
    if (this.backdrop || !this.renderer || this.session) return;
    this.backdrop = new MenuBackdrop(this.renderer, DISTRICT_LEVEL, () => this.reducedMotion(), this.assets);
  }

  private reducedMotion(): boolean {
    const pref = this.settings.get().accessibility.reducedMotion;
    return pref === 'on' || (pref === 'system' && this.device.get().reducedMotionSystem);
  }

  openSlotSelect(mode: SlotMode): void {
    this.screens.push(new SlotSelectScreen(this, mode));
  }

  openOptions(): void {
    this.screens.push(new OptionsScreen(this));
  }

  openCredits(): void {
    this.screens.push(new CreditsScreen(this, 'credits'));
  }

  openLegal(): void {
    this.screens.push(new CreditsScreen(this, 'legal'));
  }

  openInventory(): void {
    if (this.session) this.screens.push(new InventoryScreen(this));
  }

  openMap(): void {
    if (this.session) this.screens.push(new MapScreen(this));
  }

  openControlsChooser(fromOptions: boolean): void {
    if (this.screens.has('chooseControls')) return;
    this.screens.push(new ChooseControlsScreen(this, () => (fromOptions ? this.screens.pop() : this.afterChooser())));
  }

  /** Called when the chooser closes during play; returns to the game unless another screen is open. */
  private afterChooser(): void {
    this.screens.pop();
    if (this.session && this.screens.depth === 0) this.pointerLock.request();
  }

  openRemap(): void {
    this.screens.push(new RemapScreen(this));
  }

  openControllerTest(): void {
    this.screens.push(new ControllerTestScreen(this));
  }

  openTouchEditor(): void {
    this.screens.push(new TouchLayoutEditorScreen(this));
  }

  /* ---------- touch ---------- */

  get touchProfiles(): TouchProfiles {
    return this.touch.profiles;
  }

  touchProfileKind(): ProfileKind {
    return this.touch.profileKind();
  }

  saveTouchProfile(kind: ProfileKind, profile: TouchProfile): void {
    this.touch.saveProfile(kind, profile);
  }

  private onDeviceChanged(): void {
    this.touch.syncDevice();
    this.updateOverlays();
  }

  private updateOverlays(): void {
    const inGame = this.session !== null && this.screens.depth === 0;
    if (this.touch.updateOverlays(this.session !== null, inGame)) this.pause();
  }

  /** Footer prompt chips are tappable: touch players get Back/Confirm without a keyboard. */
  private activatePrompt(action: string): void {
    const top = this.screens.top;
    if (!top) return;
    if (action === 'Cancel') this.screens.cancel();
    else if (action === 'Confirm') top.onConfirm();
    else if (action === 'TabPrev') top.onTabPrev();
    else if (action === 'TabNext') top.onTabNext();
  }

  confirm(options: ConfirmOptions): void {
    this.screens.pushModal(new ConfirmDialog(this, options));
  }

  showDocument(document: DocumentDef): void {
    this.screens.push(new DocumentScreen(this, document));
  }

  newGame(slot: number): void {
    const difficulty = this.settings.get().meta.difficulty;
    this.startSession(createNewRun(DISTRICT_LEVEL, difficulty), slot);
  }

  continueGame(): void {
    const recent = this.saves.mostRecentSlot();
    if (recent) this.loadSlot(recent.slot);
  }

  loadSlot(slot: number): void {
    const file = this.saves.load(slot);
    if (!file) {
      this.toasts.show('That save could not be read', 'danger', 4);
      return;
    }
    if (file.run.completed) {
      this.confirm({
        title: 'This run is complete',
        body: 'Start a new run in this slot? The completed run will be replaced.',
        confirmLabel: 'New run',
        onConfirm: () => this.newGame(slot),
      });
      return;
    }
    this.startSession(file.run, slot);
  }

  restartFromCheckpoint(): void {
    const slot = this.session?.slot ?? this.settings.get().meta.lastSlot ?? 1;
    const file = this.saves.load(slot);
    if (file) this.startSession(file.run, slot);
    else this.newGame(slot);
  }

  /** Manual save from the radio: the run continues in the chosen slot from here on. */
  saveToSlot(slot: number): boolean {
    if (!this.session) return false;
    this.session.slot = slot;
    this.settings.update({ meta: { lastSlot: slot } });
    const ok = this.session.save('manual');
    this.toasts.show(ok ? `Saved to slot ${slot}` : 'Saving failed (storage unavailable)', ok ? 'info' : 'danger', 3);
    this.screens.pop();
    return ok;
  }

  pause(): void {
    if (!this.session || this.screens.depth > 0) return;
    this.screens.push(new PauseScreen(this));
  }

  resume(): void {
    this.screens.clear();
    this.pointerLock.request();
  }

  quitToMenu(): void {
    this.endSession();
    this.showMainMenu();
  }

  private startSession(runState: RunState, slot: number): void {
    this.endSession();
    this.backdrop?.dispose();
    this.backdrop = null;
    const renderer = this.renderer;
    const hud = this.hud;
    if (!renderer || !hud) return;
    this.settings.update({ meta: { lastSlot: slot } });
    this.sessionsStarted += 1;
    this.session = new GameSession({
      level: DISTRICT_LEVEL,
      reducedMotion: () => this.reducedMotion(),
      runState,
      slot,
      input: this.input,
      settings: this.settings,
      saves: this.saves,
      renderer,
      toasts: this.toasts,
      hud,
      createView: (world) => new GameView(renderer, world, this.characters, this.assets),
      host: {
        onGameOver: () => this.screens.reset(new GameOverScreen(this)),
        onEnding: () => {
          this.session?.save('checkpoint');
          this.screens.reset(new EndingScreen(this));
        },
        onDocument: (document) => this.screens.push(new DocumentScreen(this, document)),
        onSaveRequest: () => this.openSlotSelect('save'),
      },
    });
    this.session.world.setNavigation(this.createNavigation());
    this.gameAudio = new GameAudio(this.audio, this.session.world, this.samples, { caption: (text, seconds) => hud.showCaption(text, seconds ?? 2) }, () => this.settings.get().audio.subtitles);
    this.autoQuality.reset();
    if (runState.checkpointId === 'start' && runState.playtimeSec < 1) this.session.save('checkpoint');
    if (this.debug?.spawnRays) this.session.view.setSpawnRays(true);
    hud.setVisible(true);
    this.screens.clear();
    this.loop.resetClock();
    this.updateOverlays();
    this.pointerLock.request();
  }

  private endSession(): void {
    if (!this.session) return;
    this.gameAudio?.dispose();
    this.gameAudio = null;
    this.session.dispose();
    this.session = null;
    this.hud?.setVisible(false);
    this.touch.hide();
    this.toasts.clear();
    this.pointerLock.release();
  }

  /**
   * Test/debug hook: advances the simulation by `seconds` synchronously using the same fixed-step
   * path as the frame loop (input state as last sampled). Only reachable through window.__tqc.
   */
  debugAdvance(seconds: number): void {
    const steps = Math.max(1, Math.round(seconds * 60));
    this.input.update(1 / 60);
    for (let i = 0; i < steps; i += 1) {
      this.fixedUpdate(1 / 60);
      if (!this.session) break;
    }
    this.update(1 / 60, 0);
  }

  /* ---------- loop ---------- */

  private fixedUpdate(dt: number): void {
    const session = this.session;
    if (!session) {
      this.input.consumeGameEdges();
      return;
    }
    session.paused = this.screens.pausesGame;
    if (session.paused) {
      this.input.consumeGameEdges();
      return;
    }
    if (this.input.game.justPressed('Pause')) {
      this.input.consumeGameEdges();
      this.pause();
      return;
    }
    if (this.input.game.justPressed('Inventory') || this.input.game.justPressed('Map')) {
      const openMap = this.input.game.justPressed('Map');
      this.input.consumeGameEdges();
      if (openMap) this.openMap();
      else this.openInventory();
      return;
    }
    session.fixedUpdate(dt);
    this.input.consumeGameEdges();
  }

  private update(dt: number, alpha: number): void {
    this.screens.update(dt);
    const stats = this.loop.getStats();
    this.device.reportFrameTime(stats.medianMs);
    this.session?.update(dt, alpha, stats.fps);
    this.backdrop?.update(dt);
    if (this.debug?.visible) this.updateDebug(stats);
    this.gameAudio?.update(dt);
    if (this.session && !this.session.paused && this.settings.get().video.quality === 'auto' && this.autoQuality.update(dt, stats)) {
      this.applyRenderQuality(this.settings.get());
      this.loop.resetStats();
      if (this.autoQuality.scale <= 0.6 && !this.tierSuggested) {
        this.tierSuggested = true;
        this.toasts.show('Still slow at the lowest resolution — try Quality: Low in Options', 'warning', 6);
      }
    }
    if (this.session) {
      const p = this.session.world.player;
      this.touch.update(
        {
          fireVisible: p.equipped === 'pistol' || p.medkits > 0,
          canReload: p.equipped === 'pistol' && p.ammoLoaded < PISTOL.magazine && p.ammoReserve > 0,
          hasFlashlight: p.hasFlashlight,
          promptVisible: this.session.sim.prompt !== null,
        },
        dt,
      );
    }
  }

  private render(): void {
    if (!this.renderer) return;
    if (this.session || this.backdrop) this.renderer.render();
  }

  /* ---------- environment ---------- */

  private applySettings(s: Settings): void {
    const root = document.documentElement;
    root.style.setProperty('--tqc-text-scale', String(s.accessibility.textScale));
    root.style.setProperty('--tqc-hud-scale', s.accessibility.largeHud ? '1.25' : '1');
    root.dataset['highContrast'] = String(s.accessibility.highContrastUi);
    root.dataset['reducedMotion'] = s.accessibility.reducedMotion === 'system' ? '' : String(s.accessibility.reducedMotion === 'on');
    root.dataset['colorSafe'] = String(s.accessibility.colorSafeHud);
    this.screens.setRepeat(s.controls.menuRepeatDelay, s.controls.menuRepeatRate);
    this.touch.setTuning({ deadZone: s.controls.touchDeadZone, sprintThreshold: s.controls.touchSprintThreshold, sprintLock: s.controls.touchSprintLock });
    this.touch.setLookControl(s.controls.touchLookControl);
    this.touch.setLookHint(!s.meta.touchLookHintSeen);
    this.audio.applySettings(s.audio);
    this.applyRenderQuality(s);
    this.updateOverlays();
  }

  private updateDebug(stats: FrameStats): void {
    const buffer = this.renderer ? this.renderer.three.getDrawingBufferSize(DEBUG_SIZE) : DEBUG_SIZE.set(0, 0);
    const top = this.screens.top;
    this.debug?.update(performance.now(), {
      stats,
      bufferWidth: Math.round(buffer.x),
      bufferHeight: Math.round(buffer.y),
      cssWidth: window.innerWidth,
      cssHeight: window.innerHeight,
      renderScale: this.settings.get().video.quality === 'auto' ? this.autoQuality.scale : 1,
      inputSource: `${this.input.registry.activeSource?.label ?? 'none'} (${this.input.registry.currentPolicy})`,
      touchPointers: Array.from(this.touch.hud?.ownedPointers ?? [], ([id, owner]) => `${id}:${owner}`).join(' '),
      swState: this.sw.state,
      online: navigator.onLine,
      nav: this.session ? (this.session.world.navigation ? `crowd (${this.session.world.navigation.agentCount} agents)` : 'grid A*') : '-',
      scene: top ? top.id : this.session ? `gameplay / ${this.session.world.currentObjective()?.id ?? '-'}` : 'idle',
      difficulty: this.describeDifficulty(),
    });
  }

  /** Preset in force (the run's when one is active, otherwise the setting) with the resolved enemy numbers. */
  private describeDifficulty(): string {
    const preset = this.session ? this.session.world.difficulty : this.settings.get().meta.difficulty;
    const stats = resolveEnemyStats('affected', preset);
    return `${preset} (run ${stats.runSpeed.toFixed(2)} m/s, cooldown ${stats.attackCooldown.toFixed(1)} s, damage ${stats.damage})`;
  }

  private applyRenderQuality(s: Settings): void {
    if (!this.renderer) return;
    const tier = s.video.quality === 'auto' ? this.device.get().qualityHint : s.video.quality;
    const adaptive = s.video.quality === 'auto' ? this.autoQuality.scale : 1;
    this.renderer.setQuality(QUALITY_PROFILES[tier], s.video.resolutionScale * adaptive);
    this.renderer.setBrightness(s.video.brightness);
    if (tier === 'high') this.streamHiRes();
  }

  /**
   * High tier only: the 2K character maps and the 1K environment stream in after boot (never
   * precached). Offline or on failure the 1K set simply stays.
   */
  private streamHiRes(): void {
    if (this.hiResRequested || !this.assets || !navigator.onLine) return;
    this.hiResRequested = true;
    void this.characters?.applyHiRes();
    if (hasAsset('env.dusk.hi')) void this.renderer?.applyEnvironment(this.assets, 'env.dusk.hi');
  }

  /** A second viable source appeared: offer the chooser once, without interrupting a fight. */
  private onGamepadConnected(label: string): void {
    this.toasts.show(`${label} connected`, 'info', 3);
    if (this.settings.get().meta.controlsChooserSeen || this.fatal) return;
    if (this.session && this.screens.depth === 0) this.pause();
    this.openControlsChooser(false);
  }

  /** The locked primary device went away: pause safely and ask what to use next. */
  private onPrimaryLost(label: string): void {
    this.toasts.show(`${label} disconnected`, 'warning', 5);
    this.settings.update({ controls: { policy: 'auto', primarySource: null } });
    if (this.session && this.screens.depth === 0) this.pause();
    this.openControlsChooser(false);
  }

  private onScreensChanged(depth: number): void {
    if (depth > 0) this.pointerLock.release();
    this.hud?.setDimmed(depth > 0);
    this.audio.setDuck(depth > 0 && this.session ? 0.35 : 1);
    this.updateOverlays();
  }

  private onVisibility(): void {
    if (document.hidden) {
      if (this.session && this.screens.depth === 0) this.pause();
      return;
    }
    this.loop.resetClock();
  }

  /** Releases every long-lived service (tests and hot teardown). */
  dispose(): void {
    this.endSession();
    this.errors.dispose();
    this.pointerLock.dispose();
    this.input.dispose();
    this.device.dispose();
    this.audio.dispose();
    this.bag.dispose();
    this.loop.stop();
  }

  private onErrorBurst(reason: unknown): void {
    if (this.fatal) return;
    this.endSession();
    this.showFatal('Something went wrong', 'The game hit repeated errors and stopped to protect your saved progress. Reloading returns you to the menu.', reason instanceof Error ? reason.message : String(reason));
  }

  private showFatal(title: string, message: string, detail?: string): void {
    this.fatal = true;
    this.loop.stop();
    this.screens.reset(new ErrorScreen(title, message, detail));
  }
}
