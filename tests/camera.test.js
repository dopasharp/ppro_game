import test from 'node:test';import assert from 'node:assert/strict';import {WIDTH,TOTAL,state,cameraTarget,advanceCamera} from '../game.js';
test('together mode keeps each half fixed before and after meeting',()=>{for(let n=0;n<=TOTAL+40;n++){const s=state(n,0);assert.equal(cameraTarget(s,'left','together'),0);assert.equal(cameraTarget(s,'right','together'),WIDTH);assert.equal(advanceCamera(127,s,'right','together',16),WIDTH);}});
test('remote camera follows the corresponding player and clamps to world',()=>{for(let l=0;l<=TOTAL;l++)for(let r=0;r<=TOTAL-l;r++)for(const side of ['left','right']){const target=cameraTarget(state(l,r),side,'remote');if(l+r<TOTAL)assert.ok(target>=0&&target<=WIDTH);else assert.equal(target,Math.max(0,Math.min(WIDTH,state(l,r).meeting-WIDTH/2)));}assert.ok(cameraTarget(state(8,0),'left','remote')>0);assert.ok(cameraTarget(state(0,8),'right','remote')<WIDTH);});
test('both remote cameras show both bears at any final meeting',()=>{for(let l=0;l<=TOTAL;l++){const s=state(l,TOTAL-l);assert.equal(cameraTarget(s,'left','remote'),cameraTarget(s,'right','remote'));for(const side of ['left','right'])for(const current of [0,WIDTH]){const camera=advanceCamera(current,s,side,'remote',16);assert.ok(Math.max(0,s.leftX-48)>=camera-1e-8);assert.ok(Math.min(WIDTH*2,s.rightX+48)<=camera+WIDTH+1e-8);}}});
test('camera easing is consistent across frame rates and recovers jumps',()=>{const s=state(10,0),once=advanceCamera(0,s,'left','remote',32),half=advanceCamera(advanceCamera(0,s,'left','remote',16),s,'left','remote',16);assert.ok(Math.abs(once-half)<1e-8);const jumped=state(23,0),camera=advanceCamera(0,jumped,'left','remote',16);assert.ok(jumped.leftX+48<=camera+WIDTH+1e-8);});

test('together cameras stay fixed while remote follows the bounded pair',()=>{
 for(const s of [state(100,0),state(0,100)]){
  assert.equal(cameraTarget(s,'left','together'),0);
  assert.equal(cameraTarget(s,'right','together'),WIDTH);
  for(const side of ['left','right']){
   const camera=advanceCamera(0,s,side,'remote',16);
   assert.ok(s.leftX-48>=camera-1e-8);
   assert.ok(s.rightX+48<=camera+WIDTH+1e-8);
  }
 }
});
