// Package stats reads live CPU/memory/process data straight from /proc.
// This is intentionally independent of the sysstat/sadf integration used
// for the historical-status module: sadf exports system-wide sar samples,
// not the per-process detail the dashboard's process list needs.
package stats

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/user"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// clockTicks is Linux's USER_HZ, the unit /proc/[pid]/stat's cpu time
// fields are expressed in. 100 is the near-universal value on modern
// kernels; only unusual embedded configurations differ.
const clockTicks = 100

type Overview struct {
	CPUPercent float64 `json:"cpuPercent"`
	MemTotal   uint64  `json:"memTotal"`
	MemUsed    uint64  `json:"memUsed"`
	SwapTotal  uint64  `json:"swapTotal"`
	SwapUsed   uint64  `json:"swapUsed"`
	// NetInterface is whichever interface currently owns the default route
	// (see defaultRouteInterface) — empty when there's no default route.
	// NetRxBytesPerSec/NetTxBytesPerSec are that interface's instantaneous
	// throughput — 0 when NetInterface is empty or this is the collector's
	// first sample.
	NetInterface     string    `json:"netInterface"`
	NetRxBytesPerSec float64   `json:"netRxBytesPerSec"`
	NetTxBytesPerSec float64   `json:"netTxBytesPerSec"`
	Processes        []Process `json:"processes"`
}

type Process struct {
	PID        int     `json:"pid"`
	PPID       int     `json:"ppid"`
	Name       string  `json:"name"`
	User       string  `json:"user"`
	CPUPercent float64 `json:"cpuPercent"`
	MemRSS     uint64  `json:"memRSS"`
}

// ErrProcessNotFound means the pid no longer exists — it may have exited
// between the list being fetched and the detail request landing.
var ErrProcessNotFound = errors.New("process not found")

// ProcessDetail is the single-process deep dive shown from the dashboard's
// process list. State is /proc's raw one-letter code (R, S, D, Z, T, t, X,
// I — see proc(5)); the frontend owns translating it, matching how the
// services/containers modules translate their own backend enums client-side.
type ProcessDetail struct {
	PID        int       `json:"pid"`
	PPID       int       `json:"ppid"`
	Name       string    `json:"name"`
	State      string    `json:"state"`
	User       string    `json:"user"`
	CPUPercent float64   `json:"cpuPercent"`
	MemRSS     uint64    `json:"memRSS"`
	Cmdline    string    `json:"cmdline"`
	Exe        string    `json:"exe"`
	Cwd        string    `json:"cwd"`
	StartTime  time.Time `json:"startTime"`
	Priority   int       `json:"priority"`
	Nice       int       `json:"nice"`
	Threads    int       `json:"threads"`
	VmSize     uint64    `json:"vmSize"`
	VmSwap     uint64    `json:"vmSwap"`
	// OpenFiles is -1 when /proc/[pid]/fd couldn't be listed (no
	// permission, or the process exited underneath us) — the frontend
	// renders that as "—" rather than 0, a claim we can't actually back.
	OpenFiles int `json:"openFiles"`
}

type cpuSample struct {
	idle, total uint64
}

type procSample struct {
	cpuTicks uint64
	at       time.Time
}

// netSample is the previous /proc/net/dev reading for the interface that
// owned the default route at the time — kept alongside the interface name
// so a route change (e.g. a VPN going up or down) is detected as "no prior
// sample" rather than producing a bogus delta between two different
// interfaces' counters.
type netSample struct {
	iface  string
	rx, tx uint64
}

// Collector holds the previous samples needed to turn /proc's cumulative
// counters into instantaneous percentages between two ticks.
type Collector struct {
	mu        sync.Mutex
	prevCPU   cpuSample
	prevProcs map[int]procSample
	prevNet   netSample
	prevAt    time.Time
	usernames map[uint32]string
}

func NewCollector() *Collector {
	return &Collector{prevProcs: map[int]procSample{}, usernames: map[uint32]string{}}
}

