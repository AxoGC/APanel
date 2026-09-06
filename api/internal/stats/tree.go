package stats

import (
	"os"
	"strconv"
)

// ProcessTree returns rootPID together with every descendant process (its
// children, grandchildren, and so on), found by scanning /proc for each
// process's PPID — the same field sampleProcesses already reads for every
// row of the process list. The result includes rootPID first, provided it
// still exists; a nil result means rootPID has already exited.
func ProcessTree(rootPID int) ([]int, error) {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return nil, err
	}

	children := map[int][]int{}
	exists := false
	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil {
			continue
		}
		stat, ok := readProcStat(pid)
		if !ok {
			continue
		}
		if pid == rootPID {
			exists = true
		}
		children[stat.ppid] = append(children[stat.ppid], pid)
	}
	if !exists {
		return nil, nil
	}

	pids := []int{rootPID}
	for i := 0; i < len(pids); i++ {
		pids = append(pids, children[pids[i]]...)
	}
	return pids, nil
}
