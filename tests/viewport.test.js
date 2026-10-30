import test from 'node:test';
import assert from 'node:assert/strict';
import {viewportLayout,WIDTH,HEIGHT,roadLayout,state} from '../game.js';

test('phone and tablet views preserve sprite proportions and join at the seam',()=>{
  for(const [w,h] of [[320,568],[375,812],[390,844],[393,852],[430,932],[375,667],[844,390],[768,1024],[1024,768],[2048,1536]]){
    const left=viewportLayout(w,h,'left','together',0);
    const right=viewportLayout(w,h,'right','together',WIDTH);
    assert.ok(Math.abs(w/left.sceneWidth-left.scale)<1e-9);
    assert.ok(left.sceneWidth>=WIDTH);
    assert.ok(left.scale*HEIGHT<=h+1e-9);
    assert.ok(left.offsetY>=-1e-9);
    assert.ok(Math.abs(left.view+left.sceneWidth-right.view)<1e-9);
    assert.equal(right.view,WIDTH);
    if(w/h>WIDTH/HEIGHT)assert.ok(left.sceneWidth>WIDTH);
  }
});

test('wide together screens center starting bears while preserving contact spacing',()=>{
 for(const width of [768,1125,1500]){
  const start=roadLayout(state(),width,'together');
  assert.ok(Math.abs(start.leftX-(WIDTH-width/2))<1e-8);
  assert.ok(Math.abs(start.rightX-(WIDTH+width/2))<1e-8);
  assert.equal(start.leftX-start.leftMarker,69);
  for(const [l,r] of [[12,12],[24,0],[0,24],[40,30]]){
   const joined=roadLayout(state(l,r),width,'together');
   assert.ok(Math.abs(joined.rightX-joined.leftX-96)<1e-8);
  }
 }
});
