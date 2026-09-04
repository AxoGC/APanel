// Package database connects to a single PostgreSQL instance — the admin's
// own database server being managed through this panel, not apanel's own
// storage backend (see internal/db) — to browse its databases and tables.
// Only PostgreSQL is supported for now; other engines may follow later, but
// nothing here assumes that yet.
package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/sync/errgroup"

	"apanel/internal/dependency"
	"apanel/internal/settings"
)

var (
	// ErrUnreachable means the connection attempt never got a response from
	// a real Postgres server at all — wrong host/port, or nothing listening
	// there.
	ErrUnreachable = errors.New("database instance unreachable")
	// ErrUnauthorized means a real Postgres server answered but rejected the
	// configured credentials.
	ErrUnauthorized = errors.New("database instance rejected credentials")
)

// Manager holds the saved connection settings and an in-memory (never
// persisted — a restart simply loses it) cache of the expensive numbers:
// each database's on-disk size, and each table's row count and size. Both
// are the kind of thing that requires scanning real data to compute, so a
// fresh value is only ever fetched once per cacheTTL.
type Manager struct {
	settings *settings.Manager

	mu    sync.Mutex
	cache map[string]cacheEntry
}

type cacheEntry struct {
	bytes      int64
	rows       int64 // -1 for a database-level entry, which has no row count
	computedAt time.Time
}

const cacheTTL = time.Hour

func New(settingsMgr *settings.Manager) *Manager {
	return &Manager{settings: settingsMgr, cache: make(map[string]cacheEntry)}
}

// Key identifies this package's entry in httpserver's dependency endpoints.
func (m *Manager) Key() string { return "database" }

type connConfig struct {
	host, port, username, password string
}

// Defaults match a fresh local Postgres install reachable with peer/trust
// auth as its superuser — the same "just works with nothing configured"
// spirit as the proxy module's default controller URL.
const (
	defaultHost = "127.0.0.1"
	defaultPort = "5432"
	defaultUser = "root"
	// adminDatabase is Postgres' always-present maintenance database, used
	// for cluster-wide catalog queries (the database list itself, and
	// pg_database_size) that aren't scoped to any one database.
	adminDatabase = "postgres"
)

// config reads the admin's saved connection settings, falling back to
// defaultHost/defaultPort/defaultUser with no password when nothing has
// been saved.
func (m *Manager) config() connConfig {
	cfg := connConfig{host: defaultHost, port: defaultPort, username: defaultUser}
	raw, found, err := m.settings.Get(dependency.ConnectionSettingsKey("database"))
	if err != nil || !found {
		return cfg
	}
	var saved map[string]string
	if json.Unmarshal([]byte(raw), &saved) != nil {
		return cfg
	}
	if v := strings.TrimSpace(saved["host"]); v != "" {
		cfg.host = v
	}
	if v := strings.TrimSpace(saved["port"]); v != "" {
		cfg.port = v
	}
	if v := strings.TrimSpace(saved["username"]); v != "" {
		cfg.username = v
	}
	cfg.password = saved["password"]
	return cfg
}

// dsn builds a connection string targeting one specific database — every
// one of Postgres' own catalogs (tables, columns, row counts) is scoped per
// database, so every connection has to name one up front.
func (m *Manager) dsn(cfg connConfig, dbname string) string {
	u := url.URL{Scheme: "postgres", Host: cfg.host + ":" + cfg.port, Path: "/" + dbname}
	if cfg.password != "" {
		u.User = url.UserPassword(cfg.username, cfg.password)
	} else {
		u.User = url.User(cfg.username)
	}
	u.RawQuery = url.Values{"sslmode": {"disable"}}.Encode()
	return u.String()
}

// open connects to one database and confirms it's reachable, classifying
// any failure as ErrUnauthorized (a real server rejected the credentials)
// or ErrUnreachable (nothing answered at all) before the caller ever tries
// to run a query against it.
func (m *Manager) open(ctx context.Context, dbname string) (*sql.DB, error) {
	db, err := sql.Open("pgx", m.dsn(m.config(), dbname))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnreachable, err)
	}
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, classifyErr(err)
	}
	return db, nil
}

// classifyErr tells "a real Postgres server rejected our credentials" (its
// own SQLSTATE class 28, invalid_authorization_specification) apart from
// "never got a response from anything" — wrong host/port, firewalled,
// nothing listening.
func classifyErr(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		if strings.HasPrefix(pgErr.Code, "28") {
			return fmt.Errorf("%w: %s", ErrUnauthorized, pgErr.Message)
		}
		return err
	}
	return fmt.Errorf("%w: %v", ErrUnreachable, err)
}

