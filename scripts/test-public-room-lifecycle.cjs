const { Module } = require('node:module');
const assert = require('node:assert/strict');
(async () => {
  // Bundle the actual business logic, replacing only infrastructure boundaries.
  const mocks = {
    '@/lib/supabase/server': 'export const createServiceClient=()=>globalThis.fixture.db; export const createClient=async()=>({auth:{getUser:async()=>({data:{user:{id:globalThis.fixture.user}}})}});',
    './platform': 'export const gameUser=async()=>({user:{id:globalThis.fixture.user},name:"Test"});',
    './server': 'export const openSession=JSON.parse;export const sealSession=JSON.stringify;export async function callGame(command){globalThis.fixture.calls.push(command);return command.operation==="inspect"?{room:globalThis.fixture.room}:{session:{code:"ROOM",token:"new-seat"}};}',
    '@/data/games': 'export const GAMES=[{id:"president",enabled:true}];',
  };
  const result = await require('esbuild').build({ entryPoints:['src/lib/game-connector/public-rooms.ts'], bundle:true, platform:'node', format:'cjs', write:false,
    plugins:[{name:'infrastructure',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:null);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path]}));}}] });
  const module = new Module(__filename);module.paths = require('node:module')._nodeModulePaths(process.cwd());module._compile(result.outputFiles[0].text,__filename);
  let listing = null;
  const fixture = globalThis.fixture = {user:'host',room:{code:'ROOM',instance:'instance-1',isHost:true,count:1,capacity:4,status:'open'},calls:[],db:{
    rpc:async()=>({data:[{id:'listing',game_slug:'president',room_code:'ROOM',instance_key:'instance-1',host_id:'host',host_name:'Test',capacity:4,player_count:1}]}),
    from(table){
      const query={
        upsert:async(value,options)=>{if(!options?.ignoreDuplicates||!listing)listing={...value,id:'listing'};return {error:null};},
        select(){return this;},eq(){return this;},match(){return this;},not(){return this;},
        update(value){this.updateValue=value;return this;},
        async maybeSingle(){
          if(table==='game_room_memberships')return {data:{sealed_session:JSON.stringify({code:'ROOM',token:'existing-host-seat'})}};
          if(listing?.refreshed_at){listing={...listing,...this.updateValue};return {data:{id:listing.id}};}
          return {data:null};
        },
      };return query;
    },
  }};
  const {updatePublicRoom,joinPublicGameRoom,listPublicGameRooms}=module.exports;
  assert.equal(await updatePublicRoom('president',fixture.room,'host'),true,'new room public by default');
  await updatePublicRoom('president',fixture.room,'host',false);
  assert.equal(listing.refreshed_at,null);
  assert.equal(await updatePublicRoom('president',fixture.room,'host'),false,'heartbeat preserves private choice');
  assert.equal(listing.refreshed_at,null);
  assert.equal(await updatePublicRoom('president',fixture.room,'host',true),true,'explicit public choice');
  assert.deepEqual(fixture.calls,[],'visibility never admits or changes seats');
  await joinPublicGameRoom('listing');
  assert.deepEqual(fixture.calls.map(x=>x.operation),['inspect'],'host reuses original seat');
  assert.equal(fixture.calls[0].proof.token,'existing-host-seat');
  const own = (await listPublicGameRooms())[0];assert.equal(own.isHost,true);assert.equal(own.ownRoomCode,'ROOM');
  fixture.user='guest';fixture.calls=[];
  assert.equal((await listPublicGameRooms())[0].ownRoomCode,undefined);
  await joinPublicGameRoom('listing');assert.deepEqual(fixture.calls.map(x=>x.operation),['admit']);
  assert.equal(await updatePublicRoom('president',{...fixture.room,isHost:false},'guest'),false);
  await assert.rejects(updatePublicRoom('president',{...fixture.room,isHost:false},'guest',true),/hôte/);
  console.log('PASS: public by default; private survives heartbeat; visibility preserves seats; host resumes original proof; guests use admission; host-only controls');
})().catch(error=>{console.error(error);process.exit(1)});
