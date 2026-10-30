import test from 'node:test';
import assert from 'node:assert/strict';
import {countdownText} from '../game.js';

test('countdown shows only 3, 2, 1 and disappears at the start',()=>{
 assert.deepEqual([-1,0,999,1000,1999,2000,2999,3000].map(countdownText),['','3!','3!','2!','2!','1!','1!','']);
});