// CheckDependency reports whether the configured instance is reachable at
// all. Wrong or missing credentials still count as "installed" — a real
// Postgres server answered, it just refused this connection — mirroring how
// the proxy module treats a rejected secret; individual calls below surface
// ErrUnauthorized to the caller separately.
func (m *Manager) CheckDependency(ctx context.Context) dependency.State {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	db, err := sql.Open("pgx", m.dsn(m.config(), adminDatabase))
	if err != nil {
		return dependency.State{}
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			return dependency.State{Installed: true}
		}
		return dependency.State{}
	}
	return dependency.State{Installed: true}
}

// InvalidateCache drops every cached size/row-count number. Called whenever
// the saved connection settings change — those numbers belong to whichever
// instance was configured when they were computed, and would otherwise keep
// answering for the wrong instance for up to an hour.
func (m *Manager) InvalidateCache() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache = make(map[string]cacheEntry)
}

func (m *Manager) cached(key string) (cacheEntry, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	entry, found := m.cache[key]
	if !found || time.Since(entry.computedAt) > cacheTTL {
		return cacheEntry{}, false
	}
	return entry, true
}

func (m *Manager) store(key string, entry cacheEntry) {
	entry.computedAt = time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache[key] = entry
}

func tableCacheKey(dbname, schema, table string) string {
	return dbname + "\x00" + schema + "\x00" + table
}

