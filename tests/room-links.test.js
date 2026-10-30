import test from 'node:test';
import assert from 'node:assert/strict';
import {roomLink,requestedSeat,authSession,seatAction,resumeSeat,lobbyLink} from '../room-links.js';

test('left and right links retain one room and keep emulator options',()=>{
 for(const side of ['left','right']){
  const url=new URL(roomLink('https://example.com/play/?emulator=1&side=left#old','abc',side));
  assert.equal(url.hash,'#abc');assert.equal(requestedSeat(url.href),side);
  assert.equal(url.searchParams.get('emulator'),'1');
 }
 assert.equal(requestedSeat('https://example.com/#abc'),null);
});
test('new-room navigation clears the previous seat credentials and room ID',()=>{
 const url=new URL(lobbyLink(roomLink('https://example.com/play/?emulator=1','old','right','secret')));
 assert.equal(url.hash,'');assert.equal(url.searchParams.has('seatKey'),false);
 assert.equal(url.searchParams.has('side'),false);assert.equal(url.searchParams.get('emulator'),'1');
});
test('a valid seat link resumes from another browser without resetting progress',()=>{
 const player={uid:'old-browser',accessKey:'right-secret',round:3,taps:17,lastTap:12345};
 const room={left:{uid:'host'},right:player,seatKeys:{left:'left-secret',right:'right-secret'}};
 assert.equal(seatAction(room,'new-browser','right','right-secret'),'resume');
 assert.equal(seatAction(room,'new-browser','right','wrong'),'invalid');
 assert.equal(resumeSeat(player,'new-browser','wrong'),null);
 assert.deepEqual(resumeSeat(player,'new-browser','right-secret'),{...player,uid:'new-browser'});
 assert.equal(player.uid,'old-browser');
 const url=new URL(roomLink('https://example.com/?side=left&seatKey=old','room','right','right-secret'));
 assert.equal(url.searchParams.get('seatKey'),'right-secret');
});
test('same browser seats have distinct stable login sessions',()=>{
 assert.notEqual(authSession('abc','left'),authSession('abc','right'));
 assert.equal(authSession('abc','left'),authSession('abc','left'));
 assert.equal(authSession('abc',null),'[DEFAULT]');
});
test('copying either bottom seat card replaces the other seat and its key',()=>{
 const id='a'.repeat(32),keys={left:'b'.repeat(32),right:'c'.repeat(32)};
 const base=roomLink('https://example.com/play/',id,'right',keys.right);
 const left=new URL(roomLink(base,id,'left',keys.left));
 const right=new URL(roomLink(left.href,id,'right',keys.right));
 for(const [seat,url] of [['left',left],['right',right]]){
  assert.equal(url.hash,'#'+id);
  assert.deepEqual(url.searchParams.getAll('side'),[seat]);
  assert.deepEqual(url.searchParams.getAll('seatKey'),[keys[seat]]);
 }
});
test('resume starts from the fetched seat when the local transaction cache is empty',()=>{
 const fetched={uid:'old-browser',accessKey:'secret',round:2,taps:9,lastTap:100};
 assert.deepEqual(resumeSeat(null,'new-browser','secret',fetched),{...fetched,uid:'new-browser'});
 const latest={...fetched,taps:10,lastTap:200};
 assert.deepEqual(resumeSeat(latest,'new-browser','secret',fetched),{...latest,uid:'new-browser'});
 assert.equal(resumeSeat({...latest,accessKey:'changed'},'new-browser','secret',fetched),null);
});
test('explicit seats reconnect their owner and never silently take another seat',()=>{
 const room={left:{uid:'host'},right:{uid:'guest'}};
 assert.equal(seatAction(room,'host','left'),'left');
 assert.equal(seatAction(room,'guest','right'),'right');
 assert.equal(seatAction(room,'host','right'),'occupied');
 assert.equal(seatAction(room,'other','left'),'occupied');
 assert.equal(seatAction({left:{uid:'host'}},'guest','right'),'claim');
 assert.equal(seatAction({left:{uid:'host'}},'guest','left'),'occupied');
 assert.equal(seatAction(room,'guest',null),'right');
});
