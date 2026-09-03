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
  }))
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

  return Promise.reject(new Error(`mock: unhandled ${method} ${path}`))
}

export class MockEventSource {
  onmessage: ((e: { data: string }) => void) | null = null
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
