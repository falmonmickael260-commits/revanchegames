import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { POST } from '../src/app/api/game/camouflip/results/route';

test('Camouflip : les résultats navigateur non signés et les corps invalides sont rejetés',async()=>{
  const old=process.env.PLATFORM_SHARED_SECRET;process.env.PLATFORM_SHARED_SECRET='camouflip-route-test-key';
  try{
    const unsigned=await POST(new Request('http://localhost/api/game/camouflip/results',{method:'POST',body:'{}'}));
    assert.equal(unsigned.status,403);
    const raw=JSON.stringify({game:'camouflip',room:'ABCD',players:[{userId:'faux',outcome:'win'}]});
    const stamp=Math.floor(Date.now()/1000).toString();
    const hex=createHmac('sha256',process.env.PLATFORM_SHARED_SECRET).update(`rg-camouflip-result-v1.${stamp}.${raw}`).digest('hex');
    const invalid=await POST(new Request('http://localhost/api/game/camouflip/results',{method:'POST',headers:{'x-rg-signature':`${stamp}.${hex}`},body:raw}));
    assert.equal(invalid.status,400);
    const replay=await POST(new Request('http://localhost/api/game/camouflip/results',{method:'POST',headers:{'x-rg-signature':`1000000000.${hex}`},body:raw}));
    assert.equal(replay.status,403);
  }finally{if(old===undefined)delete process.env.PLATFORM_SHARED_SECRET;else process.env.PLATFORM_SHARED_SECRET=old;}
});
