import test from 'node:test';
import assert from 'node:assert/strict';
import {bitePose} from '../game.js';

test('each bite alternates open and closed mouths and settles closed',()=>{
  assert.deepEqual([0,120,240,360,480,1000].map(t=>bitePose(t).row),[1,0,1,0,0,0]);
  assert.deepEqual(bitePose(Infinity),{frame:0,row:0});
});
