import { ApiError } from './errors'

export const MOCK = import.meta.env.VITE_MOCK === 'true'

let mockLoggedIn = false

const SERVICES = [
  { name: 'nginx.service', description: 'A high performance web server and a reverse proxy server', loadState: 'loaded', activeState: 'active', subState: 'running', unitFileState: 'enabled' },
  { name: 'postgresql.service', description: 'PostgreSQL RDBMS', loadState: 'loaded', activeState: 'active', subState: 'running', unitFileState: 'enabled' },
  { name: 'redis.service', description: 'Advanced key-value store', loadState: 'loaded', activeState: 'active', subState: 'running', unitFileState: 'enabled' },
  { name: 'sshd.service', description: 'OpenSSH Daemon', loadState: 'loaded', activeState: 'active', subState: 'running', unitFileState: 'enabled' },
  { name: 'fail2ban.service', description: 'Fail2Ban Service', loadState: 'loaded', activeState: 'failed', subState: 'failed', unitFileState: 'enabled' },
  { name: 'cron.service', description: 'Regular background program processing daemon', loadState: 'loaded', activeState: 'active', subState: 'waiting', unitFileState: 'enabled' },
  { name: 'docker.service', description: 'Docker Application Container Engine', loadState: 'loaded', activeState: 'active', subState: 'running', unitFileState: 'enabled' },
]

const CONTAINERS = [
  { id: 'a1b2c3d4e5f6', name: 'web-frontend', image: 'nginx:alpine', state: 'running', status: 'Up 3 days' },
  { id: 'b2c3d4e5f6a7', name: 'api-server', image: 'node:20-slim', state: 'running', status: 'Up 1 day' },
  { id: 'c3d4e5f6a7b8', name: 'postgres-db', image: 'postgres:16', state: 'running', status: 'Up 5 days' },
  { id: 'd4e5f6a7b8c9', name: 'redis-cache', image: 'redis:7-alpine', state: 'exited', status: 'Exited (0) 2 hours ago' },
]

const IMAGES = [
  { id: 'sha256:aabbcc1122', name: 'nginx:alpine', size: 41_000_000, usedBy: [{ id: 'a1b2c3d4e5f6', name: 'web-frontend' }] },
  { id: 'sha256:bbccdd2233', name: 'node:20-slim', size: 220_000_000, usedBy: [{ id: 'b2c3d4e5f6a7', name: 'api-server' }] },
  { id: 'sha256:ccddeee344', name: 'postgres:16', size: 379_000_000, usedBy: [{ id: 'c3d4e5f6a7b8', name: 'postgres-db' }] },
  { id: 'sha256:ddeeff4455', name: 'redis:7-alpine', size: 35_000_000, usedBy: [{ id: 'd4e5f6a7b8c9', name: 'redis-cache' }] },
]

const NETWORKS = [
  { id: 'net1aabbcc', name: 'bridge', driver: 'bridge', scope: 'local', usedBy: [] },
  { id: 'net2bbccdd', name: 'app-net', driver: 'bridge', scope: 'local', usedBy: [{ id: 'a1b2c3d4e5f6', name: 'web-frontend' }, { id: 'b2c3d4e5f6a7', name: 'api-server' }] },
]

const FIREWALL = {
  active: true,
  rules: [
    { numbers: [1], to: '22/tcp', action: 'ALLOW', from: 'Anywhere', protocol: 'tcp', ipv4: true, ipv6: true },
    { numbers: [2], to: '80/tcp', action: 'ALLOW', from: 'Anywhere', protocol: 'tcp', ipv4: true, ipv6: true },
    { numbers: [3], to: '443/tcp', action: 'ALLOW', from: 'Anywhere', protocol: 'tcp', ipv4: true, ipv6: true },
    { numbers: [4], to: '8080/tcp', action: 'DENY', from: 'Anywhere', protocol: 'tcp', ipv4: true, ipv6: false },
  ],
}

let firewallState = { ...FIREWALL, rules: [...FIREWALL.rules] }

