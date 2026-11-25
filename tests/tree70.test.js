// Step 70 (sharing the Family Tree, ML406, 25 Nov 2026) run for real in an
// in-memory Postgres (pglite), after step 68: only someone the owner has
// ticked can fetch the tree, it holds the tree's people and family links and
// nothing else, a contact someone else shared with the owner stays out unless
// it is shared with the viewer too, and the photos and PDFs follow the share.
// The tables are cut down to the columns the steps touch. Everyone is made up.
// Needs @electric-sql/pglite (npm install @electric-sql/pglite@0.2.17).
const fs = require('fs');
const path = require('path');
let PGlite;
try { ({ PGlite } = require('@electric-sql/pglite')); }
catch (e) { console.log('\nSkipped: needs @electric-sql/pglite for a real database.\n\n0 passed, 0 failed'); process.exit(0); }
const DB = path.join(__dirname, '..', 'database');
const U = { me: '00000000-0000-0000-0000-00000000000a', sandra: '00000000-0000-0000-0000-00000000000b',
  other: '00000000-0000-0000-0000-00000000000c', third: '00000000-0000-0000-0000-00000000000d' };
let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); } else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

(async () => {
  const db = new PGlite();
  await db.exec(`create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
    create role authenticated; create role anon;
    create schema storage; create table storage.objects (bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant select on storage.objects to authenticated;
    create table profiles (id uuid primary key, my_contact_id bigint);
    insert into profiles (id) values ('${U.me}'), ('${U.sandra}'), ('${U.other}'), ('${U.third}');
    create table contacts (id bigint generated always as identity primary key,
      created_by uuid references profiles on delete set null, first_name text, last_name text,
      birth_date date, death_date date, phones jsonb default '[]', photos jsonb default '[]', notes text);
    create table contact_shares (contact_id bigint references contacts on delete cascade,
      user_id uuid references profiles on delete cascade, can_edit boolean not null default true,
      primary key (contact_id, user_id));
    create table relationships (id bigint generated always as identity primary key,
      from_contact bigint not null references contacts on delete cascade,
      to_contact bigint not null references contacts on delete cascade,
      kind text not null, notes text, created_at timestamptz default now(),
      check (from_contact <> to_contact), unique (from_contact, to_contact, kind));
    create table link_kinds (id bigint generated always as identity primary key,
      name text not null unique, inverse_name text not null, sort_order int default 100);
    insert into link_kinds (name, inverse_name, sort_order) values
      ('Partner of','Partner of',10), ('Married to','Married to',20), ('Parent of','Child of',30),
      ('Child of','Parent of',40), ('Sibling of','Sibling of',50), ('Friend of','Friend of',120);
    create or replace function photo_contact_id(objname text)
    returns bigint language sql immutable as $$
      select case when objname ~ '^\\d+/' then split_part(objname,'/',1)::bigint end;
    $$;`);
  await db.exec(fs.readFileSync(path.join(DB, 'contacts-step68.sql'), 'utf8'));
  const step = fs.readFileSync(path.join(DB, 'contacts-step70.sql'), 'utf8');
  const q = async (s, a) => (await db.query(s, a)).rows;
  // As someone signed in to the app: their id, and the role the app's requests have.
  const as = (who, sql, args) => db.transaction(async tx => {
    await tx.query(`select set_config('app.uid', $1, true)`, [who ? U[who] : '']);
    await tx.query('set local role authenticated');
    return (await tx.query(sql, args)).rows; });
  const err = async (who, sql, args) => { try { await as(who, sql, args); return null; } catch (e) { return e.message; } };

  console.log('\nStep 70 runs, and runs again');
  let r1, r2, bad = null;
  try { r1 = await db.exec(step); } catch (e) { bad = e.message; }
  ok('it runs', bad === null, bad);
  try { r2 = await db.exec(step); } catch (e) { bad = e.message; }
  ok('  and again, safely', bad === null, bad);
  const check = r2 && r2[r2.length - 1].rows;
  ok('  its check shows 9 lines: the table, 2 rules, 4 functions, 2 storage rules', check && check.length === 9
    && check.filter(x => x.what === 'function').length === 4 && check.filter(x => x.what === 'storage rule').length === 2
    && check.filter(x => x.what === 'table rule').length === 2, JSON.stringify(check));
  ok('  no rule on contacts or links is added or changed', Number((await q(`select count(*) as n from pg_policies
    where tablename in ('contacts','relationships','contact_shares')`))[0].n) === 0);
  // Supabase lets signed-in people at a new table; its rules then decide.
  await db.exec(`grant select, insert, update, delete on tree_shares to authenticated;`);

  // ---------- the people ----------
  const add = async (who, first, more = '') => Number((await q(`insert into contacts (created_by, first_name${more ? ', ' + more.split('=')[0] : ''})
    values ('${U[who]}', '${first}'${more ? ', ' + more.split('=')[1] : ''}) returning id`))[0].id);
  const meC = await add('me', 'Self'), mum = await add('me', 'Mum', `phones='[{"label":"Mobile","value":"07000 000000"}]'`);
  const gran = await add('me', 'Gran', 'tree_only=true'), grandad = await add('me', 'Grandad', 'tree_only=true');
  const pal = await add('me', 'Pal'), loner = await add('me', 'Loner', `ged_id='252000000009'`);
  const aunt = await add('third', 'Aunt'), uncle = await add('third', 'Uncle');
  const sMum = await add('sandra', 'SandraMum'), sSelf = await add('sandra', 'SandraSelf');
  await db.exec(`update profiles set my_contact_id = ${meC} where id = '${U.me}';
    insert into contact_shares (contact_id, user_id) values (${aunt}, '${U.me}'), (${uncle}, '${U.me}'), (${uncle}, '${U.sandra}');
    insert into relationships (from_contact, to_contact, kind) values
      (${mum}, ${meC}, 'Parent of'), (${gran}, ${mum}, 'Parent of'), (${grandad}, ${gran}, 'Married to'),
      (${meC}, ${pal}, 'Friend of'), (${aunt}, ${mum}, 'Sibling of'), (${uncle}, ${gran}, 'Sibling of'),
      (${sMum}, ${sSelf}, 'Parent of');`);

  console.log('\nOnly someone ticked can fetch the tree');
  ok('before it is shared, Sandra is told it is not shared with her',
    /not shared with you/.test(await err('sandra', 'select family_tree($1)', [U.me]) || ''));
  ok('the owner ticks Sandra', await err('me', `insert into tree_shares (owner_id, viewer_id) values ($1, $2)`, [U.me, U.sandra]) === null);
  ok('  nobody can share someone else\'s tree', /row-level security|policy/i.test(await err('sandra',
    `insert into tree_shares (owner_id, viewer_id) values ($1, $2)`, [U.me, U.other]) || ''));
  ok('  nor share it with themselves', /check/i.test(await err('me',
    `insert into tree_shares (owner_id, viewer_id) values ($1, $1)`, [U.me]) || ''));
  ok('  Sandra and the owner see the share; someone else does not',
    (await as('sandra', 'select * from tree_shares')).length === 1 && (await as('me', 'select * from tree_shares')).length === 1
    && (await as('other', 'select * from tree_shares')).length === 0);
  ok('  Sandra cannot take the owner\'s share away, only the owner can',
    (await as('sandra', `delete from tree_shares where owner_id = $1 returning 1`, [U.me])).length === 0
    && Number((await q('select count(*) as n from tree_shares'))[0].n) === 1);
  ok('someone not ticked still cannot fetch it', /not shared with you/.test(await err('other', 'select family_tree($1)', [U.me]) || ''));
  ok('  nor anyone not signed in', /not shared with you/.test(await err(null, 'select family_tree($1)', [U.me]) || ''));
  ok('  and the list of who is in a tree is for the database alone', /permission denied/i.test(await err('sandra',
    'select * from tree_ids($1)', [U.me]) || ''));

  console.log('\nWhat Sandra gets');
  const t = (await as('sandra', 'select family_tree($1) as t', [U.me]))[0].t;
  const ids = t.people.map(p => Number(p.id)).sort((a, b) => a - b);
  const want = [meC, mum, gran, grandad, loner, uncle].sort((a, b) => a - b);
  ok('everyone in the tree: the owner, their family, the family-only people, someone from Ancestry', JSON.stringify(ids) === JSON.stringify(want),
    JSON.stringify(ids) + ' wanted ' + JSON.stringify(want));
  ok('  a friend who is not family stays out', !ids.includes(pal));
  ok('  a contact someone else shared only with the owner stays out', !ids.includes(aunt));
  ok('  one they shared with Sandra too is in', ids.includes(uncle));
  ok('  Sandra\'s own family, which the owner cannot see, is not part of it', !ids.includes(sMum) && !ids.includes(sSelf));
  const ls = t.links.map(l => l.kind + ':' + l.from_contact + '-' + l.to_contact).sort();
  ok('the family links between them, and only those', ls.length === 4 && ls.includes(`Parent of:${mum}-${meC}`)
    && ls.includes(`Married to:${grandad}-${gran}`) && ls.includes(`Sibling of:${uncle}-${gran}`)
    && !ls.some(x => x.startsWith('Friend of')), JSON.stringify(ls));
  ok('the owner is the one to start in the middle', Number(t.mid) === meC);
  const m = t.people.find(p => Number(p.id) === mum);
  ok('a contact in the tree comes with the whole card', m && m.phones && m.phones[0].value === '07000 000000');
  ok('a family-only person comes with their family box', t.people.find(p => Number(p.id) === gran).tree_only === true);

  console.log('\nThe photos and PDFs follow the share');
  await db.exec(`insert into storage.objects values
    ('photos', '${mum}/a.jpg'), ('photos', '${pal}/b.jpg'), ('photos', 'fam/${U.me}/c.pdf'),
    ('photos', 'fam/${U.other}/d.pdf'), ('photos', '${aunt}/e.jpg'), ('photos', '${gran}/f.jpg'),
    ('receipts', 'fam/${U.me}/g.pdf');`);
  const seen = async who => (await as(who, 'select name from storage.objects order by name')).map(x => x.name);
  const s = await seen('sandra');
  ok('Sandra can see the photos of a contact in the tree', s.includes(`${mum}/a.jpg`) && s.includes(`${gran}/f.jpg`), JSON.stringify(s));
  ok('  and the owner\'s tree photos and PDFs', s.includes(`fam/${U.me}/c.pdf`));
  ok('  not a friend\'s photos, nor someone else\'s tree, nor a contact kept out of it',
    !s.includes(`${pal}/b.jpg`) && !s.includes(`fam/${U.other}/d.pdf`) && !s.includes(`${aunt}/e.jpg`));
  ok('  nothing outside the photos', !s.includes(`fam/${U.me}/g.pdf`));
  ok('someone not ticked sees none of it, only their own tree\'s PDF (step 68)',
    JSON.stringify(await seen('other')) === JSON.stringify([`fam/${U.other}/d.pdf`]), JSON.stringify(await seen('other')));
  ok('  and the two new rules only let someone look', JSON.stringify((await q(`select cmd from pg_policies
    where schemaname = 'storage' and policyname like '%shared with me'`)).map(x => x.cmd)) === '["SELECT","SELECT"]');

  console.log('\nUnticked, it is gone');
  ok('the owner unticks Sandra', (await as('me', `delete from tree_shares where viewer_id = $1 returning 1`, [U.sandra])).length === 1);
  ok('  she cannot fetch the tree', /not shared with you/.test(await err('sandra', 'select family_tree($1)', [U.me]) || ''));
  ok('  nor see its photos and PDFs', (await seen('sandra')).length === 0);
  await db.exec(`insert into tree_shares (owner_id, viewer_id) values ('${U.me}', '${U.sandra}');
    delete from profiles where id = '${U.sandra}';`);
  ok('a sign-in taken away takes its shares with it', Number((await q('select count(*) as n from tree_shares'))[0].n) === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
