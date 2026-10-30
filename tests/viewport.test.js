import test from 'node:test';
import assert from 'node:assert/strict';
import {viewportLayout,WIDTH,HEIGHT} from '../game.js';

test('phone and tablet views preserve sprite proportions and join at the seam',()=>{
  for(const [w,h] of [[390,844],[768,1024],[1024,768],[2048,1536]]){
    const left=viewportLayout(w,h,'left','together',0);
    const right=viewportLayout(w,h,'right','together',WIDTH);
    assert.ok(Math.abs(w/left.sceneWidth-h/HEIGHT)<1e-9);
    assert.ok(Math.abs(left.view+left.sceneWidth-right.view)<1e-9);
    assert.equal(right.view,WIDTH);
    if(w/h>WIDTH/HEIGHT)assert.ok(left.sceneWidth>WIDTH);
  }
});
