import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { games as seeds } from './catalog.mjs';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive:true });
  const db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY,price INTEGER NOT NULL CHECK(price>=0));
      CREATE TABLE IF NOT EXISTS demo_orders (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL REFERENCES games(id),amount INTEGER NOT NULL CHECK(amount>=0),created_at INTEGER NOT NULL,UNIQUE(user_id,game_id));`);
    const add = (table, columns) => {
      const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name));
      for (const [name, type] of Object.entries(columns)) if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    };
    add('users', {role:"TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin'))"});
    add('games', {
      title:"TEXT NOT NULL DEFAULT ''", en:"TEXT NOT NULL DEFAULT ''", genre:"TEXT NOT NULL DEFAULT 'Визуал новел'",
      description:"TEXT NOT NULL DEFAULT ''", display_length:"TEXT NOT NULL DEFAULT '1.0'", image:"TEXT NOT NULL DEFAULT 'city.webp'",
      real_build:'INTEGER NOT NULL DEFAULT 1', published:'INTEGER NOT NULL DEFAULT 0', cover_file:'TEXT', active_build:'TEXT',
      created_at:'INTEGER NOT NULL DEFAULT 0', updated_at:'INTEGER NOT NULL DEFAULT 0', revision:'INTEGER NOT NULL DEFAULT 1'
    });
    db.exec(`CREATE TABLE IF NOT EXISTS game_builds (
      id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id), version TEXT NOT NULL, relative_path TEXT NOT NULL UNIQUE,
      files INTEGER NOT NULL, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, created_at INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id)
    ); CREATE INDEX IF NOT EXISTS builds_game ON game_builds(game_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS orders_created ON demo_orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS users_created ON users(created_at DESC);`);
    for (const g of seeds) {
      db.prepare('INSERT OR IGNORE INTO games(id,price) VALUES(?,?)').run(g.id,g.price);
      db.prepare(`UPDATE games SET title=?,en=?,genre=?,description=?,display_length=?,image=?,real_build=?,published=1 WHERE id=? AND title=''`)
        .run(g.title,g.en,g.genre,g.desc,g.length,g.image,g.realBuild?1:0,g.id);
    }
    db.exec('PRAGMA user_version=2; COMMIT;');
    return db;
  } catch(e) { try { db.exec('ROLLBACK'); } catch {} db.close(); throw e; }
}

export function publicGame(row) {
  return {id:row.id,title:row.title,en:row.en,genre:row.genre,desc:row.description,price:row.price,length:row.display_length,
    realBuild:!!row.real_build,published:!!row.published,revision:row.revision,
    image:row.cover_file?`/api/games/${row.id}/cover?v=${row.revision}`:row.image};
}
export function buildLocation(db, root, id) {
  const game=db.prepare('SELECT id,title,active_build FROM games WHERE id=?').get(id);
  if(!game)return null;
  const build=game.active_build?db.prepare('SELECT relative_path FROM game_builds WHERE id=? AND game_id=?').get(game.active_build,id):null;
  if(game.active_build&&!build)return null;
  return {path:resolve(root,build?.relative_path||game.id),title:game.title};
}