const FILES = [
  { name: 'etc', path: '/etc', isDir: true, size: 0, modTime: '2026-01-01T00:00:00Z' },
  { name: 'var', path: '/var', isDir: true, size: 0, modTime: '2026-01-01T00:00:00Z' },
  { name: 'home', path: '/home', isDir: true, size: 0, modTime: '2026-01-01T00:00:00Z' },
  { name: 'README.md', path: '/README.md', isDir: false, size: 1024, modTime: '2026-01-15T10:00:00Z' },
  { name: '.bashrc', path: '/.bashrc', isDir: false, size: 512, modTime: '2026-02-01T08:00:00Z' },
]

const SYSTEM_INFO = {
  hostname: 'mock-server',
  distro: 'Ubuntu 24.04 LTS',
  kernel: '6.8.0-51-generic',
  arch: 'x86_64',
  bootTime: '2026-08-01T00:00:00Z',
  uptimeSeconds: 2_880_000,
}

const HISTORY_SETTINGS = {
  cpu: { enabled: true, intervalMinutes: 5, retentionDays: 30 },
  memory: { enabled: true, intervalMinutes: 5, retentionDays: 30 },
  swap: { enabled: false, intervalMinutes: 5, retentionDays: 7 },
}

function makeHistoryPoints(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(Date.now() - (count - i) * 5 * 60_000).toISOString(),
    cpuUsedPercent: 20 + Math.random() * 40,
    memUsedPercent: 50 + Math.random() * 20,
    memUsed: 4_000_000_000 + Math.random() * 2_000_000_000,
    memTotal: 16_000_000_000,
    swapUsedPercent: 5 + Math.random() * 10,
    swapUsed: 200_000_000,
    swapTotal: 2_000_000_000,
    netTxBytesPerSec: 50_000 + Math.random() * 400_000,
  }))
}

// Canonical order of the 8 togglable/reorderable nav modules — mirrors
// web/src/lib/modules.tsx's MODULE_ORDER. All start enabled so the mock
// demo shows the full nav without a manual setup step.
const MODULE_ORDER = ['terminal', 'services', 'files', 'containers', 'history', 'firewall', 'proxy', 'database']
let enabledModuleKeys = [...MODULE_ORDER]

function buildStatusResponse(enabledKeys: string[]) {
  const enabledSet = new Set(enabledKeys)
  const disabled = MODULE_ORDER.filter((key) => !enabledSet.has(key))
  return {
    modules: [
      ...enabledKeys.map((key) => ({ key, enabled: true })),
      ...disabled.map((key) => ({ key, enabled: false })),
    ],
  }
}

// One entry per optional extension module with a checkable dependency
// (see web/src/lib/modules.tsx's DEPENDENCY_MODULES) — all start healthy
// so every module page works out of the box without a setup dialog.
interface MockDependencyStatus {
  key: string
  healthy: boolean
  reason?: 'unavailable' | 'serviceInactive' | 'unconfigured'
  serviceName?: string
  fields: string[]
  requiredFields: string[]
  config: Record<string, string>
  docsUrl: string
}

const DEPENDENCY_STATUS: Record<string, MockDependencyStatus> = {
  containers: {
    key: 'containers', healthy: true, fields: [], requiredFields: [], config: {},
    docsUrl: 'https://docs.docker.com/engine/install/',
  },
  history: {
    key: 'history', healthy: true, fields: [], requiredFields: [], config: {},
    docsUrl: 'https://github.com/sysstat/sysstat',
  },
  firewall: {
    key: 'firewall', healthy: true, fields: [], requiredFields: [], config: {},
    docsUrl: 'https://help.ubuntu.com/community/UFW',
  },
  proxy: {
    key: 'proxy', healthy: true, fields: ['url', 'password'], requiredFields: ['url'],
    config: { url: 'http://127.0.0.1:9090', password: '' },
    docsUrl: 'https://wiki.metacubex.one/',
  },
  database: {
    key: 'database', healthy: true, fields: ['host', 'port', 'username', 'password'],
    requiredFields: ['host', 'port', 'username', 'password'],
    config: { host: '127.0.0.1', port: '5432', username: 'postgres', password: 'postgres' },
    docsUrl: 'https://www.postgresql.org/docs/',
  },
}

