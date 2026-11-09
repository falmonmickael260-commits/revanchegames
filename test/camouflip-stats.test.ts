import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('Camouflip : catalogue, statistiques par rôle et total réel',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role authenticated;create table public.game_catalog(slug text primary key,display_name text,sort_order int);
      create table public.game_results(id uuid primary key,game_slug text,raw_payload jsonb);
      create table public.game_result_players(result_id uuid,user_id uuid,outcome text);`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261109000000_camouflip_catalog_stats.sql',import.meta.url),'utf8'));
    const user=randomUUID(),other=randomUUID(),first=randomUUID(),second=randomUUID();
    const firstPayload=JSON.stringify({players:[{userId:user,role:'hunter',eliminations:2,survived:false,timeSeconds:210},{userId:other,role:'prop',eliminations:0,survived:false,timeSeconds:210}]});
    const secondPayload=JSON.stringify({players:[{userId:user,role:'prop',eliminations:0,survived:true,timeSeconds:190}]});
    await db.query('insert into public.game_results(id,game_slug,raw_payload) values ($1,$2,$3),($4,$2,$5)',[first,'camouflip',firstPayload,second,secondPayload]);
    await db.query('insert into public.game_result_players(result_id,user_id,outcome) values ($1,$2,$3),($1,$4,$5),($6,$2,$3)',[first,user,'win',other,'loss',second]);
    const catalog=await db.query('select slug from public.game_catalog where slug=$1',['camouflip']);assert.equal(catalog.rows.length,1);
    const stats=await db.query('select * from public.camouflip_stats where user_id=$1',[user]);
    assert.deepEqual((stats.rows as Array<Record<string,unknown>>).map((row)=>[Number(row.hunter_wins),Number(row.prop_wins),Number(row.props_eliminated),Number(row.rounds_survived),Number(row.time_seconds)]),[[1,1,2,1,400]]);
    const global=await db.query('select * from public.camouflip_global_stats');
    const totals=global.rows[0] as Record<string,unknown>;
    assert.equal(Number(totals.games_played),2);assert.equal(Number(totals.distinct_players),2);
  }finally{await db.close();}
});
