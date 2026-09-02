import '@esotericsoftware/spine-pixi-v8'
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'

type OfficeEmployee = {
  id: string
  name: string
  role?: string
  status?: string
  task?: string
  progress?: number
}

type CharacterState = {
  id: string
  data: OfficeEmployee
  seat: { x: number; y: number }
  position: { x: number; y: number }
  container: Container
  spine: Spine
  nameLabel: Text
  stateLabel: Text
  statePlate: Graphics
  bubble: Container
  bubbleText: Text
  shadow: Graphics
  currentAnim: string
  facing: 'front' | 'back' | 'left' | 'right'
  motion: Motion | null
  selected: boolean
}

type Motion = {
  phase: 'toHost' | 'talk' | 'return'
  elapsed: number
  duration: number
  from: { x: number; y: number }
  target: { x: number; y: number }
  visitorId: string
  hostId: string
}

const SCENE_WIDTH = 1000
const SCENE_HEIGHT = 800
const OFFICE_ASSET_ALIASES = [
  'ai-office-background',
  'ai-office-desk',
  'ai-office-chair',
  'ai-office-chibi-skeleton',
  'ai-office-chibi-atlas',
] as const
const OFFICE_ASSET_BASE = (() => {
  const script = document.currentScript
  const scriptUrl = script instanceof HTMLScriptElement ? script.src : ''
  return new URL('./', scriptUrl || document.baseURI)
})()
const SKINS = ['misaki', 'erikari', 'nate', 'harri', 'luke', 'soeren', 'mario', 'sinisa', 'spineboy']
const DESKS = [
  { x: 275, y: 402 },
  { x: 500, y: 402 },
  { x: 725, y: 402 },
  { x: 320, y: 610 },
  { x: 565, y: 610 },
  { x: 810, y: 610 },
]
const STATUS = {
  coordinating: { label: '协调中', color: 0x7654b8 },
  working: { label: '工作中', color: 0x178577 },
  waiting: { label: '需要你', color: 0xd18437 },
  learning: { label: '学习中', color: 0x4c79ba },
  paused: { label: '已暂停', color: 0x7d8992 },
  auth: { label: '授权异常', color: 0xbf5a52 },
} as const

let officeAssetsReady = false
let officeAssetsPromise: Promise<void> | null = null
let officeAssetsRegistered = false
let officeAssetRevision = 0

function officeAssetUrl(path: string, revision = 0) {
  const url = new URL(path, OFFICE_ASSET_BASE)
  if (revision > 0) url.searchParams.set('office-retry', String(revision))
  return url.href
}

function registerAssets(force = false) {
  if (officeAssetsRegistered && !force) return
  Assets.add({ alias: 'ai-office-background', src: officeAssetUrl('office/office.png', officeAssetRevision) })
  Assets.add({ alias: 'ai-office-desk', src: officeAssetUrl('office/desk.png', officeAssetRevision) })
  Assets.add({ alias: 'ai-office-chair', src: officeAssetUrl('office/chair.png', officeAssetRevision) })
  Assets.add({ alias: 'ai-office-chibi-skeleton', src: officeAssetUrl('characters/chibi-stickers/chibi-stickers.json', officeAssetRevision) })
  Assets.add({ alias: 'ai-office-chibi-atlas', src: officeAssetUrl('characters/chibi-stickers/chibi-stickers.atlas', officeAssetRevision) })
  officeAssetsRegistered = true
}

function prepareFreshAssetAttempt() {
  officeAssetRevision += 1
  officeAssetsPromise = null
  registerAssets(true)
}

async function loadAssets() {
  if (officeAssetsReady) return
  if (officeAssetsPromise) return officeAssetsPromise
  registerAssets()
  officeAssetsPromise = (async () => {
    await Assets.load([...OFFICE_ASSET_ALIASES])
    officeAssetsReady = true
  })().catch((error) => {
    // A transient request must not poison every later mount attempt.
    officeAssetsPromise = null
    throw error
  })
  return officeAssetsPromise
}

async function loadAssetsWithRetry() {
  try {
    await loadAssets()
  } catch (firstError) {
    await Promise.allSettled(OFFICE_ASSET_ALIASES.map((alias) => Assets.unload(alias)))
    await new Promise((resolve) => window.setTimeout(resolve, 500))
    // Some browsers briefly cache failed HTTP responses; a fresh URL guarantees a real retry.
    prepareFreshAssetAttempt()
    try {
      await loadAssets()
    } catch (retryError) {
      throw new AggregateError([firstError, retryError], 'Office assets failed after retry')
    }
  }
}