const PROXY_GROUPS: Record<string, { name: string; now: string; options: { name: string; type: string; delay: number }[] }> = {
  GLOBAL: {
    name: 'GLOBAL', now: 'PROXY',
    options: [
      { name: 'PROXY', type: 'select', delay: 0 },
      { name: 'HK-01', type: 'ss', delay: 0 },
      { name: 'US-01', type: 'vmess', delay: 0 },
      { name: 'JP-01', type: 'trojan', delay: 0 },
      { name: 'DIRECT', type: 'direct', delay: 0 },
      { name: 'REJECT', type: 'reject', delay: 0 },
    ],
  },
  PROXY: {
    name: 'PROXY', now: 'auto',
    options: [
      { name: 'auto', type: 'url-test', delay: 0 },
      { name: 'HK-01', type: 'ss', delay: 0 },
      { name: 'US-01', type: 'vmess', delay: 0 },
      { name: 'JP-01', type: 'trojan', delay: 0 },
      { name: 'DIRECT', type: 'direct', delay: 0 },
    ],
  },
  Streaming: {
    name: 'Streaming', now: 'PROXY',
    options: [
      { name: 'PROXY', type: 'select', delay: 0 },
      { name: 'HK-01', type: 'ss', delay: 0 },
      { name: 'US-01', type: 'vmess', delay: 0 },
      { name: 'DIRECT', type: 'direct', delay: 0 },
    ],
  },
}
let proxyMode: 'global' | 'rule' | 'direct' = 'rule'

const DATABASES = [
  { name: 'app_production', tableCount: 18 },
  { name: 'app_staging', tableCount: 18 },
  { name: 'analytics', tableCount: 6 },
]

const TABLES: Record<string, { schema: string; name: string; columnCount: number }[]> = {
  app_production: [
    { schema: 'public', name: 'users', columnCount: 12 },
    { schema: 'public', name: 'sessions', columnCount: 6 },
    { schema: 'public', name: 'orders', columnCount: 15 },
    { schema: 'public', name: 'order_items', columnCount: 8 },
  ],
  app_staging: [
    { schema: 'public', name: 'users', columnCount: 12 },
    { schema: 'public', name: 'sessions', columnCount: 6 },
  ],
  analytics: [
    { schema: 'public', name: 'events', columnCount: 9 },
    { schema: 'public', name: 'daily_rollups', columnCount: 5 },
  ],
}