// ProcessSort picks which metric the full process list is ordered by before
// being sent to the client (the client itself re-sorts as needed — e.g. by
// collapsed-subtree total in tree mode — but this sets the default order for
// the flat view).
type ProcessSort string

const (
	SortByCPU ProcessSort = "cpu"
	SortByMem ProcessSort = "mem"
)

func (c *Collector) Sample(sortBy ProcessSort) (Overview, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()

	cpuPercent, err := c.sampleCPU()
	if err != nil {
		return Overview{}, err
	}

	memTotal, memUsed, swapTotal, swapUsed, err := readMem()
	if err != nil {
		return Overview{}, err
	}

	procs, err := c.sampleProcesses(now, sortBy)
	if err != nil {
		return Overview{}, err
	}

	netIface, netRxBps, netTxBps := c.sampleNetwork(now)

	c.prevAt = now
	return Overview{
		CPUPercent:       cpuPercent,
		MemTotal:         memTotal,
		MemUsed:          memUsed,
		SwapTotal:        swapTotal,
		SwapUsed:         swapUsed,
		NetInterface:     netIface,
		NetRxBytesPerSec: netRxBps,
		NetTxBytesPerSec: netTxBps,
		Processes:        procs,
	}, nil
}

func (c *Collector) sampleCPU() (float64, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return 0, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	scanner.Scan()
	fields := strings.Fields(scanner.Text()) // "cpu  user nice system idle iowait irq softirq steal ..."

	var total uint64
	var idle uint64
	for i, field := range fields[1:] {
		v, _ := strconv.ParseUint(field, 10, 64)
		total += v
		if i == 3 { // idle
			idle = v
		}
	}

	sample := cpuSample{idle: idle, total: total}
	defer func() { c.prevCPU = sample }()

	dTotal := float64(sample.total - c.prevCPU.total)
	dIdle := float64(sample.idle - c.prevCPU.idle)
	if dTotal <= 0 {
		return 0, nil
	}
	return (1 - dIdle/dTotal) * 100, nil
}

func readMem() (total, used, swapTotal, swapUsed uint64, err error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, 0, 0, err
	}
	defer f.Close()

	var available, swapFree uint64
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		v, _ := strconv.ParseUint(fields[1], 10, 64) // kB
		switch fields[0] {
		case "MemTotal:":
			total = v * 1024
		case "MemAvailable:":
			available = v * 1024
		case "SwapTotal:":
			swapTotal = v * 1024
		case "SwapFree:":
			swapFree = v * 1024
		}
	}
	return total, total - available, swapTotal, swapTotal - swapFree, nil
}

func (c *Collector) sampleProcesses(now time.Time, sortBy ProcessSort) ([]Process, error) {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return nil, err
	}

	elapsed := now.Sub(c.prevAt).Seconds()
	nextProcs := map[int]procSample{}
	var procs []Process

	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil {
			continue
		}

		stat, ok := readProcStat(pid)
		if !ok {
			continue
		}
		rss, _, _, uid, ok := readProcStatus(pid)
		if !ok {
			continue
		}

		nextProcs[pid] = procSample{cpuTicks: stat.cpuTicks, at: now}

		var cpuPercent float64
		if prev, ok := c.prevProcs[pid]; ok && elapsed > 0 {
			dTicks := float64(stat.cpuTicks-prev.cpuTicks) / clockTicks
			cpuPercent = dTicks / elapsed * 100
		}

		procs = append(procs, Process{
			PID:        pid,
			PPID:       stat.ppid,
			Name:       stat.name,
			User:       c.lookupUsername(uid),
			CPUPercent: cpuPercent,
			MemRSS:     rss,
		})
	}

	c.prevProcs = nextProcs

	if sortBy == SortByMem {
		sort.Slice(procs, func(i, j int) bool { return procs[i].MemRSS > procs[j].MemRSS })
	} else {
		sort.Slice(procs, func(i, j int) bool { return procs[i].CPUPercent > procs[j].CPUPercent })
	}
	return procs, nil
}

