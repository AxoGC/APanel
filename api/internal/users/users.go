// Package users manages apanel's login accounts. There is no permission
// system: every user has identical, unrestricted access. Users exist
// purely so a login can be attributed to someone for audit-log purposes
// (see internal/auditlog) — a password plus a free-text remark used to
// label that person's actions.
//
// The login form only ever asks for a password, not a username, so a
// password must uniquely identify at most one user; every place a password
// is set (Create, SetPassword) checks it isn't already in use by another
// account. bcrypt's per-hash random salt means there's no way to look a
// password up by index — finding (or ruling out a duplicate for) one means
// comparing it against every stored hash. That's a linear scan on every
// login, but this is meant for a handful of admin accounts, not a large
// user base, so the cost is negligible.
package users

import (
	"crypto/rand"
	"errors"
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"apanel/internal/model"
)

const minPasswordLength = 8

var (
	ErrPasswordTooShort  = errors.New("password too short")
	ErrPasswordDuplicate = errors.New("password already in use by another user")
	ErrLastUser          = errors.New("cannot delete the last remaining user")
	ErrNotFound          = errors.New("user not found")
)

// Info is a user with its password hash stripped out — the only shape ever
// sent to the frontend.
type Info struct {
	ID     uint   `json:"id"`
	Remark string `json:"remark"`
}

type Manager struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Manager {
	return &Manager{db: db}
}

// Bootstrap creates a first user with a random generated password on a
// fresh install (no users exist yet), printing the plaintext once so the
// operator can log in and change it.
func (m *Manager) Bootstrap() error {
	var count int64
	if err := m.db.Model(&model.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	plain, err := generatePassword()
	if err != nil {
		return err
	}
	if _, err := m.Create(plain, "admin"); err != nil {
		return err
	}
	log.Printf("apanel: no users exist yet, generated one: %s", plain)
	log.Printf("apanel: log in with it and change it to one of your own choosing as soon as possible")
	return nil
}

func generatePassword() (string, error) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i, b := range buf {
		buf[i] = alphabet[int(b)%len(alphabet)]
	}
	return string(buf), nil
}

func (m *Manager) List() ([]Info, error) {
	var rows []model.User
	if err := m.db.Order("id asc").Find(&rows).Error; err != nil {
		return nil, err
	}
	infos := make([]Info, 0, len(rows))
	for _, u := range rows {
		infos = append(infos, Info{ID: u.ID, Remark: u.Remark})
	}
	return infos, nil
}

// FindByPassword scans every user's hash for one matching password. See the
// package doc for why this can't be an indexed lookup.
func (m *Manager) FindByPassword(password string) (model.User, bool, error) {
	var rows []model.User
	if err := m.db.Find(&rows).Error; err != nil {
		return model.User{}, false, err
	}
	for _, u := range rows {
		if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) == nil {
			return u, true, nil
		}
	}
	return model.User{}, false, nil
}

// isDuplicate reports whether password already belongs to a user other than
// excludeID (0 excludes nothing, since it's never a real row's id).
func (m *Manager) isDuplicate(password string, excludeID uint) (bool, error) {
	var rows []model.User
	if err := m.db.Find(&rows).Error; err != nil {
		return false, err
	}
	for _, u := range rows {
		if u.ID == excludeID {
			continue
		}
		if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) == nil {
			return true, nil
		}
	}
	return false, nil
}

func (m *Manager) Create(password, remark string) (Info, error) {
	if len(password) < minPasswordLength {
		return Info{}, ErrPasswordTooShort
	}
	dup, err := m.isDuplicate(password, 0)
	if err != nil {
		return Info{}, err
	}
	if dup {
		return Info{}, ErrPasswordDuplicate
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return Info{}, err
	}
	u := model.User{PasswordHash: string(hash), Remark: remark, CreatedAt: time.Now()}
	if err := m.db.Create(&u).Error; err != nil {
		return Info{}, err
	}
	return Info{ID: u.ID, Remark: u.Remark}, nil
}

// SetPassword resets any user's password from the users-management
// dialog — there's no current-password check here, and none needed: it's
// only reachable by a caller who already holds a valid session, and every
// user has unrestricted access by design.
func (m *Manager) SetPassword(id uint, newPassword string) error {
	if len(newPassword) < minPasswordLength {
		return ErrPasswordTooShort
	}
	dup, err := m.isDuplicate(newPassword, id)
	if err != nil {
		return err
	}
	if dup {
		return ErrPasswordDuplicate
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	res := m.db.Model(&model.User{}).Where("id = ?", id).Update("password_hash", string(hash))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (m *Manager) SetRemark(id uint, remark string) error {
	res := m.db.Model(&model.User{}).Where("id = ?", id).Update("remark", remark)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// Exists reports whether id is still a real user — used by auth's session
// check so a deleted user's outstanding session stops working immediately
// instead of staying valid until it naturally expires.
func (m *Manager) Exists(id uint) bool {
	var count int64
	m.db.Model(&model.User{}).Where("id = ?", id).Count(&count)
	return count > 0
}

// Remark returns id's current remark, or "" if it no longer exists — used
// as a best-effort audit-log label, where a deleted user shouldn't blow up
// the request that's being logged.
func (m *Manager) Remark(id uint) string {
	var u model.User
	if err := m.db.First(&u, "id = ?", id).Error; err != nil {
		return ""
	}
	return u.Remark
}

func (m *Manager) Delete(id uint) error {
	var count int64
	if err := m.db.Model(&model.User{}).Count(&count).Error; err != nil {
		return err
	}
	if count <= 1 {
		return ErrLastUser
	}
	res := m.db.Delete(&model.User{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}