function ok<T>(data: T) {
  return Promise.resolve(data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET'
  const body = init?.body ? JSON.parse(init.body as string) : undefined

  if (path === '/session') {
    if (!mockLoggedIn) return Promise.reject(new ApiError('UNAUTHORIZED'))
    return ok(null) as Promise<T>
  }
  if (path === '/login') {
    if (body?.password !== '123456') return Promise.reject(new ApiError('INVALID_TOKEN', 'Invalid password'))
    mockLoggedIn = true
    return ok(null) as Promise<T>
  }
  if (path === '/logout') {
    mockLoggedIn = false
    return ok(null) as Promise<T>
  }

  if (path === '/system/info') return ok(SYSTEM_INFO) as Promise<T>

  if (path === '/dashboard/network-settings') return ok({ maxMbps: 1000 }) as Promise<T>
  if (path === '/dashboard/network-settings' && method === 'PUT') return ok(body) as Promise<T>
  const procMatch = path.match(/^\/dashboard\/processes\/(\d+)(\/terminate)?$/)
  if (procMatch) {
    if (procMatch[2]) return ok(null) as Promise<T>
    return ok({
      pid: +procMatch[1], ppid: 1, name: 'mock-proc', state: 'S',
      user: 'root', cpuPercent: 1.2, memRSS: 20_000_000,
      cmdline: '/usr/bin/mock-proc', exe: '/usr/bin/mock-proc', cwd: '/',
      startTime: '2026-08-01T00:00:00Z', priority: 20, nice: 0, threads: 4,
      vmSize: 100_000_000, vmSwap: 0, openFiles: 12,
    }) as Promise<T>
  }

  if (path.startsWith('/services')) {
    const actionMatch = path.match(/^\/services\/([^/]+)\/(start|stop|restart|enable|disable)$/)
    if (actionMatch) return ok(null) as Promise<T>
    const logsMatch = path.match(/^\/services\/([^/]+)\/logs/)
    if (logsMatch) return ok(['mock log line 1', 'mock log line 2', 'mock log line 3']) as Promise<T>
    const detailMatch = path.match(/^\/services\/([^/]+)$/)
    if (detailMatch) {
      const name = decodeURIComponent(detailMatch[1])
      const s = SERVICES.find(x => x.name === name) ?? SERVICES[0]
      return ok({ ...s, fragmentPath: `/etc/systemd/system/${s.name}`, mainPid: 1234, exitCode: 0, activeSince: '2026-08-01T00:00:00Z', restartPolicy: 'always', user: 'root', workingDirectory: '/', memoryCurrentBytes: 50_000_000, requires: null, after: null }) as Promise<T>
    }
    return ok(SERVICES) as Promise<T>
  }

  if (path.startsWith('/containers')) {
    if (path === '/containers/images/tags') return ok(IMAGES.map(i => i.name)) as Promise<T>
    if (path === '/containers/images/delete') return ok(null) as Promise<T>
    if (path === '/containers/images') return ok(IMAGES) as Promise<T>
    if (path === '/containers/networks') return ok(NETWORKS) as Promise<T>
    const netDelMatch = path.match(/^\/containers\/networks\/([^/]+)\/delete$/)
    if (netDelMatch) return ok(null) as Promise<T>
    if (path === '/containers' && method === 'POST') return ok({ id: 'new-mock-container-id' }) as Promise<T>
    const actionMatch = path.match(/^\/containers\/([^/]+)\/(start|stop|restart)$/)
    if (actionMatch) return ok(null) as Promise<T>
    const logsMatch = path.match(/^\/containers\/([^/]+)\/logs/)
    if (logsMatch) return ok(['container log line 1', 'container log line 2']) as Promise<T>
    const detailMatch = path.match(/^\/containers\/([^/]+)$/)
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1])
      const c = CONTAINERS.find(x => x.id === id) ?? CONTAINERS[0]
      return ok({ ...c, command: '/bin/sh', created: '2026-08-01T00:00:00Z', exitCode: 0, startedAt: '2026-08-01T00:00:00Z', restartPolicy: 'always', platform: 'linux/amd64', networks: ['bridge'], ports: ['80/tcp'], mounts: null, env: ['PATH=/usr/bin'] }) as Promise<T>
    }
    return ok(CONTAINERS) as Promise<T>
  }

  if (path.startsWith('/files')) {
    if (path.startsWith('/files/content') && method === 'PUT') return ok(null) as Promise<T>
    if (path.startsWith('/files/content')) return ok({ content: '# mock file content\nhello world\n' }) as Promise<T>
    if (path === '/files/mkdir') return ok(null) as Promise<T>
    if (path === '/files/rename') return ok(null) as Promise<T>
    if (path === '/files/delete') return ok(null) as Promise<T>
    return ok(FILES) as Promise<T>
  }

  if (path.startsWith('/firewall')) {
    if (method === 'POST') {
      firewallState.rules.push({ numbers: [firewallState.rules.length + 1], to: body.port ?? 'any', action: body.action.toUpperCase(), from: 'Anywhere', protocol: body.protocol === 'any' ? undefined : body.protocol, ipv4: body.ipv4, ipv6: body.ipv6 })
      return ok(firewallState) as Promise<T>
    }
    if (method === 'PUT') {
      firewallState.rules = firewallState.rules.map(r =>
        r.numbers.some((n: number) => body.numbers.includes(n))
          ? { ...r, to: body.port ?? r.to, action: body.action.toUpperCase() }
          : r
      )
      return ok(firewallState) as Promise<T>
    }
    if (method === 'DELETE') {
      firewallState.rules = firewallState.rules.filter(r =>
        !r.numbers.some((n: number) => body.numbers.includes(n))
      )
      return ok(firewallState) as Promise<T>
    }
    return ok(firewallState) as Promise<T>
  }

  if (path.startsWith('/history')) {
    if (path === '/history/settings' && method === 'PUT') return ok(body) as Promise<T>
    if (path === '/history/settings') return ok(HISTORY_SETTINGS) as Promise<T>
    return ok({ date: new Date().toISOString().slice(0, 10), points: makeHistoryPoints(288) }) as Promise<T>
  }

  if (path === '/status') return ok(buildStatusResponse(enabledModuleKeys)) as Promise<T>
  if (path === '/status/features' && method === 'PUT') {
    enabledModuleKeys = body.enabledFeatures ?? []
    return ok(buildStatusResponse(enabledModuleKeys)) as Promise<T>
  }

  const depMatch = path.match(/^\/modules\/([^/]+)\/dependency(\/enable-service)?$/)
  if (depMatch) {
    const status = DEPENDENCY_STATUS[depMatch[1]]
    if (!status) return Promise.reject(new Error(`mock: unknown module ${depMatch[1]}`))
    if (depMatch[2]) {
      status.healthy = true
      status.reason = undefined
      return ok({ ...status }) as Promise<T>
    }
    if (method === 'PUT') {
      status.config = { ...status.config, ...body }
      status.healthy = true
      status.reason = undefined
      return ok({ ...status }) as Promise<T>
    }
    return ok({ ...status }) as Promise<T>
  }

  if (path.startsWith('/proxy')) {
    if (path === '/proxy/overview') {
      return ok({ mode: proxyMode, groups: ['PROXY', 'Streaming'] }) as Promise<T>
    }
    if (path === '/proxy/mode' && method === 'PUT') {
      proxyMode = body.mode
      return ok({ mode: proxyMode, groups: ['PROXY', 'Streaming'] }) as Promise<T>
    }
    const selMatch = path.match(/^\/proxy\/groups\/([^/]+)\/selection$/)
    if (selMatch) {
      const group = PROXY_GROUPS[decodeURIComponent(selMatch[1])]
      if (group) group.now = body.name
      return ok(group) as Promise<T>
    }
    const testMatch = path.match(/^\/proxy\/groups\/([^/]+)\/test$/)
    if (testMatch) {
      const group = PROXY_GROUPS[decodeURIComponent(testMatch[1])]
      if (group) group.options = group.options.map((o) => ({ ...o, delay: o.name === 'REJECT' ? 0 : 30 + Math.floor(Math.random() * 900) }))
      return ok(group) as Promise<T>
    }
    const groupMatch = path.match(/^\/proxy\/groups\/([^/]+)$/)
    if (groupMatch) return ok(PROXY_GROUPS[decodeURIComponent(groupMatch[1])]) as Promise<T>
  }

  if (path.startsWith('/database')) {
    if (path === '/database/databases') return ok(DATABASES) as Promise<T>
    const tablesMatch = path.match(/^\/database\/databases\/([^/]+)\/tables$/)
    if (tablesMatch) return ok(TABLES[decodeURIComponent(tablesMatch[1])] ?? []) as Promise<T>
  }

  if (path.startsWith('/terminal/directories')) {
    const url = new URL(path, 'http://mock')
    const cwd = url.searchParams.get('cwd') || '/root'
    return ok({
      cwd,
      directories: [
        { name: 'root', path: '/root' },
        { name: 'etc', path: '/etc' },
        { name: 'var', path: '/var' },
        { name: 'home', path: '/home' },
      ],
    }) as Promise<T>
  }

  return Promise.reject(new Error(`mock: unhandled ${method} ${path}`))
}