// sampleNetwork reports instantaneous rx/tx throughput (bytes/sec) on
// whichever interface currently owns the default route — i.e. the
// interface actually doing outbound communication, as opposed to loopback
// or an interface with only a local subnet route. elapsed is measured
// against c.prevAt the same way sampleProcesses does (both are called
// before c.prevAt is advanced to `now` at the end of Sample).
func (c *Collector) sampleNetwork(now time.Time) (iface string, rxBps, txBps float64) {
	iface, err := DefaultRouteInterface()
	if err != nil {
		c.prevNet = netSample{}
		return "", 0, 0
	}

	rx, tx, ok := readNetDevBytes(iface)
	if !ok {
		c.prevNet = netSample{}
		return "", 0, 0
	}
	defer func() { c.prevNet = netSample{iface: iface, rx: rx, tx: tx} }()

	// No usable prior sample: either this is the first tick, or the
	// default route's interface changed since the last one (their byte
	// counters aren't comparable). The interface name is still known
	// either way, so it's returned regardless.
	if c.prevNet.iface != iface {
		return iface, 0, 0
	}

	elapsed := now.Sub(c.prevAt).Seconds()
	if elapsed <= 0 {
		return iface, 0, 0
	}

	// Counters only ever increase between comparable samples; a lower
	// reading than last time means the interface was reset (e.g. brought
	// down and back up), not that negative bytes were transferred.
	var rxDelta, txDelta uint64
	if rx >= c.prevNet.rx {
		rxDelta = rx - c.prevNet.rx
	}
	if tx >= c.prevNet.tx {
		txDelta = tx - c.prevNet.tx
	}
	return iface, float64(rxDelta) / elapsed, float64(txDelta) / elapsed
}

// DefaultRouteInterface returns the network interface that owns the
// system's default IPv4 route (destination 0.0.0.0) — the interface
// actually used for outbound connectivity, picked by lowest route metric
// when more than one default route exists (e.g. a VPN alongside the LAN
// uplink). Exported for reuse by the history package, which needs the same
// interface to filter sadf's per-interface network samples.
func DefaultRouteInterface() (string, error) {
	f, err := os.Open("/proc/net/route")
	if err != nil {
		return "", err
	}
	defer f.Close()

	var best string
	bestMetric := 0
	scanner := bufio.NewScanner(f)
	scanner.Scan() // header line
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		// Iface Destination Gateway Flags RefCnt Use Metric Mask ...
		if len(fields) < 7 || fields[1] != "00000000" {
			continue
		}
		metric, _ := strconv.Atoi(fields[6])
		if best == "" || metric < bestMetric {
			best, bestMetric = fields[0], metric
		}
	}
	if best == "" {
		return "", fmt.Errorf("no default route found")
	}
	return best, nil
}

// RootDiskDevice returns the base block device backing the root filesystem
// ("vda" for a root on /dev/vda2, "nvme0n1" for /dev/nvme0n1p1), resolved
// via sysfs since sar -d reports whole-disk devices, not partitions.
// Exported for reuse by the history package, which needs the same device to
// filter sadf's per-disk utilization samples.
func RootDiskDevice() (string, error) {
	data, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return "", err
	}

	var partName string
	for line := range strings.SplitSeq(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 || fields[1] != "/" {
			continue
		}
		if !strings.HasPrefix(fields[0], "/dev/") {
			return "", fmt.Errorf("root filesystem is not on a block device")
		}
		partName = strings.TrimPrefix(fields[0], "/dev/")
		break
	}
	if partName == "" {
		return "", fmt.Errorf("could not find root filesystem in /proc/mounts")
	}

	// A whole-disk device (root not on a partition) has no "partition" file
	// under sysfs — return it as-is rather than walking to a parent.
	if _, err := os.Stat("/sys/class/block/" + partName + "/partition"); err != nil {
		return partName, nil
	}

	link, err := os.Readlink("/sys/class/block/" + partName)
	if err != nil {
		return partName, nil
	}
	parts := strings.Split(link, "/")
	if len(parts) < 2 {
		return partName, nil
	}
	return parts[len(parts)-2], nil
}