function statusMeta(status?: string) {
  return STATUS[status as keyof typeof STATUS] ?? STATUS.learning
}

function animationFor(state: CharacterState, animation: 'idle' | 'walking' | 'talking' | 'thinking') {
  const facing = state.facing
  if (animation === 'walking') {
    return facing === 'left' ? 'movement/trot-left' : facing === 'right' ? 'movement/trot-right' : facing === 'back' ? 'movement/trot-back' : 'movement/trot-front'
  }
  if (animation === 'talking') return 'emotes/wave'
  if (animation === 'thinking') return 'emotes/thinking'
  return facing === 'left' ? 'movement/idle-left' : facing === 'right' ? 'movement/idle-right' : facing === 'back' ? 'movement/idle-back' : 'movement/idle-front'
}

function playAnimation(state: CharacterState, animation: 'idle' | 'walking' | 'talking' | 'thinking') {
  const name = animationFor(state, animation)
  if (state.currentAnim === name) return
  if (!state.spine.skeleton.data.findAnimation(name)) return
  state.currentAnim = name
  const entry = state.spine.state.setAnimation(0, name, true)
  if (entry) entry.mixDuration = 0.16
  state.spine.state.timeScale = animation === 'walking' ? 1.18 : 1
}

function setFacing(state: CharacterState, facing: CharacterState['facing']) {
  if (state.facing === facing) return
  state.facing = facing
  playAnimation(state, state.motion ? 'walking' : 'idle')
}

function statusText(state: CharacterState) {
  const meta = statusMeta(state.data.status)
  state.stateLabel.text = meta.label
  state.stateLabel.style.fill = meta.color
  state.statePlate.clear()
  state.statePlate.roundRect(-42, -9, 84, 18, 9)
  state.statePlate.fill({ color: 0xffffff, alpha: 0.94 })
  state.statePlate.stroke({ color: meta.color, width: 1, alpha: 0.55 })
}

function createBubble() {
  const bubble = new Container()
  const plate = new Graphics()
  plate.roundRect(-105, -28, 210, 42, 12)
  plate.fill({ color: 0x182a31, alpha: 0.93 })
  plate.stroke({ color: 0xffffff, width: 1, alpha: 0.2 })
  const tail = new Graphics()
  tail.moveTo(-8, 14)
  tail.lineTo(0, 23)
  tail.lineTo(8, 14)
  tail.fill({ color: 0x182a31, alpha: 0.93 })
  const text = new Text({
    text: '',
    style: { fill: 0xffffff, fontFamily: 'PingFang SC, Hiragino Sans GB, sans-serif', fontSize: 12, fontWeight: '600', align: 'center', wordWrap: true, wordWrapWidth: 190 },
  })
  text.anchor.set(0.5)
  text.y = -7
  bubble.addChild(plate, tail, text)
  bubble.visible = false
  return { bubble, text }
}

class OfficeChibiScene {
  private app: Application | null = null
  private host: HTMLElement | null = null
  private world: Container | null = null
  private characters = new Map<string, CharacterState>()
  private employees: OfficeEmployee[] = []
  private selectedId = 'supervisor'
  private planStarted = false
  private autoClock = 4.5
  private workflowIndex = 0
  private resizeObserver: ResizeObserver | null = null
  private mounting = false
  private fallbackActive = false

