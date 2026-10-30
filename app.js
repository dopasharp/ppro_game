import {firebaseConfig,emulatorPorts} from './firebase-config.js';
import {WIDTH,HEIGHT,TOTAL,state,canTap,advanceCamera,resetRound} from './game.js?v=6';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'),overview=$('overview').getContext('2d');
let demoStarted=false,cameraX=0,cameraReady=false,lastFrame=0,finishAt=0,observedRound=null,resetBusy=false;
let room=null,side='left',uid,db,api,connected=false,offset=0,busy=false,unsub=null,roomId=null,demo=false,lastInput=0,startBusy=false;
const spriteMeta=await fetch(new URL('./assets/sprites.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('스프라이트 정보를 불러올 수 없습니다.');return r.json();});
const images={};for(const name of ['cream','pink','pepero']){const i=new Image();i.src=`./assets/${name}.png`;i.onerror=()=>error(`이미지 로딩 실패: ${name}`);images[name]=i;}
const animation={left:{taps:0,at:0},right:{taps:0,at:0}};
function pose(player,taps,time){const a=animation[player];if(a.taps!==taps){a.taps=taps;a.at=time;}return time-a.at<480?Math.floor((time-a.at)/120)%4:0;}
const now=()=>Date.now()+offset;
function error(e){$('error').hidden=false;$('error').textContent=typeof e==='string'?e:`연결을 확인해주세요: ${e.code||e.message}`;}
function clearError(){$('error').hidden=true;}
function showGame(){ $('lobby').hidden=true;$('game').hidden=false;$('invite').value=location.href;resize(); }
function resize(){const scale=Number($('scale').value)/100;const w=$('stage').clientWidth*scale;canvas.style.width=`${w}px`;canvas.style.height=`${w*HEIGHT/WIDTH}px`;const dpr=Math.min(devicePixelRatio||1,3);canvas.width=Math.round(WIDTH*dpr);canvas.height=Math.round(HEIGHT*dpr);}
addEventListener('resize',resize);$('scale').oninput=resize;
async function firebase(){
  if(api)return;
  if(firebaseConfig.apiKey==='REPLACE_ME')throw new Error('firebase-config.js에 Firebase 설정을 입력해주세요. 혼자 미리 해보기는 설정 없이 가능합니다.');
  const [a,b,c]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js')]);
  const app=a.initializeApp(firebaseConfig),auth=b.getAuth(app);db=c.getDatabase(app);
  if(new URLSearchParams(location.search).has('emulator')&&['localhost','127.0.0.1'].includes(location.hostname)){b.connectAuthEmulator(auth,`http://127.0.0.1:${emulatorPorts.auth}`,{disableWarnings:true});c.connectDatabaseEmulator(db,'127.0.0.1',emulatorPorts.database);}
  await b.setPersistence(auth,b.browserLocalPersistence);uid=(await b.signInAnonymously(auth)).user.uid;api=c;
  c.onValue(c.ref(db,'.info/serverTimeOffset'),s=>offset=s.val()||0);
  c.onValue(c.ref(db,'.info/connected'),s=>{connected=!!s.val();$('connection').textContent=connected?'연결됨':'재연결 중';});
}
function roomRef(path=''){return api.ref(db,`rooms/${roomId}${path?'/'+path:''}`);}
async function enter(id,create=false,mode='remote'){
  clearError();for(const id of ['create-together','create-remote','demo'])$(id).disabled=true;
  try{await firebase();roomId=id;demo=false;cameraReady=false;finishAt=0;
    if(create){await api.set(roomRef(),{mode,round:0,createdAt:api.serverTimestamp(),left:{uid,round:0,taps:0,lastTap:0}});}
    else{const snapshot=await api.get(roomRef());const r=snapshot.val();if(!r)throw new Error('방이 없어요. 새 방을 만들어주세요.');
      if(r.left.uid!==uid&&r.right?.uid!==uid){const claim=await api.runTransaction(roomRef('right'),v=>v?undefined:{uid,round:r.round??0,taps:0,lastTap:0},{applyLocally:false});if(!claim.committed)throw new Error('이미 두 명이 들어온 방이에요. 새 방을 만들어주세요.');}}
    history.replaceState(null,'',`${location.pathname}${location.search}#${roomId}`);showGame();
    if(unsub)unsub();unsub=api.onValue(roomRef(),snapshot=>{room=snapshot.val();if(!room){error('방이 삭제되었어요. 새 게임을 시작해주세요.');return;}const assignedSide=room.left.uid===uid?'left':'right';if(assignedSide!==side)cameraReady=false;side=assignedSide;
      if(room.right&&!room.startAt&&!startBusy){startBusy=true;api.runTransaction(roomRef('startAt'),v=>v??api.serverTimestamp(),{applyLocally:false}).catch(error).finally(()=>startBusy=false);}
    },error);
  }catch(e){error(e);}finally{for(const id of ['create-together','create-remote','demo'])$(id).disabled=false;}
}
function newRoom(){const bytes=crypto.getRandomValues(new Uint8Array(16));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
$('create-together').onclick=()=>enter(newRoom(),true,'together');
$('create-remote').onclick=()=>enter(newRoom(),true,'remote');
function resetPresentation(){cameraReady=false;finishAt=0;lastInput=0;demoStarted=false;for(const a of Object.values(animation)){a.taps=0;a.at=0;}}
$('new').onclick=async()=>{
  if(!room||resetBusy)return;clearError();
  if(demo){room=resetRound(room,now());resetPresentation();return;}
  if(!connected){error('다시 연결한 후 다시하기를 눌러주세요.');return;}
  if(!room.right){error('상대가 접속한 후 다시하기를 눌러주세요.');return;}
  const expectedRound=room.round??0,beforeReset=room;resetBusy=true;$('new').disabled=true;
  try{await api.runTransaction(roomRef(),r=>{const current=r??beforeReset;return (current.round??0)===expectedRound?resetRound(current,api.serverTimestamp())??undefined:undefined;},{applyLocally:false});}catch(e){error(e);}finally{resetBusy=false;$('new').disabled=false;}
};
$('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('share').textContent='복사됨';setTimeout(()=>$('share').textContent='링크 복사',1800);}catch{$('invite').focus();$('invite').select();error('아래 링크를 길게 눌러 복사해 주세요.');}};
$('demo').onclick=()=>{clearError();demo=true;demoStarted=false;cameraReady=false;finishAt=0;connected=true;roomId=null;room={mode:'remote',round:0,left:{round:0,taps:0},right:{round:0,taps:0},startAt:now()};side='left';$('connection').textContent='테스트';$('share').hidden=true;showGame();$('invite').hidden=true;};
setInterval(()=>{if(demo&&demoStarted&&canTap({...room,startAt:room.startAt+3000},now()))room.right.taps++;},280);
async function tap(){
  if(!room||!connected||busy||now()-lastInput<65||!canTap({...room,startAt:room.startAt?room.startAt+3000:null},now()))return;
  lastInput=now();
  if(demo){demoStarted=true;room.left.taps++;return;}
  const expectedRound=room.round??0,seat=side,fallback=room[side];
  busy=true;try{await api.runTransaction(roomRef(seat),p=>{const current=p??fallback;return current?.uid===uid&&(current.round??0)===expectedRound?{...current,taps:current.taps+1,lastTap:api.serverTimestamp()}:undefined;},{applyLocally:false});}catch(e){if((room?.round??0)===expectedRound&&!state(room.left?.taps,room.right?.taps).done)error(e);}finally{busy=false;}
}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus();tap();});canvas.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();tap();}});
function circle(c,x,y,r,fill){c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function bear(c,name,x,flip,frame,row){
  const img=images[name],bounds=spriteMeta[name]?.[row*4+frame];if(!bounds||!img.complete||!img.naturalWidth)return;
  const [sx,sy,sw,sh]=bounds,h=136,w=h*sw/sh;
  c.save();c.translate(x,477);if(flip)c.scale(-1,1);
  c.drawImage(img,sx,sy,sw,sh,48-w,-h*.47,w,h);c.restore();
}
function pepero(c,s,left,right){
  const img=images.pepero;if(!img.complete||!img.naturalWidth)return;
  const flavor=roomId?parseInt(roomId.slice(0,8),16)%5:0;
  const [sx,sy,sw,sh]=spriteMeta.pepero[flavor];
  const remaining=Math.max(0,1-(left+right)/TOTAL),gap=s.rightX-s.leftX-96;
  if(gap<=.01)return;
  // Crop both eaten ends; decorations retain their size as the stick shortens.
  c.drawImage(img,sx+sw*left/TOTAL,sy,sw*remaining,sh,s.leftX+48,468,gap,18);
}
function world(c,view,width,t){
  const l=room?.left?.taps||0,r=room?.right?.taps||0,s=state(l,r),waiting=!room?.right,active=room&&room.startAt&&now()>room.startAt+3000;
  c.save();c.beginPath();c.rect(0,0,width,HEIGHT);c.clip();c.translate(-view,0);
  const g=c.createLinearGradient(0,0,780,HEIGHT);g.addColorStop(0,'#fff0e8');g.addColorStop(1,'#edf2df');c.fillStyle=g;c.fillRect(0,0,780,HEIGHT);
  for(let i=0;i<28;i++){circle(c,(i*173+30)%780,75+(i*89)%600,2,'#d8bb9e55');}
  if(room?.mode!=='remote'){c.strokeStyle='#c0a98a';c.lineWidth=1;c.setLineDash([3,8]);c.beginPath();c.moveTo(390,140);c.lineTo(390,710);c.stroke();c.setLineDash([]);}
  c.textAlign='center';
  
  c.fillStyle='#e3d5bd';c.beginPath();c.ellipse(s.leftX,548,49,10,0,0,Math.PI*2);c.ellipse(s.rightX,548,49,10,0,0,Math.PI*2);c.fill();
  pepero(c,s,l,r);
  const animationTime=now(),row=active?1:0;
  bear(c,'cream',s.leftX,false,pose('left',l,animationTime),row);
  bear(c,'pink',s.rightX,true,pose('right',r,animationTime),row);
  if(s.done){
    const elapsed=Math.min(1600,t-finishAt);if(elapsed>=0&&elapsed<1600){c.save();c.globalAlpha=1-elapsed/1600;c.fillStyle='#df879e';c.font='18px sans-serif';for(let i=-1;i<=1;i++)c.fillText('♥',s.meeting+i*26,443-elapsed*.035-Math.abs(i)*8);c.restore();}}

  c.fillStyle='#b28f79';c.font='12px sans-serif';c.fillText(waiting?'상대 대기 중':s.done?'':'탭하여 이동',view+width/2,650);
  c.fillStyle='#e1d0bb';c.fillRect(view+50,690,width-100,3);c.fillStyle='#c68585';c.fillRect(view+50,690,(width-100)*s.progress,3);
  c.restore();
}
let lastStatus='';function frame(t){
  if(room&&observedRound!==(room.round??0)){observedRound=room.round??0;resetPresentation();}
  const scene=state(room?.left?.taps,room?.right?.taps);
  if(!cameraReady){cameraX=side==='left'?0:WIDTH;cameraReady=true;}
  cameraX=advanceCamera(cameraX,scene,side,room?.mode,t-lastFrame);lastFrame=t;
  if(!scene.done)finishAt=0;else if(!finishAt)finishAt=t;
  const d=canvas.width/WIDTH;ctx.setTransform(d,0,0,d,0,0);world(ctx,cameraX,WIDTH,t);if($('overview').parentElement.open)world(overview,0,780,t);
  if(room){const s=state(room.left?.taps,room.right?.taps);$('score').textContent=`${room.left?.taps||0} : ${room.right?.taps||0}`;
    const seconds=room.startAt?Math.ceil((room.startAt+3000-now())/1000):0;
    const text=!connected?'재연결 중':!room.right?'상대 대기 중':seconds>0?`${seconds} · 준비!`:s.done?'':'탭하여 이동';if(text!==lastStatus){$('status').textContent=text;lastStatus=text;}}
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
const id=location.hash.slice(1);if(id){if(/^[a-f0-9]{32}$/.test(id))enter(id);else error('올바른 초대 링크가 아니에요. 새 방을 만들어주세요.');}