// readNetDevBytes reads iface's cumulative rx/tx byte counters from
// /proc/net/dev.
func readNetDevBytes(iface string) (rx, tx uint64, ok bool) {
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, false
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		idx := strings.IndexByte(line, ':')
		if idx < 0 || strings.TrimSpace(line[:idx]) != iface {
			continue
		}
		// Receive: bytes packets errs drop fifo frame compressed multicast
		// (8 fields) then Transmit starts with bytes at index 8.
		fields := strings.Fields(line[idx+1:])
		if len(fields) < 9 {
			return 0, 0, false
		}
		rxVal, _ := strconv.ParseUint(fields[0], 10, 64)
		txVal, _ := strconv.ParseUint(fields[8], 10, 64)
		return rxVal, txVal, true
	}
	return 0, 0, false
}

// procStat is everything sampleProcesses and ProcessDetail both need out of
// /proc/[pid]/stat, parsed once so the two never risk disagreeing on field
// indices.
type procStat struct {
	name       string
	ppid       int
	state      byte
	priority   int
	nice       int
	threads    int
	startTicks uint64
	cpuTicks   uint64 // user+system
}

// readProcStat parses /proc/[pid]/stat. The comm field is parenthesized and
// may itself contain spaces/parens, so it's located by the last ')' rather
// than split.
func readProcStat(pid int) (procStat, bool) {
	data, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/stat")
	if err != nil {
		return procStat{}, false
	}
	line := string(data)
	open := strings.IndexByte(line, '(')
	closeIdx := strings.LastIndexByte(line, ')')
	if open < 0 || closeIdx < 0 || closeIdx < open {
		return procStat{}, false
	}
	name := line[open+1 : closeIdx]

	fields := strings.Fields(line[closeIdx+1:])
	// 0-indexed from state (field 3 in proc(5)'s own 1-indexed listing):
	// state=0, ppid=1, ..., utime=11, stime=12, ..., priority=15, nice=16,
	// num_threads=17, itrealvalue=18, starttime=19, ...
	if len(fields) < 20 {
		return procStat{}, false
	}
	ppid, _ := strconv.Atoi(fields[1])
	utime, _ := strconv.ParseUint(fields[11], 10, 64)
	stime, _ := strconv.ParseUint(fields[12], 10, 64)
	priority, _ := strconv.Atoi(fields[15])
	nice, _ := strconv.Atoi(fields[16])
	threads, _ := strconv.Atoi(fields[17])
	startTicks, _ := strconv.ParseUint(fields[19], 10, 64)

	return procStat{
		name:       name,
		ppid:       ppid,
		state:      fields[0][0],
		priority:   priority,
		nice:       nice,
		threads:    threads,
		startTicks: startTicks,
		cpuTicks:   utime + stime,
	}, true
}

func readProcStatus(pid int) (rss, vmSize, vmSwap uint64, uid uint32, ok bool) {
	f, err := os.Open("/proc/" + strconv.Itoa(pid) + "/status")
	if err != nil {
		return 0, 0, 0, 0, false
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	found := false
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		switch fields[0] {
		case "VmRSS:":
			v, _ := strconv.ParseUint(fields[1], 10, 64)
			rss = v * 1024
			found = true
		case "VmSize:":
			v, _ := strconv.ParseUint(fields[1], 10, 64)
			vmSize = v * 1024
		case "VmSwap:":
			v, _ := strconv.ParseUint(fields[1], 10, 64)
			vmSwap = v * 1024
		case "Uid:":
			v, _ := strconv.ParseUint(fields[1], 10, 32)
			uid = uint32(v)
		}
	}
	return rss, vmSize, vmSwap, uid, found
}

