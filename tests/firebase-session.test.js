import test from 'node:test';
import assert from 'node:assert/strict';
import {signInWithRetry} from '../firebase-session.js';

test('reuse the saved login without another signup request',async()=>{
 const user={uid:'saved'},auth={currentUser:null,async authStateReady(){this.currentUser=user;}};
 assert.equal(await signInWithRetry(auth,()=>{throw Error('unexpected signup');}),user);
});
test('retry only transient network failures and return the successful login',async()=>{
 let attempts=0;const waits=[],user={uid:'resumed'};
 const result=await signInWithRetry({},async()=>{if(++attempts<3)throw Object.assign(Error('offline'),{code:'auth/network-request-failed'});return {user};},async delay=>waits.push(delay));
 assert.equal(result,user);assert.equal(attempts,3);assert.deepEqual(waits,[600,1200]);
});
test('stop after three network failures and preserve the original error',async()=>{
 let attempts=0;const failure=Object.assign(Error('blocked'),{code:'auth/network-request-failed'});
 await assert.rejects(signInWithRetry({},async()=>{attempts++;throw failure;},async()=>{}),error=>error===failure);
 assert.equal(attempts,3);
});
test('do not retry permission or quota errors',async()=>{
 let attempts=0;const failure=Object.assign(Error('quota'),{code:'auth/too-many-requests'});
 await assert.rejects(signInWithRetry({},async()=>{attempts++;throw failure;}),error=>error===failure);
 assert.equal(attempts,1);
});
