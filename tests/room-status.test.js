import test from 'node:test';
import assert from 'node:assert/strict';
import {roomStatus} from '../room-status.js';
const base={side:'left',loaded:true,connected:true,controlsSeat:true,now:10000};

test('only a loaded room with an unclaimed opponent seat shows waiting',()=>{
 assert.equal(roomStatus({...base,room:{left:{uid:'a'}}}),'상대 대기 중');
 assert.equal(roomStatus({...base,loaded:false,room:{left:{uid:'a'}}}),'방 정보 불러오는 중');
 assert.equal(roomStatus({...base,side:'right',room:{left:{uid:'a'}}}),'내 자리 연결 중');
 assert.equal(roomStatus({...base,side:'right',room:{left:{uid:'a'},right:{uid:'b'}}}),'시작 준비 중');
});
test('browser handoff, reconnect and incomplete cached snapshots never show opponent waiting',()=>{
 const room={left:{uid:'a'},right:{uid:'b'},startAt:1000};
 assert.equal(roomStatus({...base,room,controlsSeat:false}),'다른 브라우저에서 이어 하는 중 · 터치해서 제어하기');
 assert.equal(roomStatus({...base,room,connected:false}),'재연결 중');
 assert.equal(roomStatus({...base,room:{left:room.left},seenOpponent:true}),'방 정보 동기화 중');
 assert.equal(roomStatus({...base,room:{left:room.left,startAt:1000}}),'방 정보 동기화 중');
 assert.equal(roomStatus({...base,room}),'');
});