// The subset of EventSource every plain SSE call site actually uses. Both
// the real EventSource and the mock stand-ins below satisfy it, so callers
// can branch on MOCK through the open* helpers and still get one concrete
// type back — branching inline instead yields a union whose `onmessage`
// parameter no longer infers, which is a type error under `noImplicitAny`.
export interface StreamSource {
  onmessage: ((event: { data: string }) => void) | null
  onerror: (() => void) | null
  close(): void
}

/** The dashboard's live CPU/memory/process stream. */
export function openDashboardStream(url: string): StreamSource {
  return MOCK ? new MockEventSource(url) : (new EventSource(url) as unknown as StreamSource)
}

/** A service's or container's follow-mode log stream. */
export function openLogStream(url: string): StreamSource {
  return MOCK ? new MockLogsEventSource(url) : (new EventSource(url) as unknown as StreamSource)
}

export class MockEventSource {
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(_url: string) {
    let tick = 0
    this.timer = setInterval(() => {
      tick++
      if (!this.onmessage) return
      const overview = {
        cpuPercent: 20 + 30 * Math.abs(Math.sin(tick * 0.1)),
        memTotal: 16_000_000_000,
        memUsed: 6_000_000_000 + 1_000_000_000 * Math.sin(tick * 0.05),
        swapTotal: 2_000_000_000,
        swapUsed: 200_000_000,
        netInterface: 'eth0',
        netRxBytesPerSec: 100_000 + Math.random() * 500_000,
        netTxBytesPerSec: 50_000 + Math.random() * 200_000,
        processes: [
          { pid: 1, ppid: 0, name: 'systemd', user: 'root', cpuPercent: 0.1, memRSS: 10_000_000 },
          { pid: 100, ppid: 1, name: 'nginx', user: 'www-data', cpuPercent: 1.2 + Math.random(), memRSS: 30_000_000 },
          { pid: 200, ppid: 1, name: 'postgres', user: 'postgres', cpuPercent: 2.5 + Math.random() * 2, memRSS: 200_000_000 },
          { pid: 300, ppid: 1, name: 'node', user: 'app', cpuPercent: 5 + Math.random() * 10, memRSS: 150_000_000 },
          { pid: 400, ppid: 1, name: 'redis-server', user: 'redis', cpuPercent: 0.5, memRSS: 20_000_000 },
        ],
      }
      this.onmessage({ data: JSON.stringify(overview) })
    }, 1500)
  }

