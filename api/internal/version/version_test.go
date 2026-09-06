package version

import "testing"

func TestIsNewer(t *testing.T) {
	cases := []struct {
		candidate, base string
		want            bool
	}{
		{"v0.2.0", "v0.1.0", true},
		{"v0.1.1", "v0.1.0", true},
		{"v0.1.0", "v0.1.0", false},
		{"v0.1.0", "v0.2.0", false},
		{"v1.0.0", "v0.9.9", true},
		{"v0.1.0-3-gabcdef", "v0.1.0", false}, // pre-release-ish suffix is stripped, ties lose
		{"garbage", "v0.1.0", false},
		{"v0.2.0", "garbage", true},
		{"garbage", "garbage", false},
	}
	for _, c := range cases {
		if got := IsNewer(c.candidate, c.base); got != c.want {
			t.Errorf("IsNewer(%q, %q) = %v, want %v", c.candidate, c.base, got, c.want)
		}
	}
}
