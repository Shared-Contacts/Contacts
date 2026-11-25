// Step 69 (matches in MY Games, ML411, 25 Nov 2026) run for real in an
// in-memory Postgres (pglite), on top of steps 57, 58 and 60: it runs, runs
// again safely, adds the match column, and set_match only lets whoever
// started a game say which match it is in, once, for a match of the same
// game with the same players. batch1125.test.js checks the app itself.
// Needs @electric-sql/pglite (npm install @electric-sql/pglite@0.2.17).
const fs = require('fs');
const path = require('path');
let PGlite;
try { ({ PGlite } = require('@electric-sql/pglite')); }
catch (e) { console.log('\nSkipped: needs @electric-sql/pglite for a real database.\n\n0 passed, 0 failed'); process.exit(0); }
const DB = path.join(__dirname, '..', 'database');
const U = { me: '00000000-0000-0000-0000-00000000000a', sandra: '00000000-0000-0000-0000-00000000000b',
  other: '00000000-0000-0000-0000-00000000000c' };
let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); } else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

(async () => {
  const db = new PGlite();
  await db.exec(`create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
    create role authenticated; create role anon;
    create table profiles (id uuid primary key);
    insert into profiles values ('${U.me}'), ('${U.sandra}'), ('${U.other}');`);
  for (const n of [57, 58, 60]) await db.exec(fs.readFileSync(path.join(DB, `contacts-step${n}.sql`), 'utf8'));
  const step = fs.readFileSync(path.join(DB, 'contacts-step69.sql'), 'utf8');
  const as = (who, sql, args) => db.transaction(async tx => {
    await tx.query(`select set_config('app.uid', $1, true)`, [U[who]]); return tx.query(sql, args); });
  const err = async (who, sql, args) => { try { await as(who, sql, args); return null; } catch (e) { return e.message; } };
  const game = async (who, players, kind) => Number((await as(who, kind === 'pounds'
    ? 'select new_pounds($1::uuid[], 0, false) as v' : 'select new_game($1::uuid[], 0) as v', [players.map(x => U[x])])).rows[0].v);
  const setm = (who, g, m) => err(who, 'select set_match($1, $2::jsonb)', [g, JSON.stringify(m)]);
  const match = async g => (await db.query('select match from games where id = $1', [g])).rows[0].match;

  console.log('\nStep 69: it runs');
  const old = await game('me', ['me', 'sandra']);
  let ran = null; try { await db.exec(step); } catch (e) { ran = e.message; }
  ok('step 69 runs', ran === null, ran);
  ok('  the games from before have an empty match', JSON.stringify(await match(old)) === '{}');
  ran = null; try { await db.exec(step); } catch (e) { ran = e.message; }
  ok('  and runs again safely', ran === null, ran);
  const chk = await db.query(step.slice(step.indexOf('select \'games match\'')));
  ok('  its check at the end shows 2 ticks', chk.rows.length === 2 && chk.rows.every(r => r.ok === '✓'), JSON.stringify(chk.rows));

  console.log('\nset_match');
  const g1 = await game('me', ['me', 'sandra']);
  ok('a new game has no match yet', JSON.stringify(await match(g1)) === '{}');
  const t0 = (await db.query('select updated_at from games where id = $1', [g1])).rows[0].updated_at;
  ok('whoever started it says it is the first of a best of 5', await setm('me', g1, { of: 5, first: g1 }) === null
    && JSON.stringify(await match(g1)) === JSON.stringify({ of: 5, first: g1 }));
  ok('  which changes updated_at, so the others\' phones hear of it', (await db.query('select updated_at from games where id = $1', [g1])).rows[0].updated_at >= t0);
  ok('  saying the same again is fine (a second try after a lost signal)', await setm('me', g1, { of: 5, first: g1 }) === null);
  ok('  first left out means this game', await setm('me', g1, { of: 5 }) === null);
  ok('  but not a different match', /already part of a match/.test(await setm('me', g1, { of: 3 }) || ''));
  const g1b = await game('me', ['me', 'sandra']);
  ok('only whoever started the game can say', /Only whoever started/.test(await setm('sandra', g1b, { of: 3 }) || ''));
  ok('  nor anyone for a game that doesn\'t exist (what the app asks to see if step 69 is there)', /Only whoever started/.test(await setm('me', 0, { of: 3 }) || ''));
  ok('best of 3, 5 or 7 only', /best of 3, 5 or 7/.test(await setm('me', g1b, { of: 4 }) || '')
    && /best of 3, 5 or 7/.test(await setm('me', g1b, { of: '5' }) || '') && /best of 3, 5 or 7/.test(await setm('me', g1b, []) || ''));
  ok('  and first has to be a game', /not a game/.test(await setm('me', g1b, { of: 5, first: 'x' }) || ''));
  const g2 = await game('sandra', ['sandra', 'me']);
  ok('Sandra starts the next game of the match, players in any order', await setm('sandra', g2, { of: 5, first: g1 }) === null
    && JSON.stringify(await match(g2)) === JSON.stringify({ of: 5, first: g1 }));
  const g3 = await game('me', ['me', 'sandra']);
  ok('a match has to start with its first game', /not the start of a best of 5/.test(await setm('me', g3, { of: 5, first: g2 }) || ''));
  ok('  and be the same length', /not the start of a best of 3/.test(await setm('me', g3, { of: 3, first: g1 }) || ''));
  const g4 = await game('me', ['me', 'other']);
  ok('a match is between the same players', /not between the same players/.test(await setm('me', g4, { of: 5, first: g1 }) || ''));
  const g5 = await game('me', ['me', 'sandra', 'other']);
  ok('  everyone, nobody more', /not between the same players/.test(await setm('me', g5, { of: 5, first: g1 }) || ''));
  const pd = await game('me', ['me', 'sandra'], 'pounds');
  ok('  and the same game: no Pounds in a match of Loxx', /not between the same players/.test(await setm('me', pd, { of: 5, first: g1 }) || ''));
  ok('  nor a first game started after this one', /not between the same players/.test(await setm('me', g1b, { of: 5, first: g3 }) || ''));
  ok('a game from before step 69 can start one: carrying on an old best of 3', await setm('me', g3, { of: 3, first: old }) === null
    && JSON.stringify(await match(g3)) === JSON.stringify({ of: 3, first: old }));
  ok('Pounds has matches too', await setm('me', pd, { of: 7 }) === null && JSON.stringify(await match(pd)) === JSON.stringify({ of: 7, first: pd }));
  ok('nobody can write the column directly: there is still no rule for changing games', await err('me',
    'select count(*) from pg_policies where tablename = \'games\' and cmd <> \'SELECT\'') === null
    && Number((await db.query('select count(*) as n from pg_policies where tablename = \'games\' and cmd <> \'SELECT\'')).rows[0].n) === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
