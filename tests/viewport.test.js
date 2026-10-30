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

test('remote tablet roads start with the opponent offscreen and reveal both on approach',()=>{
 for(const [w,h] of [[390,844],[768,1024],[1024,768]]){
  for(const side of ['left','right']){
   const camera=side==='left'?0:WIDTH;
   const layout=viewportLayout(w,h,side,'remote',camera);
   const initial=roadLayout(state(),layout.sceneWidth,'remote');
   const own=side==='left'?initial.leftX:initial.rightX;
   const opponent=side==='left'?initial.rightX:initial.leftX;
   assert.ok(own-48>=layout.view&&own+48<=layout.view+layout.sceneWidth);
   assert.ok(opponent+48<layout.view||opponent-48>layout.view+layout.sceneWidth);
   const near=roadLayout(state(11,11),layout.sceneWidth,'remote');
   const approach=viewportLayout(w,h,side,'remote',WIDTH/2);
   assert.ok(near.leftX-48>=approach.view&&near.rightX+48<=approach.view+approach.sceneWidth);
   for(const scene of [state(12,12),state(24,0),state(0,24)]){
    const joined=roadLayout(scene,layout.sceneWidth,'remote');
    const final=viewportLayout(w,h,side,'remote',camera,scene);
    assert.ok(joined.leftX-48>=final.view&&joined.rightX+48<=final.view+final.sceneWidth);
   }
  }
 }
});

test('starting bears sit directly inside the heart markers while preserving contact spacing',()=>{
 for(const width of [390,768,1125,1500]){
  const start=roadLayout(state(),width,'together');
  assert.ok(Math.abs(start.leftX-48-start.leftMarker)<1e-8);
  assert.ok(Math.abs(start.rightX+48-start.rightMarker)<1e-8);
  assert.equal(start.leftMarker,WIDTH-width+53);
  assert.equal(start.rightMarker,WIDTH+width-53);
  for(const [l,r] of [[12,12],[24,0],[0,24],[40,30]]){
   const joined=roadLayout(state(l,r),width,'together');
   assert.ok(Math.abs(joined.rightX-joined.leftX-96)<1e-8);
  }
 }
});

test('wall contact places the outer bear edge at the heart marker on all widths',()=>{
 for(const width of [390,633,1125,1500])for(const mode of ['remote','together']){
  const left=roadLayout(state(0,1000),width,mode);
  const right=roadLayout(state(1000,0),width,mode);
  assert.ok(Math.abs(left.leftX-48-left.leftMarker)<1e-8);
  assert.ok(Math.abs(right.rightX+48-right.rightMarker)<1e-8);
 }
});