  async mount(host: HTMLElement) {
    if (this.mounting) return
    if (this.app) {
      if (this.host === host && this.app.canvas.isConnected) return
      this.teardownRenderer()
    }
    this.mounting = true
    this.host = host
    this.fallbackActive = false
    host.innerHTML = ''
    const loading = document.createElement('div')
    loading.className = 'ai-office-stage-loading'
    loading.textContent = '正在加载卡通员工场景…'
    host.appendChild(loading)
    try {
      await loadAssetsWithRetry()
      const app = new Application()
      await app.init({ backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), resizeTo: host })
      this.app = app
      host.replaceChildren(app.canvas)
      app.canvas.className = 'ai-office-stage-canvas'
      app.canvas.setAttribute('aria-label', '卡通数字员工办公室')
      const world = new Container()
      world.sortableChildren = true
      this.world = world
      app.stage.addChild(world)
      this.drawBackground(world)
      this.drawDesks(world)
      this.resizeObserver = new ResizeObserver(() => this.fitStage())
      this.resizeObserver.observe(host)
      this.fitStage()
      this.updateEmployees(this.employees, this.selectedId, this.planStarted)
      app.ticker.add(this.tick)
    } catch (error) {
      this.teardownRenderer()
      this.renderFallback(host)
      console.error('[AI Office] scene load failed', error)
    } finally {
      this.mounting = false
    }
  }

  updateEmployees(employees: OfficeEmployee[], selectedId: string, planStarted: boolean) {
    this.employees = employees.slice()
    this.selectedId = selectedId
    this.planStarted = planStarted
    if (this.fallbackActive && this.host) {
      this.renderFallback(this.host)
      return
    }
    for (const [id, state] of this.characters) {
      const next = this.employees.find((employee) => employee.id === id)
      if (!next) {
        state.container.destroy({ children: true })
        this.characters.delete(id)
      } else {
        state.data = { ...next }
        state.selected = id === this.selectedId
        this.syncCharacter(state)
      }
    }
    this.employees.forEach((employee, index) => {
      if (!this.characters.has(employee.id)) this.createCharacter(employee, DESKS[index % DESKS.length])
    })
  }

  destroy() {
    this.teardownRenderer()
    this.host = null
    this.fallbackActive = false
  }

  getState() {
    return [...this.characters.values()].map((state) => ({
      id: state.id,
      x: Math.round(state.position.x),
      y: Math.round(state.position.y),
      seatX: state.seat.x,
      seatY: state.seat.y,
      motion: state.motion?.phase ?? null,
      animation: state.currentAnim,
    }))
  }

  private drawBackground(world: Container) {
    const floor = new Graphics()
    floor.rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT)
    floor.fill({ color: 0xf6f8f4 })
    floor.zIndex = -200
    world.addChild(floor)
    const texture = Assets.get('ai-office-background') as Texture
    const background = new Sprite(texture)
    background.anchor.set(0.5)
    background.position.set(SCENE_WIDTH / 2, SCENE_HEIGHT / 2)
    background.width = SCENE_WIDTH
    background.height = SCENE_HEIGHT
    background.zIndex = -100
    world.addChild(background)
  }

  private drawDesks(world: Container) {
    const deskTexture = Assets.get('ai-office-desk') as Texture
    const chairTexture = Assets.get('ai-office-chair') as Texture
    DESKS.forEach((desk, index) => {
      const shadow = new Graphics()
      shadow.ellipse(desk.x, desk.y + 78, 74, 20)
      shadow.fill({ color: 0x2c463c, alpha: 0.08 })
      shadow.zIndex = desk.y - 2
      world.addChild(shadow)
      const deskSprite = new Sprite(deskTexture)
      deskSprite.anchor.set(0.5, 0.62)
      deskSprite.position.set(desk.x, desk.y)
      deskSprite.width = 178
      deskSprite.height = 112
      deskSprite.zIndex = desk.y
      world.addChild(deskSprite)
      const chair = new Sprite(chairTexture)
      chair.anchor.set(0.5, 0.36)
      chair.position.set(desk.x, desk.y + 48)
      chair.width = 74
      chair.height = 77
      chair.zIndex = desk.y + 1
      world.addChild(chair)
      const tag = new Text({ text: `工位 ${index + 1}`, style: { fill: 0x6c8077, fontFamily: 'PingFang SC, sans-serif', fontSize: 10, fontWeight: '600' } })
      tag.anchor.set(0.5)
      tag.position.set(desk.x, desk.y + 88)
      tag.alpha = 0.68
      tag.zIndex = desk.y + 2
      world.addChild(tag)
    })
  }

  private createCharacter(employee: OfficeEmployee, desk: { x: number; y: number }) {
    if (!this.world) return
    const container = new Container()
    container.eventMode = 'static'
    container.cursor = 'pointer'
    container.hitArea = new Rectangle(-54, -190, 108, 210)
    container.on('pointertap', (event) => {
      event.stopPropagation()
      window.dispatchEvent(new CustomEvent('ai-office-agent-click', { detail: { id: employee.id } }))
    })
    const shadow = new Graphics()
    shadow.ellipse(0, 12, 34, 10)
    shadow.fill({ color: 0x233b33, alpha: 0.16 })
    const spine = Spine.from({ skeleton: 'ai-office-chibi-skeleton', atlas: 'ai-office-chibi-atlas', scale: 0.25, autoUpdate: true })
    const skinName = SKINS[this.characters.size % SKINS.length]
    if (spine.skeleton.data.findSkin(skinName)) {
      spine.skeleton.setSkinByName(skinName)
      spine.skeleton.setSlotsToSetupPose()
    }
    spine.state.data.defaultMix = 0.2
    spine.position.set(0, 0)
    const selection = new Graphics()
    selection.circle(0, 4, 45)
    selection.stroke({ color: 0x178577, width: 3, alpha: 0.85 })
    selection.visible = false
    const nameLabel = new Text({ text: employee.name, style: { fill: 0x1d2e2b, fontFamily: 'PingFang SC, sans-serif', fontSize: 14, fontWeight: '800', align: 'center' } })
    nameLabel.anchor.set(0.5)
    nameLabel.y = -177
    const statePlate = new Graphics()
    statePlate.y = -151
    const stateLabel = new Text({ text: '', style: { fill: 0x178577, fontFamily: 'PingFang SC, sans-serif', fontSize: 10, fontWeight: '700', align: 'center' } })
    stateLabel.anchor.set(0.5)
    stateLabel.y = -151
    const bubbleParts = createBubble()
    bubbleParts.bubble.y = -208
    container.addChild(shadow, selection, spine, statePlate, stateLabel, nameLabel, bubbleParts.bubble)
    const state: CharacterState = {
      id: employee.id,
      data: { ...employee },
      seat: { x: desk.x, y: desk.y + 48 },
      position: { x: desk.x, y: desk.y + 48 },
      container,
      spine,
      nameLabel,
      stateLabel,
      statePlate,
      bubble: bubbleParts.bubble,
      bubbleText: bubbleParts.text,
      shadow,
      currentAnim: '',
      facing: 'back',
      motion: null,
      selected: false,
    }
    ;(state as CharacterState & { selection: Graphics }).selection = selection
    container.zIndex = state.position.y + 8
    this.characters.set(employee.id, state)
    this.world.addChild(container)
    this.syncCharacter(state)
  }

  private syncCharacter(state: CharacterState) {
    state.nameLabel.text = state.data.name
    state.selected = state.id === this.selectedId
    const selection = (state as CharacterState & { selection: Graphics }).selection
    if (selection) selection.visible = state.selected
    statusText(state)
    if (state.motion) return
    if (state.data.status === 'working') {
      state.facing = 'back'
      playAnimation(state, 'idle')
    } else if (state.data.status === 'learning') {
      state.facing = 'front'
      playAnimation(state, 'thinking')
    } else {
      state.facing = 'front'
      playAnimation(state, 'idle')
    }
    state.container.position.set(state.position.x, state.position.y)
  }

  private showBubble(state: CharacterState, message: string) {
    state.bubbleText.text = message
    state.bubble.visible = true
    window.setTimeout(() => {
      if (!state.motion || state.motion.phase !== 'talk') state.bubble.visible = false
    }, 2600)
  }

  private startWorkflow() {
    const ids = this.employees.map((employee) => employee.id).filter((id) => this.characters.has(id))
    if (ids.length < 2 || [...this.characters.values()].some((state) => state.motion)) return
    const visitorId = ids[this.workflowIndex % ids.length]
    const hostId = ids[(this.workflowIndex + 1) % ids.length]
    this.workflowIndex = (this.workflowIndex + 1) % ids.length
    const visitor = this.characters.get(visitorId)
    const host = this.characters.get(hostId)
    if (!visitor || !host) return
    const direction = visitor.position.x <= host.position.x ? 1 : -1
    visitor.motion = { phase: 'toHost', elapsed: 0, duration: this.planStarted ? 1.4 : 2.2, from: { ...visitor.position }, target: { x: host.position.x - direction * 66, y: host.position.y - 24 }, visitorId, hostId }
    visitor.bubble.visible = false
    playAnimation(visitor, 'walking')
    setFacing(visitor, direction > 0 ? 'right' : 'left')
    this.showBubble(visitor, '正在前往交接…')
  }

  private tick = (ticker: { deltaTime: number }) => {
    const dt = Math.min(ticker.deltaTime / 60, 0.05)
    this.autoClock -= dt
    if (this.autoClock <= 0) {
      this.autoClock = this.planStarted ? 5.5 : 8.5
      this.startWorkflow()
    }
    for (const state of this.characters.values()) {
      const motion = state.motion
      if (!motion) continue
      motion.elapsed += dt
      const progress = Math.min(motion.elapsed / motion.duration, 1)
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
      state.position.x = motion.from.x + (motion.target.x - motion.from.x) * eased
      state.position.y = motion.from.y + (motion.target.y - motion.from.y) * eased
      state.container.position.set(state.position.x, state.position.y)
      state.container.zIndex = state.position.y + 8
      if (progress < 1) continue
      if (motion.phase === 'toHost') {
        motion.phase = 'talk'
        motion.elapsed = 0
        motion.duration = 2.7
        state.facing = state.position.x < motion.target.x ? 'right' : 'left'
        playAnimation(state, 'talking')
        this.showBubble(state, '这条线索交给你了')
        const host = this.characters.get(motion.hostId)
        if (host) {
          host.facing = state.position.x < host.position.x ? 'left' : 'right'
          playAnimation(host, 'talking')
          this.showBubble(host, '收到，我来继续处理')
        }
      } else if (motion.phase === 'talk') {
        motion.phase = 'return'
        motion.elapsed = 0
        motion.duration = this.planStarted ? 1.4 : 2.2
        motion.from = { ...state.position }
        motion.target = { ...state.seat }
        playAnimation(state, 'walking')
      } else {
        state.motion = null
        state.position = { ...state.seat }
        state.container.position.set(state.position.x, state.position.y)
        this.syncCharacter(state)
      }
    }
  }

  private fitStage() {
    if (!this.app || !this.world || !this.host) return
    const width = this.host.clientWidth || SCENE_WIDTH
    const height = this.host.clientHeight || SCENE_HEIGHT
    this.app.renderer.resize(width, height)
    const scale = Math.min(width / SCENE_WIDTH, height / SCENE_HEIGHT)
    this.world.scale.set(scale)
    this.world.position.set((width - SCENE_WIDTH * scale) / 2, (height - SCENE_HEIGHT * scale) / 2)
  }

  private teardownRenderer() {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.app?.destroy(true, { children: true })
    this.app = null
    this.world = null
    this.characters.clear()
  }

  private renderFallback(host: HTMLElement) {
    this.fallbackActive = true
    const fallback = document.createElement('div')
    fallback.className = 'ai-office-stage-fallback'

    const world = document.createElement('div')
    world.className = 'ai-office-stage-fallback__world'
    const background = document.createElement('img')
    background.className = 'ai-office-stage-fallback__background'
    background.src = officeAssetUrl('office/office.png')
    background.alt = ''
    world.appendChild(background)

    this.employees.slice(0, DESKS.length).forEach((employee, index) => {
      const desk = DESKS[index]
      const employeeButton = document.createElement('button')
      employeeButton.type = 'button'
      employeeButton.className = 'ai-office-stage-fallback__employee'
      employeeButton.style.left = `${(desk.x / SCENE_WIDTH) * 100}%`
      employeeButton.style.top = `${((desk.y + 30) / SCENE_HEIGHT) * 100}%`
      employeeButton.setAttribute('aria-label', `查看${employee.name}的工作概览`)
      const avatar = document.createElement('img')
      const avatarId = employee.id === 'lead-hunter' || employee.id === 'smart-reply' ? employee.id : 'supervisor'
      avatar.src = officeAssetUrl(`characters/avatars/${avatarId}.png`)
      avatar.alt = ''
      const name = document.createElement('strong')
      name.textContent = employee.name
      const status = document.createElement('small')
      status.textContent = statusMeta(employee.status).label
      employeeButton.append(avatar, name, status)
      employeeButton.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('ai-office-agent-click', { detail: { id: employee.id } }))
      })
      world.appendChild(employeeButton)
    })

    fallback.append(world)
    host.replaceChildren(fallback)
  }
}

const scene = new OfficeChibiScene()
const api = {
  mount: (host: HTMLElement) => scene.mount(host),
  update: (employees: OfficeEmployee[], selectedId: string, planStarted: boolean) => scene.updateEmployees(employees, selectedId, planStarted),
  getState: () => scene.getState(),
  destroy: () => scene.destroy(),
}

;(window as Window & { AIOfficeChibi?: typeof api }).AIOfficeChibi = api
