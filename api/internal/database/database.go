// Package database connects to a single database server — the admin's own
// PostgreSQL or MySQL instance being managed through this panel, not
// apanel's own storage backend (see internal/db) — to browse its databases
// and tables. Both engines are supported; which one a saved connection
// targets is picked by its "type" field, or auto-detected from the local
// host's running services when nothing is configured yet.
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

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/sync/errgroup"

	"apanel/internal/dependency"
	"apanel/internal/settings"
)

var (
	// ErrUnreachable means the connection attempt never got a response from
	// a real database server at all — wrong host/port, or nothing listening
	// there.
	ErrUnreachable = errors.New("database instance unreachable")
	// ErrUnauthorized means a real database server answered but rejected the
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

	detectOnce sync.Once
	detected   engine
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

// engine identifies which SQL dialect/catalog a connConfig targets.
type engine string

const (
	enginePostgres engine = "postgres"
	engineMySQL    engine = "mysql"
)

type connConfig struct {
	engine                          engine
	host, port, username, password string
}

// Defaults match each engine's own fresh-install superuser role and
// standard port — the same "just works with nothing configured but the
// password" spirit as the proxy module's default controller URL. Unlike
// proxy's controller, a bare TCP connection to either engine essentially
// always needs a password (see requiredFields in httpserver/dependency.go),
// so there's no passwordless default to offer here.
const (
	defaultHost = "127.0.0.1"

	defaultPostgresPort = "5432"
	defaultPostgresUser = "postgres"
	// adminDatabasePostgres is Postgres' always-present maintenance
	// database, used for cluster-wide catalog queries (the database list
	// itself, and pg_database_size) that aren't scoped to any one database.
	adminDatabasePostgres = "postgres"

	defaultMySQLPort = "3306"
	defaultMySQLUser = "root"
	// adminDatabaseMySQL is MySQL's always-present information schema —
	// unlike Postgres, MySQL's catalogs are visible from any connection
	// regardless of which database it names, so any always-present name
	// works as the connection target for cluster-wide queries.
	adminDatabaseMySQL = "information_schema"
)

func driverName(eng engine) string {
	if eng == engineMySQL {
		return "mysql"
	}
	return "pgx"
}

func adminDatabaseFor(eng engine) string {
	if eng == engineMySQL {
		return adminDatabaseMySQL
	}
	return adminDatabasePostgres
}

// autoDetectEngine picks a default engine for a fresh install with no saved
// "type" — probing local systemd units for a running Postgres vs. MySQL/
// MariaDB server, so a host with either already installed "just works"
// without the admin first having to know to flip the type selector. Cached
// for the process lifetime: the detected local service isn't expected to
// change under a running apanel.
func (m *Manager) autoDetectEngine(ctx context.Context) engine {
	m.detectOnce.Do(func() {
		m.detected = enginePostgres
		if exists, _ := dependency.Probe(ctx, "postgresql"); exists {
			return
		}
		for _, unit := range []string{"mysql", "mysqld", "mariadb"} {
			if exists, _ := dependency.Probe(ctx, unit); exists {
				m.detected = engineMySQL
				return
			}
		}
	})
	return m.detected
}

// config reads the admin's saved connection settings, falling back to each
// field's engine-appropriate default when nothing has been saved. The
// engine itself falls back to autoDetectEngine when no "type" was ever
// saved, rather than always assuming Postgres.
func (m *Manager) config(ctx context.Context) connConfig {
	raw, found, err := m.settings.Get(dependency.ConnectionSettingsKey("database"))
	var saved map[string]string
	if err == nil && found {
		_ = json.Unmarshal([]byte(raw), &saved)
	}

	eng := enginePostgres
	if t, ok := saved["type"]; ok && t != "" {
		if t == "mysql" {
			eng = engineMySQL
		}
	} else {
		eng = m.autoDetectEngine(ctx)
	}

	cfg := connConfig{engine: eng, host: defaultHost}
	if eng == engineMySQL {
		cfg.port, cfg.username = defaultMySQLPort, defaultMySQLUser
	} else {
		cfg.port, cfg.username = defaultPostgresPort, defaultPostgresUser
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
// one of both engines' own catalogs (tables, columns, row counts) is scoped
// per database, so every connection has to name one up front.
func (m *Manager) dsn(cfg connConfig, dbname string) string {
	if cfg.engine == engineMySQL {
		c := mysql.NewConfig()
		c.Net = "tcp"
		c.Addr = cfg.host + ":" + cfg.port
		c.User = cfg.username
		c.Passwd = cfg.password
		c.DBName = dbname
		c.ParseTime = true
		return c.FormatDSN()
	}
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
// to run a query against it. It also returns the engine the connection was
// opened as, so the caller can pick the right dialect for its queries.
func (m *Manager) open(ctx context.Context, dbname string) (*sql.DB, engine, error) {
	cfg := m.config(ctx)
	db, err := sql.Open(driverName(cfg.engine), m.dsn(cfg, dbname))
	if err != nil {
		return nil, cfg.engine, fmt.Errorf("%w: %v", ErrUnreachable, err)
	}
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, cfg.engine, classifyErr(err)
	}
	return db, cfg.engine, nil
}

// openAdmin is open, scoped to the configured engine's always-present
// admin/catalog database — used for the cluster-wide queries (database
// list, database size) that aren't scoped to any one database.
func (m *Manager) openAdmin(ctx context.Context) (*sql.DB, engine, error) {
	cfg := m.config(ctx)
	return m.open(ctx, adminDatabaseFor(cfg.engine))
}

// classifyErr tells "a real server rejected our credentials" apart from
// "never got a response from anything" — wrong host/port, firewalled,
// nothing listening. Handles both engines' own driver error types.
func classifyErr(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		if strings.HasPrefix(pgErr.Code, "28") { // invalid_authorization_specification class
			return fmt.Errorf("%w: %s", ErrUnauthorized, pgErr.Message)
		}
		return err
	}
	var myErr *mysql.MySQLError
	if errors.As(err, &myErr) {
		if myErr.Number == 1045 { // ER_ACCESS_DENIED_ERROR
			return fmt.Errorf("%w: %s", ErrUnauthorized, myErr.Message)
		}
		return err
	}
	return fmt.Errorf("%w: %v", ErrUnreachable, err)
}

// CheckDependency reports whether the configured (or auto-detected)
// instance is reachable at all. Wrong or missing credentials still count as
// "installed" — a real server answered, it just refused this connection —
// mirroring how the proxy module treats a rejected secret; individual calls
// below surface ErrUnauthorized to the caller separately.
func (m *Manager) CheckDependency(ctx context.Context) dependency.State {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cfg := m.config(ctx)
	db, err := sql.Open(driverName(cfg.engine), m.dsn(cfg, adminDatabaseFor(cfg.engine)))
	if err != nil {
		return dependency.State{}
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		var pgErr *pgconn.PgError
		var myErr *mysql.MySQLError
		if errors.As(err, &pgErr) || errors.As(err, &myErr) {
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

func listDatabaseNames(ctx context.Context, admin *sql.DB, eng engine) ([]string, error) {
	query := `SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true ORDER BY datname`
	if eng == engineMySQL {
		query = `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') ORDER BY schema_name`
	}

	rows, err := admin.QueryContext(ctx, query)
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
// both engines' catalogs are all per-database).
func (m *Manager) ListDatabases(ctx context.Context) ([]DatabaseInfo, error) {
	admin, eng, err := m.openAdmin(ctx)
	if err != nil {
		return nil, err
	}
	defer admin.Close()

	names, err := listDatabaseNames(ctx, admin, eng)
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
	db, eng, err := m.open(ctx, dbname)
	if err != nil {
		return 0, err
	}
	defer db.Close()

	query := `SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE'`
	var args []any
	if eng == engineMySQL {
		query = `SELECT count(*) FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'`
		args = []any{dbname}
	}

	var count int
	if err := db.QueryRowContext(ctx, query, args...).Scan(&count); err != nil {
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
	m      *Manager
	admin  *sql.DB
	engine engine
	names  []string
}

func (m *Manager) OpenDatabaseSizeStream(ctx context.Context) (*DatabaseSizeStream, error) {
	admin, eng, err := m.openAdmin(ctx)
	if err != nil {
		return nil, err
	}
	names, err := listDatabaseNames(ctx, admin, eng)
	if err != nil {
		admin.Close()
		return nil, err
	}
	return &DatabaseSizeStream{m: m, admin: admin, engine: eng, names: names}, nil
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
			var err error
			if s.engine == engineMySQL {
				err = s.admin.QueryRowContext(gctx,
					`SELECT COALESCE(SUM(data_length + index_length), 0) FROM information_schema.tables WHERE table_schema = ?`,
					name).Scan(&bytes)
			} else {
				err = s.admin.QueryRowContext(gctx, `SELECT pg_database_size($1)`, name).Scan(&bytes)
			}
			if err != nil {
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

// listTables fetches a database's table list. For MySQL, "schema" and
// "database" are literally the same name — table_schema on every row will
// just equal dbname — since MySQL has no extra namespace layer under a
// database the way Postgres has "public".
func listTables(ctx context.Context, db *sql.DB, eng engine, dbname string) ([]TableInfo, error) {
	query := `
		SELECT t.table_schema, t.table_name,
		       (SELECT count(*) FROM information_schema.columns c
		        WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name)
		FROM information_schema.tables t
		WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema') AND t.table_type = 'BASE TABLE'
		ORDER BY t.table_schema, t.table_name`
	var args []any
	if eng == engineMySQL {
		query = `
			SELECT t.table_schema, t.table_name,
			       (SELECT count(*) FROM information_schema.columns c
			        WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name)
			FROM information_schema.tables t
			WHERE t.table_schema = ? AND t.table_type = 'BASE TABLE'
			ORDER BY t.table_name`
		args = []any{dbname}
	}

	rows, err := db.QueryContext(ctx, query, args...)
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
	db, eng, err := m.open(ctx, dbname)
	if err != nil {
		return nil, err
	}
	defer db.Close()
	return listTables(ctx, db, eng, dbname)
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
	engine engine
	dbname string
	tables []TableInfo
}

func (m *Manager) OpenTableStatsStream(ctx context.Context, dbname string) (*TableStatsStream, error) {
	db, eng, err := m.open(ctx, dbname)
	if err != nil {
		return nil, err
	}
	tables, err := listTables(ctx, db, eng, dbname)
	if err != nil {
		db.Close()
		return nil, err
	}
	return &TableStatsStream{m: m, db: db, engine: eng, dbname: dbname, tables: tables}, nil
}

func (s *TableStatsStream) Close() { s.db.Close() }

// Run computes every table's row count and total size (indexes included —
// TOAST too, for Postgres, via pg_total_relation_size), calling emit once
// per table — from cache immediately where fresh, otherwise from queries
// run in parallel with every other still-uncached table — and returns once
// every table has been emitted. emit is never called concurrently.
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
			qualified := quoteIdent(s.engine, table.Schema) + "." + quoteIdent(s.engine, table.Name)

			var rowCount int64
			if err := s.db.QueryRowContext(gctx, fmt.Sprintf(`SELECT count(*) FROM %s`, qualified)).Scan(&rowCount); err != nil {
				return classifyErr(err)
			}

			var bytes int64
			var err error
			if s.engine == engineMySQL {
				err = s.db.QueryRowContext(gctx,
					`SELECT COALESCE(data_length + index_length, 0) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
					table.Schema, table.Name).Scan(&bytes)
			} else {
				err = s.db.QueryRowContext(gctx, `SELECT pg_total_relation_size($1::regclass)`, qualified).Scan(&bytes)
			}
			if err != nil {
				return classifyErr(err)
			}

			s.m.store(key, cacheEntry{bytes: bytes, rows: rowCount})
			safeEmit(TableStats{Schema: table.Schema, Name: table.Name, Rows: rowCount, Bytes: bytes})
			return nil
		})
	}
	return group.Wait()
}

func quoteIdent(eng engine, ident string) string {
	if eng == engineMySQL {
		return "`" + strings.ReplaceAll(ident, "`", "``") + "`"
	}
	return `"` + strings.ReplaceAll(ident, `"`, `""`) + `"`
}

// ColumnInfo is one row of a table's schema — everything the columns dialog
// shows about a single column.
type ColumnInfo struct {
	Name         string `json:"name"`
	DataType     string `json:"dataType"`
	Nullable     bool   `json:"nullable"`
	Comment      string `json:"comment"`
	IsPrimaryKey bool   `json:"isPrimaryKey"`
	IsUnique     bool   `json:"isUnique"`
	HasIndex     bool   `json:"hasIndex"`
}

// typeAbbreviations shortens Postgres' format_type's verbose SQL-standard
// spellings down to the names admins actually write in DDL (varchar, not
// "character varying"), matched longest-prefix-first so "character varying"
// is caught before the plain "character" it also starts with. MySQL's
// COLUMN_TYPE is already terse (varchar(255), int unsigned, ...) and needs
// no such treatment.
var typeAbbreviations = [...][2]string{
	{"character varying", "varchar"},
	{"character", "char"},
	{"timestamp without time zone", "timestamp"},
	{"timestamp with time zone", "timestamptz"},
	{"time without time zone", "time"},
	{"time with time zone", "timetz"},
	{"double precision", "float8"},
}

func abbreviateType(formatted string) string {
	for _, pair := range typeAbbreviations {
		if strings.HasPrefix(formatted, pair[0]) {
			return pair[1] + formatted[len(pair[0]):]
		}
	}
	return formatted
}

const columnsQueryPostgres = `
	SELECT
		a.attname,
		format_type(a.atttypid, a.atttypmod),
		NOT a.attnotnull,
		col_description(a.attrelid, a.attnum),
		EXISTS (
			SELECT 1 FROM pg_index i
			WHERE i.indrelid = a.attrelid AND i.indisprimary AND a.attnum = ANY(i.indkey)
		),
		EXISTS (
			SELECT 1 FROM pg_index i
			WHERE i.indrelid = a.attrelid AND i.indisunique
			  AND array_length(i.indkey, 1) = 1 AND i.indkey[0] = a.attnum
		),
		EXISTS (
			SELECT 1 FROM pg_index i
			WHERE i.indrelid = a.attrelid AND a.attnum = ANY(i.indkey)
		)
	FROM pg_attribute a
	JOIN pg_class c ON c.oid = a.attrelid
	JOIN pg_namespace n ON n.oid = c.relnamespace
	WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
	ORDER BY a.attnum`

// columnsQueryMySQL mirrors columnsQueryPostgres using information_schema.
// STATISTICS (MySQL's per-column index catalog) in place of pg_index:
// INDEX_NAME = 'PRIMARY' identifies the primary key, and a single-column
// index (the correlated subquery's count = 1) with NON_UNIQUE = 0 is a
// unique constraint — any row at all means the column is indexed.
const columnsQueryMySQL = `
	SELECT
		c.COLUMN_NAME,
		c.COLUMN_TYPE,
		c.IS_NULLABLE = 'YES',
		COALESCE(c.COLUMN_COMMENT, ''),
		EXISTS (
			SELECT 1 FROM information_schema.STATISTICS s
			WHERE s.TABLE_SCHEMA = c.TABLE_SCHEMA AND s.TABLE_NAME = c.TABLE_NAME
			  AND s.COLUMN_NAME = c.COLUMN_NAME AND s.INDEX_NAME = 'PRIMARY'
		),
		EXISTS (
			SELECT 1 FROM information_schema.STATISTICS s
			WHERE s.TABLE_SCHEMA = c.TABLE_SCHEMA AND s.TABLE_NAME = c.TABLE_NAME
			  AND s.COLUMN_NAME = c.COLUMN_NAME AND s.NON_UNIQUE = 0
			  AND (
			      SELECT COUNT(*) FROM information_schema.STATISTICS s2
			      WHERE s2.TABLE_SCHEMA = s.TABLE_SCHEMA AND s2.TABLE_NAME = s.TABLE_NAME AND s2.INDEX_NAME = s.INDEX_NAME
			  ) = 1
		),
		EXISTS (
			SELECT 1 FROM information_schema.STATISTICS s
			WHERE s.TABLE_SCHEMA = c.TABLE_SCHEMA AND s.TABLE_NAME = c.TABLE_NAME AND s.COLUMN_NAME = c.COLUMN_NAME
		)
	FROM information_schema.COLUMNS c
	WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
	ORDER BY c.ORDINAL_POSITION`

// ListColumns fetches the full schema — type, nullability, comment, and
// primary-key/unique/index membership — of every column in one table.
func (m *Manager) ListColumns(ctx context.Context, dbname, schema, table string) ([]ColumnInfo, error) {
	db, eng, err := m.open(ctx, dbname)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	query := columnsQueryPostgres
	if eng == engineMySQL {
		query = columnsQueryMySQL
	}

	rows, err := db.QueryContext(ctx, query, schema, table)
	if err != nil {
		return nil, classifyErr(err)
	}
	defer rows.Close()

	var infos []ColumnInfo
	for rows.Next() {
		var info ColumnInfo
		var dataType string
		var comment sql.NullString
		if err := rows.Scan(&info.Name, &dataType, &info.Nullable, &comment, &info.IsPrimaryKey, &info.IsUnique, &info.HasIndex); err != nil {
			return nil, err
		}
		info.DataType = dataType
		if eng != engineMySQL {
			info.DataType = abbreviateType(dataType)
		}
		info.Comment = comment.String
		infos = append(infos, info)
	}
	return infos, rows.Err()
}
