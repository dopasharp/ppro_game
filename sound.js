// WebAudio로 즉석 합성하는 귀여운 효과음 (외부 음원 파일 없음)
let ctx,master;

export function unlockAudio(){
  if(!ctx){
    // iOS: 무음 모드에서도 효과음이 나도록 (iOS 17+ Safari)
    try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    ctx=new AC();
    master=ctx.createGain();master.gain.value=.8;master.connect(ctx.destination);
  }
  if(ctx.state!=='running')ctx.resume().catch(()=>{});
  return ctx;
}

const ok=()=>ctx&&ctx.state==='running';
const wobble=(f,amount=.08)=>f*(1+(Math.random()*2-1)*amount);

// pan: -1(왼쪽)~1(오른쪽). StereoPanner가 없는 브라우저는 가운데로.
function out(pan=0){
  if(!pan||!ctx.createStereoPanner)return master;
  const p=ctx.createStereoPanner();p.pan.value=pan;p.connect(master);return p;
}
function blip({type='sine',from,to=from,at=0,dur=.1,vol=.2,pan=0}){
  const t=ctx.currentTime+at,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(out(pan));o.start(t);o.stop(t+dur+.02);
}
function tap({at=0,dur=.05,freq=900,vol=.15,pan=0}){
  const t=ctx.currentTime+at,len=Math.ceil(ctx.sampleRate*dur),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len)**3;
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=buf;f.type='bandpass';f.frequency.value=freq;f.Q.value=1.2;g.gain.value=vol;
  s.connect(f).connect(g).connect(out(pan));s.start(t);
}

/** 내가 탭할 때: 말랑한 "뽁" */
export function myStep(){
  if(!ok())return;
  const f=wobble(620);
  blip({from:f,to:f*1.9,dur:.07,vol:.22});
  blip({type:'triangle',from:f*2,to:f*2.6,dur:.05,vol:.05});
}

/** 상대 곰이 걸어오는 "콩콩" — closeness(0~1)가 클수록 크고 가운데로 */
export function partnerStep(closeness=0,fromRight=true){
  if(!ok())return;
  const vol=.08+.17*closeness,pan=(fromRight?1:-1)*.6*(1-closeness),f=wobble(260,.1);
  blip({from:f,to:f*.6,dur:.08,vol,pan});tap({freq:1400,vol:vol*.6,pan});
  blip({from:f*1.12,to:f*.68,at:.11,dur:.08,vol:vol*.85,pan});tap({at:.11,freq:1600,vol:vol*.5,pan});
}

/** 카운트다운 3, 2, 1 */
export function tick(){
  if(!ok())return;
  blip({type:'triangle',from:740,dur:.12,vol:.16});
}

/** 시작! */
export function go(){
  if(!ok())return;
  [880,1175].forEach((f,i)=>blip({type:'triangle',from:f,at:i*.07,dur:.16,vol:.16}));
}

/** 두 곰이 만났을 때: 반짝이는 아르페지오 + "쪽" */
export function meet(){
  if(!ok())return;
  [1047,1319,1568,2093].forEach((f,i)=>blip({type:'triangle',from:f,at:i*.08,dur:.35,vol:.12}));
  blip({from:2000,to:700,at:.42,dur:.09,vol:.2});tap({at:.42,freq:3000,vol:.12,dur:.03});
  [2637,3136].forEach((f,i)=>blip({from:f,at:.55+i*.09,dur:.3,vol:.05}));
}

/** 더 못 밀 때(밀지마!): 통통 튕기는 소리 */
export function bump(){
  if(!ok())return;
  blip({from:420,to:180,dur:.16,vol:.16});
  blip({from:300,to:150,at:.14,dur:.12,vol:.1});
}
