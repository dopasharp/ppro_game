import test from 'node:test';import assert from 'node:assert/strict';import {state,canTap,TOTAL,STEP,LEFT_START,RIGHT_START,MIN_MEETING,MAX_MEETING} from '../game.js';
test('each tap moves only that player by a large fixed step',()=>{for(let l=0;l<12;l++)for(let r=0;r<12;r++){const a=state(l,r),b=state(l+1,r),c=state(l,r+1);assert.ok(Math.abs(b.leftX-a.leftX-STEP)<1e-9);assert.equal(b.rightX,a.rightX);assert.equal(c.leftX,a.leftX);assert.ok(Math.abs(a.rightX-c.rightX-STEP)<1e-9);}assert.ok(STEP>15);});
test('start at outer screen edges',()=>{assert.equal(state().leftX,LEFT_START);assert.equal(state().rightX,RIGHT_START);assert.equal(state().progress,0);});
test('faster left bear crosses to right phone; faster right crosses left',()=>{assert.equal(state(18,6).meetingSide,'right');assert.equal(state(6,18).meetingSide,'left');assert.equal(state(12,12).meetingSide,'tie');});
test('all legal counts keep bears separated until kiss',()=>{for(let l=0;l<=TOTAL;l++)for(let r=0;r<=TOTAL-l;r++){const s=state(l,r);assert.ok(s.rightX-s.leftX>=96-1e-9);assert.equal(s.done,l+r===TOTAL);if(s.done)assert.ok(Math.abs(s.rightX-s.leftX-96)<1e-9);}});
test('input gates before start and allows movement after meeting',()=>{assert.equal(canTap({},5),false);assert.equal(canTap({startAt:10,left:{taps:0},right:{taps:0}},9),false);assert.equal(canTap({startAt:10,left:{taps:23},right:{taps:1}},11),true);});

test('joined bears stay together through continued and opposing taps',()=>{
 for(const [l,r] of [[12,12],[18,6],[6,18],[100,100]]){
  const a=state(l,r),b=state(l+1,r),c=state(l,r+1);
  assert.equal(a.rightX-a.leftX,96);
  assert.equal(b.rightX-b.leftX,96);
  assert.ok(b.leftX>a.leftX&&b.rightX>a.rightX);
  assert.ok(c.leftX<a.leftX&&c.rightX<a.rightX);
  assert.equal(state(l+1,r+1).meeting,a.meeting);
 }
});

test('joined bears stop within both lamps and can move back immediately',()=>{
 const right=state(30,0),left=state(0,30);
 assert.equal(right.meeting,MAX_MEETING);assert.equal(left.meeting,MIN_MEETING);
 assert.equal(state(10000,0).meeting,MAX_MEETING);
 assert.equal(state(0,10000).meeting,MIN_MEETING);
 assert.ok(state(30,1).meeting<right.meeting);
 assert.ok(state(1,30).meeting>left.meeting);
});
