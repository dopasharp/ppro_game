import {resetRound} from '../game.js';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,set,get,serverTimestamp,runTransaction,onValue} from 'firebase/database';
test('RTDB permissions, seat ownership, countdown, rate and shared finish',async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-pepero',database:{host:'127.0.0.1',port:19000,rules:await readFile(new URL('../database.rules.json',import.meta.url),'utf8')}});
 const stops=[];
 try{
 const id='a'.repeat(32),path=`rooms/${id}`,a=env.authenticatedContext('alice').database(),b=env.authenticatedContext('bob').database(),c=env.authenticatedContext('charlie').database();
 const anon=env.unauthenticatedContext().database();
 await assertFails(get(ref(anon,path)));
 await assertSucceeds(set(ref(a,path),{mode:'remote',round:0,createdAt:serverTimestamp(),left:{uid:'alice',round:0,taps:0,lastTap:0}}));
 stops.push(onValue(ref(a,path),()=>{}),onValue(ref(b,path),()=>{}));
 await assertFails(get(ref(a,'rooms')));
 await assertFails(set(ref(a,path+'/mode'),'together'));
 await assertFails(set(ref(c,path+'/mode'),'remote'));
 await assertFails(set(ref(a,'rooms/'+'b'.repeat(32)),{mode:'invalid',round:0,createdAt:serverTimestamp(),left:{uid:'alice',round:0,taps:0,lastTap:0}}));
 await assertFails(set(ref(c,path+'/left'),{uid:'charlie',round:0,taps:1,lastTap:serverTimestamp()}));
 await assertSucceeds(set(ref(b,path+'/right'),{uid:'bob',round:0,taps:0,lastTap:0}));
 await assertFails(set(ref(c,path+'/right'),{uid:'charlie',round:0,taps:0,lastTap:0}));
 await assertFails(set(ref(a,path+'/left'),{uid:'alice',round:0,taps:1,lastTap:serverTimestamp()}));
 await assertFails(set(ref(c,path+'/startAt'),serverTimestamp()));
 await assertSucceeds(set(ref(b,path+'/startAt'),serverTimestamp()));
 await assertFails(set(ref(a,path+'/left'),{uid:'alice',round:0,taps:1,lastTap:serverTimestamp()}));
 await env.withSecurityRulesDisabled(async ctx=>{await set(ref(ctx.database(),path+'/startAt'),Date.now()-10000);});
 await assertSucceeds(set(ref(a,path+'/left'),{uid:'alice',round:0,taps:1,lastTap:serverTimestamp()}));
 await assertFails(set(ref(a,path+'/left'),{uid:'alice',round:0,taps:10,lastTap:serverTimestamp()}));
 await assertFails(set(ref(a,path+'/left/extra'),'bad'));
 await assertFails(set(ref(a,path+'/createdAt'),0));
 await env.withSecurityRulesDisabled(async ctx=>{await set(ref(ctx.database(),path+'/left/lastTap'),Date.now()+10000);});
 await assertFails(set(ref(a,path+'/left'),{uid:'alice',round:0,taps:2,lastTap:serverTimestamp()}));
 await assertFails(set(ref(a,path),null));
 await env.withSecurityRulesDisabled(async ctx=>{await set(ref(ctx.database(),path+'/left'),{uid:'alice',round:0,taps:12,lastTap:0});await set(ref(ctx.database(),path+'/right'),{uid:'bob',round:0,taps:11,lastTap:0});});
 const results=await Promise.allSettled([runTransaction(ref(a,path+'/left'),()=>({uid:'alice',round:0,taps:13,lastTap:serverTimestamp()}),{applyLocally:false}),runTransaction(ref(b,path+'/right'),()=>({uid:'bob',round:0,taps:12,lastTap:serverTimestamp()}),{applyLocally:false})]);
 if(results.filter(x=>x.status==='fulfilled'&&x.value.committed).length!==1)throw new Error('Exactly one final tap must commit');
 const final=(await get(ref(a,path))).val();if(final.left.taps+final.right.taps!==24)throw new Error('Invalid total');
 const restarted=resetRound(final,serverTimestamp());
 await assertFails(set(ref(c,path),restarted));
 await assertFails(set(ref(a,path),{...restarted,mode:'together'}));
 await assertFails(set(ref(a,path),{...restarted,right:{...restarted.right,uid:'charlie'}}));
 await assertSucceeds(set(ref(b,path),restarted));
 const after=(await get(ref(a,path))).val();
 if(after.round!==1||after.left.taps!==0||after.right.taps!==0||after.left.uid!=='alice'||after.right.uid!=='bob'||after.mode!=='remote')throw new Error('Shared reset corrupted room');
 await assertFails(set(ref(a,path+'/left'),{uid:'alice',round:0,taps:1,lastTap:serverTimestamp()}));
 await assertFails(set(ref(a,path+'/left'),{uid:'alice',round:1,taps:1,lastTap:serverTimestamp()}));
 await env.withSecurityRulesDisabled(async ctx=>{await set(ref(ctx.database(),path+'/startAt'),Date.now()-10000);});
 await assertSucceeds(set(ref(a,path+'/left'),{uid:'alice',round:1,taps:1,lastTap:serverTimestamp()}));
 await assertFails(set(ref(a,path+'/round'),2));
 const beforeRace=(await get(ref(a,path))).val(),generation=beforeRace.round;
 const resets=await Promise.all([runTransaction(ref(a,path),r=>r&&r.round===generation?resetRound(r,serverTimestamp()):undefined,{applyLocally:false}),runTransaction(ref(b,path),r=>r&&r.round===generation?resetRound(r,serverTimestamp()):undefined,{applyLocally:false})]);
 if(resets.filter(x=>x.committed).length!==1)throw new Error('Concurrent resets should restart once');
 const raceFinal=(await get(ref(a,path))).val();if(raceFinal.round!==2||raceFinal.left.taps!==0||raceFinal.right.taps!==0)throw new Error('Reset race corrupted room');

 }finally{for(const stop of stops)stop();await env.cleanup();}
});




