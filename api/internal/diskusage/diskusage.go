// Package diskusage lists the host's real data-storage partitions and their
// space usage, for display in the settings page. "Real" excludes anything
// that isn't an actual on-disk partition holding data: virtual/in-memory
// filesystems (proc, sysfs, tmpfs, devtmpfs, cgroup, ...), container overlay
// mounts (which just re-expose an already-listed partition), and swap
// (which isn't mounted at all, so it never appears in /proc/mounts to begin
// with). Usage figures come straight from statfs(2) — the kernel already
// tracks block counts per mounted filesystem, so there's no need to walk
// the filesystem and sum file sizes ourselves.
package diskusage

import (
	"bufio"
	"os"
	"strings"

	"golang.org/x/sys/unix"
)

type Partition struct {
	Device     string `json:"device"`
	MountPoint string `json:"mountPoint"`
	FSType     string `json:"fsType"`
	TotalBytes uint64 `json:"totalBytes"`
	UsedBytes  uint64 `json:"usedBytes"`
	AvailBytes uint64 `json:"availBytes"`
}

// realFSTypes is an allowlist of filesystem types backed by an actual data
// partition. Everything else (virtual, in-memory, or a union/overlay of a
// partition already listed) is a "system function" mount, not a data one,
// and is skipped.
var realFSTypes = map[string]bool{
	"ext2": true, "ext3": true, "ext4": true,
	"xfs": true, "btrfs": true, "f2fs": true,
	"jfs": true, "reiserfs": true, "reiserfs4": true,
	"ntfs": true, "ntfs3": true, "vfat": true, "exfat": true,
	"zfs": true, "hfsplus": true, "apfs": true,
}

// systemMountPoints are mount points that hold a real filesystem (so
// realFSTypes alone won't catch them) but are still system-function
// partitions rather than data ones — the EFI/boot partitions in particular
// are commonly formatted vfat/ext4, same as a data partition.
var systemMountPoints = map[string]bool{
	"/boot": true, "/boot/efi": true, "/boot/firmware": true, "/efi": true,
}

// List returns every real data partition, deduplicated by source device
// (a device bind-mounted at multiple points is only reported once, at its
// first mount point).
func List() ([]Partition, error) {
	f, err := os.Open("/proc/mounts")
	if err != nil {
		return nil, err
	}
	defer f.Close()

	seen := make(map[string]bool)
	var partitions []Partition

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 3 {
			continue
		}
		device, mountPoint, fsType := fields[0], unescapeMount(fields[1]), fields[2]
		if !realFSTypes[fsType] || systemMountPoints[mountPoint] || seen[device] {
			continue
		}

		var stat unix.Statfs_t
		if err := unix.Statfs(mountPoint, &stat); err != nil {
			continue
		}
		seen[device] = true

		total := uint64(stat.Blocks) * uint64(stat.Bsize)
		avail := uint64(stat.Bavail) * uint64(stat.Bsize)
		used := total - uint64(stat.Bfree)*uint64(stat.Bsize)
		partitions = append(partitions, Partition{
			Device:     device,
			MountPoint: mountPoint,
			FSType:     fsType,
			TotalBytes: total,
			UsedBytes:  used,
			AvailBytes: avail,
		})
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return partitions, nil
}

// unescapeMount decodes the octal escapes /proc/mounts uses for spaces,
// tabs, newlines, and backslashes in mount point paths (e.g. "\040" for " ").
func unescapeMount(s string) string {
	if !strings.Contains(s, `\`) {
		return s
	}
	isOctal := func(c byte) bool { return c >= '0' && c <= '7' }

	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+3 < len(s) && isOctal(s[i+1]) && isOctal(s[i+2]) && isOctal(s[i+3]) {
			b.WriteByte((s[i+1]-'0')*64 + (s[i+2]-'0')*8 + (s[i+3] - '0'))
			i += 3
			continue
		}
		b.WriteByte(s[i])
	}
	return b.String()
}
