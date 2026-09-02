// Package stats reads live CPU/memory/process data straight from /proc.
// This is intentionally independent of the sysstat/sadf integration used
// for the historical-status module: sadf exports system-wide sar samples,
// not the per-process detail the dashboard's process list needs.
package stats

import (
	"bufio"
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
	CPUPercent float64   `json:"cpuPercent"`
	MemTotal   uint64    `json:"memTotal"`
	MemUsed    uint64    `json:"memUsed"`
	SwapTotal  uint64    `json:"swapTotal"`
	SwapUsed   uint64    `json:"swapUsed"`
	Processes  []Process `json:"processes"`
}

type Process struct {
	PID        int     `json:"pid"`
	Name       string  `json:"name"`
	User       string  `json:"user"`
	CPUPercent float64 `json:"cpuPercent"`
	MemRSS     uint64  `json:"memRSS"`
}

type cpuSample struct {
	idle, total uint64
}

type procSample struct {
	cpuTicks uint64
	at       time.Time
}

// Collector holds the previous samples needed to turn /proc's cumulative
// counters into instantaneous percentages between two ticks.
type Collector struct {
	mu        sync.Mutex
	prevCPU   cpuSample
	prevProcs map[int]procSample
	prevAt    time.Time
	usernames map[uint32]string
}

func NewCollector() *Collector {
	return &Collector{prevProcs: map[int]procSample{}, usernames: map[uint32]string{}}
}

// ProcessSort picks which metric the top-50 process cut (and its order) is
// taken by. Sorting happens before the cut, not after — sorting the client's
// already-truncated top-50-by-CPU list by memory instead would silently drop
// high-memory/low-CPU processes that never made that cut.
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

	c.prevAt = now
	return Overview{
		CPUPercent: cpuPercent,
		MemTotal:   memTotal,
		MemUsed:    memUsed,
		SwapTotal:  swapTotal,
		SwapUsed:   swapUsed,
		Processes:  procs,
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

		name, ticks, ok := readProcStat(pid)
		if !ok {
			continue
		}
		rss, uid, ok := readProcStatus(pid)
		if !ok {
			continue
		}

		nextProcs[pid] = procSample{cpuTicks: ticks, at: now}

		var cpuPercent float64
		if prev, ok := c.prevProcs[pid]; ok && elapsed > 0 {
			dTicks := float64(ticks-prev.cpuTicks) / clockTicks
			cpuPercent = dTicks / elapsed * 100
		}

		procs = append(procs, Process{
			PID:        pid,
			Name:       name,
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
	if len(procs) > 50 {
		procs = procs[:50]
	}
	return procs, nil
}

// readProcStat parses /proc/[pid]/stat for the process name and total
// (user+system) cpu ticks. The comm field is parenthesized and may itself
// contain spaces/parens, so it's located by the last ')' rather than split.
func readProcStat(pid int) (name string, ticks uint64, ok bool) {
	data, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/stat")
	if err != nil {
		return "", 0, false
	}
	line := string(data)
	open := strings.IndexByte(line, '(')
	closeIdx := strings.LastIndexByte(line, ')')
	if open < 0 || closeIdx < 0 || closeIdx < open {
		return "", 0, false
	}
	name = line[open+1 : closeIdx]

	fields := strings.Fields(line[closeIdx+1:])
	// fields[0] is state; utime/stime are fields[11] and [12] (0-indexed
	// from state) per proc(5).
	if len(fields) < 15 {
		return "", 0, false
	}
	utime, _ := strconv.ParseUint(fields[11], 10, 64)
	stime, _ := strconv.ParseUint(fields[12], 10, 64)
	return name, utime + stime, true
}

func readProcStatus(pid int) (rss uint64, uid uint32, ok bool) {
	f, err := os.Open("/proc/" + strconv.Itoa(pid) + "/status")
	if err != nil {
		return 0, 0, false
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
		case "Uid:":
			v, _ := strconv.ParseUint(fields[1], 10, 32)
			uid = uint32(v)
		}
	}
	return rss, uid, found
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
