package users

import (
	"errors"
	"path/filepath"
	"testing"

	"apanel/internal/db"
)

func newTestManager(t *testing.T) *Manager {
	t.Helper()
	t.Setenv("APANEL_DB_PATH", filepath.Join(t.TempDir(), "apanel.db"))
	sqliteDB, err := db.Open()
	if err != nil {
		t.Fatal(err)
	}
	return New(sqliteDB)
}

func TestCreateRejectsShortPassword(t *testing.T) {
	m := newTestManager(t)
	if _, err := m.Create("short1", "alice"); !errors.Is(err, ErrPasswordTooShort) {
		t.Fatalf("err = %v, want ErrPasswordTooShort", err)
	}
}

func TestCreateRejectsDuplicatePassword(t *testing.T) {
	m := newTestManager(t)
	if _, err := m.Create("shared-password", "alice"); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Create("shared-password", "bob"); !errors.Is(err, ErrPasswordDuplicate) {
		t.Fatalf("err = %v, want ErrPasswordDuplicate", err)
	}
}

func TestFindByPasswordMatchesRightUser(t *testing.T) {
	m := newTestManager(t)
	alice, err := m.Create("alices-password", "alice")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.Create("bobs-password", "bob"); err != nil {
		t.Fatal(err)
	}

	found, ok, err := m.FindByPassword("alices-password")
	if err != nil {
		t.Fatal(err)
	}
	if !ok || found.ID != alice.ID {
		t.Fatalf("found = %+v, ok = %v, want id %d", found, ok, alice.ID)
	}

	if _, ok, err := m.FindByPassword("no-such-password"); err != nil || ok {
		t.Fatalf("ok = %v, err = %v, want ok=false", ok, err)
	}
}

func TestSetPasswordRejectsDuplicateAgainstOtherUser(t *testing.T) {
	m := newTestManager(t)
	alice, err := m.Create("alices-password", "alice")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.Create("bobs-password", "bob"); err != nil {
		t.Fatal(err)
	}

	if err := m.SetPassword(alice.ID, "bobs-password"); !errors.Is(err, ErrPasswordDuplicate) {
		t.Fatalf("err = %v, want ErrPasswordDuplicate", err)
	}
	// Setting it back to the same password should be fine.
	if err := m.SetPassword(alice.ID, "alices-password"); err != nil {
		t.Fatalf("re-setting own password: %v", err)
	}
}

func TestDeleteRejectsLastUser(t *testing.T) {
	m := newTestManager(t)
	alice, err := m.Create("alices-password", "alice")
	if err != nil {
		t.Fatal(err)
	}

	if err := m.Delete(alice.ID); !errors.Is(err, ErrLastUser) {
		t.Fatalf("err = %v, want ErrLastUser", err)
	}

	bob, err := m.Create("bobs-password", "bob")
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Delete(alice.ID); err != nil {
		t.Fatalf("deleting alice with bob remaining: %v", err)
	}
	if err := m.Delete(bob.ID); !errors.Is(err, ErrLastUser) {
		t.Fatalf("err = %v, want ErrLastUser", err)
	}
}