// readBootTime reads /proc/stat's btime (system boot time, seconds since
// the epoch) — needed to turn a process's starttime (in clock ticks since
// boot) into an absolute time.
func readBootTime() (time.Time, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return time.Time{}, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) == 2 && fields[0] == "btime" {
			sec, _ := strconv.ParseInt(fields[1], 10, 64)
			return time.Unix(sec, 0), nil
		}
	}
	return time.Time{}, fmt.Errorf("btime not found in /proc/stat")
}

// readCmdline joins /proc/[pid]/cmdline's NUL-separated argv with spaces.
// Kernel threads have no argv, so it falls back to the bracketed comm name,
// matching ps's own convention for them.
func readCmdline(pid int, name string) string {
	data, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/cmdline")
	if err != nil || len(data) == 0 {
		return "[" + name + "]"
	}
	data = bytes.TrimRight(data, "\x00")
	return string(bytes.ReplaceAll(data, []byte{0}, []byte(" ")))
}

// readProcLink best-effort resolves /proc/[pid]/<name> (exe, cwd) — left
// empty rather than erroring when unreadable, e.g. a zombie has no exe, and
// a process owned by another user is unreadable unless apanel runs as root.
func readProcLink(pid int, name string) string {
	target, err := os.Readlink(fmt.Sprintf("/proc/%d/%s", pid, name))
	if err != nil {
		return ""
	}
	return target
}

// countOpenFiles best-effort counts open file descriptors; -1 if
// /proc/[pid]/fd can't be listed (no permission, or the process already
// exited).
func countOpenFiles(pid int) int {
	entries, err := os.ReadDir(fmt.Sprintf("/proc/%d/fd", pid))
	if err != nil {
		return -1
	}
	return len(entries)
}

// ProcessDetail reads a single process's full detail straight from /proc.
// CPU% reuses the previous sample recorded by the most recent Sample call
// (when the pid was present in it) instead of taking a fresh two-point
// measurement, which would mean blocking on a sleep here — the dashboard
// already polls every 2s, so prevProcs is never far out of date.
func (c *Collector) ProcessDetail(pid int) (ProcessDetail, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	stat, ok := readProcStat(pid)
	if !ok {
		return ProcessDetail{}, ErrProcessNotFound
	}
	rss, vmSize, vmSwap, uid, ok := readProcStatus(pid)
	if !ok {
		return ProcessDetail{}, ErrProcessNotFound
	}

	var cpuPercent float64
	if prev, ok := c.prevProcs[pid]; ok {
		if elapsed := time.Since(prev.at).Seconds(); elapsed > 0 {
			dTicks := float64(stat.cpuTicks-prev.cpuTicks) / clockTicks
			cpuPercent = dTicks / elapsed * 100
		}
	}

	startTime := time.Time{}
	if boot, err := readBootTime(); err == nil {
		startTime = boot.Add(time.Duration(float64(stat.startTicks)/clockTicks) * time.Second)
	}

	return ProcessDetail{
		PID:        pid,
		PPID:       stat.ppid,
		Name:       stat.name,
		State:      string(stat.state),
		User:       c.lookupUsername(uid),
		CPUPercent: cpuPercent,
		MemRSS:     rss,
		Cmdline:    readCmdline(pid, stat.name),
		Exe:        readProcLink(pid, "exe"),
		Cwd:        readProcLink(pid, "cwd"),
		StartTime:  startTime,
		Priority:   stat.priority,
		Nice:       stat.nice,
		Threads:    stat.threads,
		VmSize:     vmSize,
		VmSwap:     vmSwap,
		OpenFiles:  countOpenFiles(pid),
	}, nil
}

func (c *Collector) lookupUsername(uid uint32) string {
	if name, ok := c.usernames[uid]; ok {
		return name
	}
	name := strconv.FormatUint(uint64(uid), 10)
	if u, err := user.LookupId(name); err == nil {
		name = u.Username
	}
	c.usernames[uid] = name
	return name
}
