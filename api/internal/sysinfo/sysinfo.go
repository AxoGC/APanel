// Package sysinfo reads static host identity — hostname, distro, kernel,
// architecture, and boot time — for display in the settings page. Unlike
// stats.Collector this holds no state: every field is a fresh point-in-time
// read from /proc, /etc/os-release, and uname(2).
package sysinfo

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type Info struct {
	Hostname string
	Distro   string
	Kernel   string
	Arch     string
	BootTime time.Time
}

func Get() (Info, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return Info{}, err
	}

	var uts syscall.Utsname
	if err := syscall.Uname(&uts); err != nil {
		return Info{}, err
	}

	bootTime, err := readBootTime()
	if err != nil {
		return Info{}, err
	}

	return Info{
		Hostname: hostname,
		Distro:   readDistro(),
		Kernel:   utsString(uts.Release[:]),
		Arch:     utsString(uts.Machine[:]),
		BootTime: bootTime,
	}, nil
}

// utsString converts a NUL-terminated syscall.Utsname field to a string.
func utsString(field []int8) string {
	buf := make([]byte, 0, len(field))
	for _, b := range field {
		if b == 0 {
			break
		}
		buf = append(buf, byte(b))
	}
	return string(buf)
}

// readDistro reads /etc/os-release's PRETTY_NAME. Empty (rather than an
// error) when the file is missing or has no PRETTY_NAME — some minimal
// distros lack it, and this is a display-only field.
func readDistro() string {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return ""
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		if name, ok := strings.CutPrefix(scanner.Text(), "PRETTY_NAME="); ok {
			return strings.Trim(name, `"`)
		}
	}
	return ""
}

// readBootTime reads /proc/stat's btime (system boot time, seconds since
// the epoch).
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
