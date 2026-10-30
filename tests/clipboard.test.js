import test from 'node:test';
import assert from 'node:assert/strict';
import {writeLink} from '../clipboard.js';

test('clipboard request begins synchronously with the complete invitation URL',async()=>{
  let written;
  const result=writeLink('https://example.com/#room',{navigator:{clipboard:{writeText:text=>{written=text;return Promise.resolve();}}}});
  assert.equal(written,'https://example.com/#room');
  assert.equal(await result,true);
});

for(const allowed of [true,false])test(`legacy clipboard reports actual result (${allowed}) and removes temporary field`,async()=>{
  let removed=false,selected=false,focused=false,restored=false;
  const field={style:{},focus(){focused=true;},select(){selected=true;},setSelectionRange(start,end){assert.equal(start,0);assert.equal(end,4);},remove(){removed=true;}};
  const env={navigator:{clipboard:{writeText:async()=>{throw Error('blocked');}}},document:{activeElement:{focus(){restored=true;}},createElement:()=>field,body:{append(){}},execCommand:()=>{assert.ok(focused&&selected);return allowed;}}};
  assert.equal(await writeLink('link',env),allowed);
  assert.ok(removed&&restored);
});
