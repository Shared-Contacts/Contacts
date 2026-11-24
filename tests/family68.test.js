// Step 68 (the Family Tree, ML402, 24 Nov 2026) run for real in an in-memory
// Postgres (pglite): it runs, runs again safely, marks the connection types,
// and keeps each link's tree_only right as people are ticked or unticked
// "Family tree only", so the everyday list can leave the tree's links out.
// The tables are cut down to the columns step 68 touches.
// Needs @electric-sql/pglite (npm install @electric-sql/pglite@0.2.17).
const fs = require('fs');
const path = require('path');
let PGlite;
try { ({ PGlite } = require('@electric-sql/pglite')); }
catch (e) { console.log('\nSkipped: needs @electric-sql/pglite for a real database.\n\n0 passed, 0 failed'); process.exit(0); }
const DB = path.join(__dirname, '..', 'database');
const ME = '11111111-1111-1111-1111-111111111111';
let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); } else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

(async () => {
  const db = new PGlite();
  await db.exec(`create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
    create role authenticated; create role anon;
    create schema storage; create table storage.objects (bucket_id text, name text);
    alter table storage.objects enable row level security;
    create table profiles (id uuid primary key);
    insert into profiles values ('${ME}');
    create table contacts (id bigint generated always as identity primary key,
      created_by uuid references profiles on delete set null, first_name text, last_name text,
      birth_date date, death_date date);
    create table relationships (id bigint generated always as identity primary key,
      from_contact bigint not null references contacts on delete cascade,
      to_contact bigint not null references contacts on delete cascade,
      kind text not null, notes text, created_at timestamptz default now(),
      check (from_contact <> to_contact), unique (from_contact, to_contact, kind));
    create table link_kinds (id bigint generated always as identity primary key,
      name text not null unique, inverse_name text not null, sort_order int default 100);
    insert into link_kinds (name, inverse_name, sort_order) values
      ('Partner of','Partner of',10), ('Married to','Married to',20), ('Parent of','Child of',30),
      ('Child of','Parent of',40), ('Sibling of','Sibling of',50), ('Friend of','Friend of',120);`);
  const step = fs.readFileSync(path.join(DB, 'contacts-step68.sql'), 'utf8');
  const q = async s => (await db.query(s)).rows;

  console.log('\nStep 68 runs, and runs again');
  let r1, r2, err = '';
  try { r1 = await db.exec(step); } catch (e) { err = e.message; }
  ok('it runs', !err, err);
  try { r2 = await db.exec(step); } catch (e) { err = e.message; }
  ok('and again, safely', !err, err);
  const check = r2 && r2[r2.length - 1].rows;
  ok('its check shows 12 lines, then the 5 connection types', check && check.length === 17
    && check.filter(x => x.what === 'zz connection type').map(x => x.name).sort().join(' | ')
      === 'Child of = child | Married to = partner | Parent of = parent | Partner of = partner | Sibling of = sibling',
    JSON.stringify(check));
  ok('  no connection type added twice', (await q(`select count(*)::int n from link_kinds`))[0].n === 6);

  console.log('\nThe columns');
  await db.exec(`insert into contacts (created_by, first_name) values ('${ME}', 'Nan');`);
  const c = (await q(`select tree_only, sex, ged_id, family from contacts`))[0];
  ok('a contact starts as an everyday one, with an empty family box', c.tree_only === false && c.sex === null
    && c.ged_id === null && JSON.stringify(c.family) === '{}');
  let bad = '';
  try { await db.exec(`update contacts set sex = 'X'`); } catch (e) { bad = e.message; }
  ok('sex is M, F or nothing', /contacts_sex_check/.test(bad), bad);
  await db.exec(`insert into contacts (created_by, first_name, tree_only, ged_id) values ('${ME}', 'Great-gran', true, '252000000001');`);
  bad = '';
  try { await db.exec(`insert into contacts (created_by, first_name, tree_only, ged_id) values ('${ME}', 'Twice', true, '252000000001');`); } catch (e) { bad = e.message; }
  ok('one person per Ancestry number', /contacts_ged_id_idx|duplicate/.test(bad), bad);
  bad = '';
  try { await db.exec(`update link_kinds set tree_role = 'cousin' where name = 'Friend of'`); } catch (e) { bad = e.message; }
  ok('a connection type is parent, child, partner, sibling or nothing', /tree_role_check/.test(bad), bad);

  console.log('\nLinks know when they are the tree\'s alone');
  await db.exec(`insert into contacts (created_by, first_name, tree_only) values ('${ME}', 'Great-grandad', true);`);
  const id = async n => (await q(`select id from contacts where first_name = '${n}'`))[0].id;
  const nan = await id('Nan'), gg = await id('Great-gran'), gd = await id('Great-grandad');
  await db.exec(`insert into relationships (from_contact, to_contact, kind) values
    (${gg}, ${nan}, 'Parent of'), (${gd}, ${gg}, 'Married to');`);
  await db.exec(`insert into relationships (from_contact, to_contact, kind, tree_only) values (${gd}, ${nan}, 'Parent of', true);`);
  const flag = async (a, b) => (await q(`select tree_only from relationships where from_contact = ${a} and to_contact = ${b}`))[0].tree_only;
  ok('between two family-only people: tree only', await flag(gd, gg) === true);
  ok('to an everyday contact: not, so it still shows on her card', await flag(gg, nan) === false);
  ok('  even if the phone says otherwise', await flag(gd, nan) === false);
  await db.exec(`update contacts set tree_only = false where id = ${gg}`);
  ok('untick Family tree only: her links come back to the everyday list', await flag(gd, gg) === false);
  await db.exec(`update contacts set tree_only = true where id = ${gg}`);
  ok('tick it again: back to the tree alone', await flag(gd, gg) === true && await flag(gg, nan) === false);
  await db.exec(`update relationships set family = '{"married":{"d":"1902-06-01","p":"month","pl":"Leeds"}}' where from_contact = ${gd} and to_contact = ${gg}`);
  ok('a marriage keeps its date and place', (await q(`select family->'married'->>'pl' as pl from relationships where from_contact = ${gd}`))
    .some(x => x.pl === 'Leeds'));
  ok('  and changing it leaves tree only alone', await flag(gd, gg) === true);

  console.log('\nPhotos and PDFs');
  const pol = await q(`select policyname, cmd from pg_policies where schemaname = 'storage' order by 1`);
  ok('three rules for fam/<you>/, to see, add and remove', pol.map(x => x.policyname + ':' + x.cmd).join(',')
    === 'add family files:INSERT,remove family files:DELETE,see family files:SELECT', JSON.stringify(pol));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