func listDatabaseNames(ctx context.Context, admin *sql.DB) ([]string, error) {
	rows, err := admin.QueryContext(ctx, `SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true ORDER BY datname`)
	if err != nil {
		return nil, classifyErr(err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// DatabaseInfo is one row of the database list, everything except its
// on-disk size (see DatabaseSize/OpenDatabaseSizeStream).
type DatabaseInfo struct {
	Name       string `json:"name"`
	TableCount int    `json:"tableCount"`
}

// ListDatabases fetches every database's name and table count, counting
// tables in parallel across databases (each one needs its own connection —
// Postgres' catalogs are all per-database).
func (m *Manager) ListDatabases(ctx context.Context) ([]DatabaseInfo, error) {
	admin, err := m.open(ctx, adminDatabase)
	if err != nil {
		return nil, err
	}
	defer admin.Close()

	names, err := listDatabaseNames(ctx, admin)
	if err != nil {
		return nil, err
	}

	infos := make([]DatabaseInfo, len(names))
	group, gctx := errgroup.WithContext(ctx)
	for i, name := range names {
		group.Go(func() error {
			count, err := m.tableCount(gctx, name)
			if err != nil {
				return err
			}
			infos[i] = DatabaseInfo{Name: name, TableCount: count}
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}
	return infos, nil
}

func (m *Manager) tableCount(ctx context.Context, dbname string) (int, error) {
	db, err := m.open(ctx, dbname)
	if err != nil {
		return 0, err
	}
	defer db.Close()

	var count int
	err = db.QueryRowContext(ctx, `SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE'`).Scan(&count)
	if err != nil {
		return 0, classifyErr(err)
	}
	return count, nil
}

// DatabaseSize is one database-size event of the size stream.
type DatabaseSize struct {
	Name  string `json:"name"`
	Bytes int64  `json:"bytes"`
}

// DatabaseSizeStream is a size scan that has already connected and listed
// every database — so a connection failure can be reported as a normal
// error response — and is ready to run the (possibly slow) parallel size
// computation once the caller has committed to an SSE response.
type DatabaseSizeStream struct {
	m     *Manager
	admin *sql.DB
	names []string
}

func (m *Manager) OpenDatabaseSizeStream(ctx context.Context) (*DatabaseSizeStream, error) {
	admin, err := m.open(ctx, adminDatabase)
	if err != nil {
		return nil, err
	}
	names, err := listDatabaseNames(ctx, admin)
	if err != nil {
		admin.Close()
		return nil, err
	}
	return &DatabaseSizeStream{m: m, admin: admin, names: names}, nil
}

func (s *DatabaseSizeStream) Close() { s.admin.Close() }

// Run computes every database's size, calling emit once per database — from
// cache immediately where fresh, otherwise from a query run in parallel
// with every other still-uncached database — and returns once every
// database has been emitted. emit is never called concurrently.
func (s *DatabaseSizeStream) Run(ctx context.Context, emit func(DatabaseSize)) error {
	var mu sync.Mutex
	safeEmit := func(size DatabaseSize) {
		mu.Lock()
		defer mu.Unlock()
		emit(size)
	}

	group, gctx := errgroup.WithContext(ctx)
	for _, name := range s.names {
		if entry, ok := s.m.cached(name); ok {
			safeEmit(DatabaseSize{Name: name, Bytes: entry.bytes})
			continue
		}
		group.Go(func() error {
			var bytes int64
			if err := s.admin.QueryRowContext(gctx, `SELECT pg_database_size($1)`, name).Scan(&bytes); err != nil {
				return classifyErr(err)
			}
			s.m.store(name, cacheEntry{bytes: bytes, rows: -1})
			safeEmit(DatabaseSize{Name: name, Bytes: bytes})
			return nil
		})
	}
	return group.Wait()
}

// TableInfo is one row of a database's table list, everything except its
// row count and size (see TableStats/OpenTableStatsStream).
type TableInfo struct {
	Schema      string `json:"schema"`
	Name        string `json:"name"`
	ColumnCount int    `json:"columnCount"`
}

func listTables(ctx context.Context, db *sql.DB) ([]TableInfo, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT t.table_schema, t.table_name,
		       (SELECT count(*) FROM information_schema.columns c
		        WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name)
		FROM information_schema.tables t
		WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema') AND t.table_type = 'BASE TABLE'
		ORDER BY t.table_schema, t.table_name`)
	if err != nil {
		return nil, classifyErr(err)
	}
	defer rows.Close()

	var infos []TableInfo
	for rows.Next() {
		var info TableInfo
		if err := rows.Scan(&info.Schema, &info.Name, &info.ColumnCount); err != nil {
			return nil, err
		}
		infos = append(infos, info)
	}
	return infos, rows.Err()
}

// ListTables fetches every table's schema-qualified name and column count
// for one database.
func (m *Manager) ListTables(ctx context.Context, dbname string) ([]TableInfo, error) {
	db, err := m.open(ctx, dbname)
	if err != nil {
		return nil, err
	}
	defer db.Close()
	return listTables(ctx, db)
}

// TableStats is one table-stats event of the table stats stream.
type TableStats struct {
	Schema string `json:"schema"`
	Name   string `json:"name"`
	Rows   int64  `json:"rows"`
	Bytes  int64  `json:"bytes"`
}

// TableStatsStream is a stats scan that has already connected to a database
// and listed its tables, ready to run the parallel row-count/size
// computation once the caller has committed to an SSE response.
type TableStatsStream struct {
	m      *Manager
	db     *sql.DB
	dbname string
	tables []TableInfo
}

func (m *Manager) OpenTableStatsStream(ctx context.Context, dbname string) (*TableStatsStream, error) {
	db, err := m.open(ctx, dbname)
	if err != nil {
		return nil, err
	}
	tables, err := listTables(ctx, db)
	if err != nil {
		db.Close()
		return nil, err
	}
	return &TableStatsStream{m: m, db: db, dbname: dbname, tables: tables}, nil
}

func (s *TableStatsStream) Close() { s.db.Close() }

// Run computes every table's row count and total size (indexes and TOAST
// included, via pg_total_relation_size), calling emit once per table — from
// cache immediately where fresh, otherwise from queries run in parallel
// with every other still-uncached table — and returns once every table has
// been emitted. emit is never called concurrently.
func (s *TableStatsStream) Run(ctx context.Context, emit func(TableStats)) error {
	var mu sync.Mutex
	safeEmit := func(stats TableStats) {
		mu.Lock()
		defer mu.Unlock()
		emit(stats)
	}

	group, gctx := errgroup.WithContext(ctx)
	for _, table := range s.tables {
		key := tableCacheKey(s.dbname, table.Schema, table.Name)
		if entry, ok := s.m.cached(key); ok {
			safeEmit(TableStats{Schema: table.Schema, Name: table.Name, Rows: entry.rows, Bytes: entry.bytes})
			continue
		}
		group.Go(func() error {
			qualified := quoteIdent(table.Schema) + "." + quoteIdent(table.Name)

			var rowCount int64
			if err := s.db.QueryRowContext(gctx, fmt.Sprintf(`SELECT count(*) FROM %s`, qualified)).Scan(&rowCount); err != nil {
				return classifyErr(err)
			}
			var bytes int64
			if err := s.db.QueryRowContext(gctx, `SELECT pg_total_relation_size($1::regclass)`, qualified).Scan(&bytes); err != nil {
				return classifyErr(err)
			}

			s.m.store(key, cacheEntry{bytes: bytes, rows: rowCount})
			safeEmit(TableStats{Schema: table.Schema, Name: table.Name, Rows: rowCount, Bytes: bytes})
			return nil
		})
	}
	return group.Wait()
}

func quoteIdent(ident string) string {
	return `"` + strings.ReplaceAll(ident, `"`, `""`) + `"`
}
