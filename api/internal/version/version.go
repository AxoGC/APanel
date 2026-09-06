// Package version holds the build-time version string and the semver-lite
// comparison the update package needs to decide whether a fetched release
// is actually newer than what's running.
package version

import (
	"strconv"
	"strings"
)

// Version is set via -ldflags at release build time (see the Makefile's
// VERSION var, sourced from an exact git tag). A from-source build that
// isn't built off a tag keeps the "dev" default — there's no upstream
// release to meaningfully compare a dev build against, so the updater
// refuses to touch one (see update.Manager).
var Version = "dev"

// Current returns the running build's version string.
func Current() string { return Version }

// IsNewer reports whether candidate is a newer release than base. Both are
// expected in this project's tag format, "vMAJOR.MINOR.PATCH" — a version
// that doesn't parse never wins a comparison (an unparseable candidate is
// never "newer"; an unparseable base always loses to a parseable
// candidate), so a malformed version string can't accidentally trigger an
// update.
func IsNewer(candidate, base string) bool {
	c, cOK := parseSemver(candidate)
	b, bOK := parseSemver(base)
	if !cOK {
		return false
	}
	if !bOK {
		return true
	}
	for i := range c {
		if c[i] != b[i] {
			return c[i] > b[i]
		}
	}
	return false
}

// parseSemver reads the "vMAJOR.MINOR.PATCH" prefix of v, ignoring any
// trailing pre-release/build metadata (e.g. the "-3-gabcdef" git-describe
// suffix a non-exact-tag dev build would carry).
func parseSemver(v string) ([3]int, bool) {
	v = strings.TrimPrefix(v, "v")
	if i := strings.IndexAny(v, "-+"); i >= 0 {
		v = v[:i]
	}
	parts := strings.SplitN(v, ".", 3)
	if len(parts) != 3 {
		return [3]int{}, false
	}
	var out [3]int
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return [3]int{}, false
		}
		out[i] = n
	}
	return out, true
}
