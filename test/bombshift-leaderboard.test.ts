import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('per-level top five: fastest first, unique account, ties stable, private names hidden and invalid results excluded', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table profiles(id uuid primary key, username text, ghost_mode boolean default false, profile_visible boolean default true);
      create table bombshift_account_progress(user_id uuid primary key,save_data jsonb);`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261119150905_bombshift_level_top5.sql',import.meta.url),'utf8'));
    for (let i=1;i<=12;i++) {
      const id=`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
      await db.query('insert into profiles(id,username,ghost_mode) values($1,$2,$3)',[id,`Player ${i}`,i===2]);
      const time=i===9?-1:i===10?'invalid':i===11?0:i===12?null:i===3?2000:i*1000;
      await db.query('insert into bombshift_account_progress values($1,$2)',[id,JSON.stringify({maps:{'level-80':{cleared:i!==1,bestTimeMs:time},volcano:{cleared:true,bestTimeMs:20000+i}}})]);
    }
    const {rows} = await db.query<{rank:number;username:string;best_time_ms:number}>("select * from bombshift_level_top5('level-80')");
    assert.equal(rows.length,5);
    assert.deepEqual(rows.map(r=>Number(r.best_time_ms)),[2000,2000,4000,5000,6000]);
    assert.deepEqual(rows.map(r=>Number(r.rank)),[1,2,3,4,5]);
    assert.equal(rows[0].username,'Joueur discret');assert.equal(rows[1].username,'Player 3');
    assert.equal((await db.query("select * from bombshift_level_top5('level-81')")).rows.length,0);
    assert.equal((await db.query("select * from bombshift_level_top5('volcano')")).rows.length,5);
    const permission = await db.query<{anon:boolean;authenticated:boolean}>("select has_function_privilege('anon','bombshift_level_top5(text)','execute') as anon, has_function_privilege('authenticated','bombshift_level_top5(text)','execute') as authenticated");
    assert.deepEqual(permission.rows,[{anon:false,authenticated:false}]);
  } finally { await db.close(); }
});