  close() {
    if (this.timer) clearInterval(this.timer)
  }
}

export class MockLogsEventSource {
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(_url: string) {
    const lines = [
      '2026-09-04T10:00:01Z mock log: service started',
      '2026-09-04T10:00:02Z mock log: listening on :8080',
      '2026-09-04T10:00:05Z mock log: connected to database',
      '2026-09-04T10:00:10Z mock log: health check OK',
      '2026-09-04T10:00:15Z mock log: serving request GET /',
    ]
    let i = 0
    const emit = () => {
      if (!this.onmessage) { this.timer = setTimeout(emit, 200); return }
      if (i < lines.length) {
        this.onmessage({ data: lines[i++] })
        this.timer = setTimeout(emit, 300)
      } else {
        this.timer = setTimeout(emit, 3000)
        i = 0
      }
    }
    this.timer = setTimeout(emit, 100)
  }

  close() {
    if (this.timer) clearTimeout(this.timer)
  }
}

// Shared by MockDatabaseSizeEventSource/MockTableStatsEventSource: both
// stream a series of named-event payloads on a delay, then a 'done' event —
// mirroring the backend's per-item SSE + terminal event on the database
// module's two streaming endpoints.
class MockNamedEventSource {
  onmessage: ((e: { data: string }) => void) | null = null
  private listeners: Record<string, ((e: { data: string }) => void)[]> = {}
  private timers: ReturnType<typeof setTimeout>[] = []

  protected schedule(steps: { event?: string; data: unknown; delay: number }[]) {
    let elapsed = 0
    for (const step of steps) {
      elapsed += step.delay
      this.timers.push(
        setTimeout(() => this.emit(step.event ?? 'message', step.data), elapsed),
      )
    }
  }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    ;(this.listeners[type] ??= []).push(listener)
  }

  private emit(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) }
    if (type === 'message') this.onmessage?.(event)
    else this.listeners[type]?.forEach((cb) => cb(event))
  }

  close() {
    this.timers.forEach(clearTimeout)
  }
}

export class MockDatabaseSizeEventSource extends MockNamedEventSource {
  constructor(_url: string) {
    super()
    const steps = DATABASES.map((d, i) => ({
      data: { name: d.name, bytes: 5_000_000 + Math.random() * 500_000_000 },
      delay: 150 * (i + 1),
    }))
    this.schedule([...steps, { event: 'done', data: {}, delay: 150 }])
  }
}

export class MockTableStatsEventSource extends MockNamedEventSource {
  constructor(url: string) {
    super()
    const match = url.match(/\/database\/databases\/([^/]+)\/tables\/stream/)
    const tables = TABLES[match ? decodeURIComponent(match[1]) : ''] ?? []
    const steps = tables.map((table, i) => ({
      data: { schema: table.schema, name: table.name, rows: Math.floor(Math.random() * 50_000), bytes: 10_000 + Math.random() * 20_000_000 },
      delay: 120 * (i + 1),
    }))
    this.schedule([...steps, { event: 'done', data: {}, delay: 120 }])
  }
}
