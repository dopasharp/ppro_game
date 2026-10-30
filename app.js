import {firebaseConfig,emulatorPorts} from './firebase-config.js';
import {WIDTH,HEIGHT,TOTAL,state,canTap,advanceCamera,resetRound,bitePose,MIN_MEETING,MAX_MEETING,viewportLayout,roadLayout} from './game.js?v=18';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'),overview=$('overview').getContext('2d');
let demoStarted=false,cameraX=0,cameraReady=false,lastFrame=0,finishAt=0,observedRound=null,resetBusy=false;
let room=null,side='left',uid,db,api,connected=false,offset=0,busy=false,unsub=null,roomId=null,demo=false,lastInput=0,startBusy=false;
const spriteMeta=await fetch(new URL('./assets/sprites.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('스프라이트 정보를 불러올 수 없습니다.');return r.json();});
const images={};for(const name of ['cream','pink','pepero']){const i=new Image();i.src=`./assets/${name}.png`;i.onerror=()=>error(`이미지 로딩 실패: ${name}`);images[name]=i;}
const garland=new Image();garland.src='./assets/ribbon-garland.png';
const animation={left:{taps:0,at:-Infinity},right:{taps:0,at:-Infinity}};
function pose(player,taps,time){const a=animation[player];if(a.taps!==taps){a.taps=taps;a.at=time;}return bitePose(time-a.at);}
const initials=()=>({left:$('my-initial').value.trim().toUpperCase().slice(0,6),right:$('partner-initial').value.trim().toUpperCase().slice(0,6)});
let noticeTimer;
let wallEdge=null,wallUntil=0;
function notify(message){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,5000);}
async function copyInvite(){
  try{await navigator.clipboard.writeText(location.href);notify('링크가 복사되었습니다. 상대에게 공유해주세요!');}
  catch{$('invite').classList.add('copy-fallback');$('invite').focus();$('invite').select();notify('자동 복사를 할 수 없어요. 아래 선택된 링크를 복사해 상대에게 공유해주세요!');}
}
const now=()=>Date.now()+offset;
function error(e){$('error').hidden=false;const permissionDenied=/permission.?denied/i.test(`${e?.code||''} ${e?.message||e}`);$('error').textContent=permissionDenied?'Firebase에서 방 저장을 거부했어요. Firebase Console → Realtime Database → 규칙에 프로젝트의 database.rules.json 전체를 붙여넣고 게시한 뒤 새 방을 만들어주세요.':typeof e==='string'?e:`연결을 확인해주세요: ${e.code||e.message}`;}
function clearError(){$('error').hidden=true;}
function showGame(){ document.body.classList.add('playing');$('lobby').hidden=true;$('game').hidden=false;$('invite').value=location.href;resize(); }
function resize(){const bounds=$('stage').getBoundingClientRect(),w=bounds.width||window.innerWidth,h=bounds.height||window.innerHeight;const dpr=Math.min(devicePixelRatio||1,3);canvas.style.width='100%';canvas.style.height='100%';canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);new ResizeObserver(resize).observe($('stage'));$('scale').oninput=resize;
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
    if(create){await api.set(roomRef(),{mode,initials:initials(),meetingMessage:$('meeting-message').value.trim().slice(0,40),round:0,createdAt:api.serverTimestamp(),left:{uid,round:0,taps:0,lastTap:0}});}
    else{const snapshot=await api.get(roomRef());const r=snapshot.val();if(!r)throw new Error('방이 없어요. 새 방을 만들어주세요.');
      if(r.left.uid!==uid&&r.right?.uid!==uid){const claim=await api.runTransaction(roomRef('right'),v=>v?undefined:{uid,round:r.round??0,taps:0,lastTap:0},{applyLocally:false});if(!claim.committed)throw new Error('이미 두 명이 들어온 방이에요. 새 방을 만들어주세요.');}}
    history.replaceState(null,'',`${location.pathname}${location.search}#${roomId}`);showGame();
    if(create)await copyInvite();
    if(unsub)unsub();unsub=api.onValue(roomRef(),snapshot=>{room=snapshot.val();if(!room){error('방이 삭제되었어요. 새 게임을 시작해주세요.');return;}const assignedSide=room.left.uid===uid?'left':'right';if(assignedSide!==side)cameraReady=false;side=assignedSide;
      if(room.right&&!room.startAt&&!startBusy){startBusy=true;api.runTransaction(roomRef('startAt'),v=>v??api.serverTimestamp(),{applyLocally:false}).catch(error).finally(()=>startBusy=false);}
    },error);
  }catch(e){error(e);}finally{for(const id of ['create-together','create-remote','demo'])$(id).disabled=false;}
}
function newRoom(){const bytes=crypto.getRandomValues(new Uint8Array(16));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
$('create-together').onclick=()=>enter(newRoom(),true,'together');
$('create-remote').onclick=()=>enter(newRoom(),true,'remote');
function resetPresentation(){wallEdge=null;wallUntil=0;cameraReady=false;finishAt=0;lastInput=0;demoStarted=false;for(const a of Object.values(animation)){a.taps=0;a.at=-Infinity;}}
$('new').onclick=async()=>{
  if(!room||resetBusy)return;clearError();
  if(demo){room=resetRound(room,now());resetPresentation();return;}
  if(!connected){error('다시 연결한 후 다시하기를 눌러주세요.');return;}
  if(!room.right){error('상대가 접속한 후 다시하기를 눌러주세요.');return;}
  const expectedRound=room.round??0,beforeReset=room;resetBusy=true;$('new').disabled=true;
  try{await api.runTransaction(roomRef(),r=>{const current=r??beforeReset;return (current.round??0)===expectedRound?resetRound(current,api.serverTimestamp())??undefined:undefined;},{applyLocally:false});}catch(e){error(e);}finally{resetBusy=false;$('new').disabled=false;}
};
$('share').onclick=copyInvite;
$('demo').onclick=()=>{clearError();demo=true;demoStarted=false;cameraReady=false;finishAt=0;connected=true;roomId=null;room={mode:'remote',initials:initials(),meetingMessage:$('meeting-message').value.trim().slice(0,40),round:0,left:{round:0,taps:0},right:{round:0,taps:0},startAt:now()};side='left';$('connection').textContent='테스트';$('share').hidden=true;showGame();$('invite').hidden=true;};
setInterval(()=>{if(demo&&demoStarted&&canTap({...room,startAt:room.startAt+3000},now())){const position=state(room.left.taps,room.right.taps);if(!position.done||position.meeting>MIN_MEETING)room.right.taps++;}},280);
async function tap(){
  if(!room||!connected||busy||now()-lastInput<65||!canTap({...room,startAt:room.startAt?room.startAt+3000:null},now()))return;
  const position=state(room.left?.taps,room.right?.taps);
  if(position.done&&((side==='left'&&position.meeting>=MAX_MEETING)||(side==='right'&&position.meeting<=MIN_MEETING))){wallUntil=now()+1500;return;}
  lastInput=now();
  if(demo){demoStarted=true;room.left.taps++;return;}
  const expectedRound=room.round??0,seat=side,fallback=room[side];
  busy=true;try{await api.runTransaction(roomRef(seat),p=>{const current=p??fallback;return current?.uid===uid&&(current.round??0)===expectedRound?{...current,taps:current.taps+1,lastTap:api.serverTimestamp()}:undefined;},{applyLocally:false});}catch(e){if((room?.round??0)===expectedRound)error(e);}finally{busy=false;}
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
function scenery(c,view,width,t){
  c.save();c.translate(view,0);
  const sky=c.createLinearGradient(0,0,0,HEIGHT);
  sky.addColorStop(0,'#fff6f2');sky.addColorStop(.64,'#fffaf6');sky.addColorStop(1,'#f3e9e3');
  c.fillStyle=sky;c.fillRect(0,0,width,HEIGHT);
  // The distant decorations scroll slowly; the path stays anchored to the bears.
  for(let n=Math.floor(view*.22/640)-1;n<=Math.ceil((view*.22+width)/640);n++){
    const x=n*640-view*.22;
    if(garland.complete&&garland.naturalWidth){
      c.globalAlpha=.38;c.drawImage(garland,x,80,640,640*garland.naturalHeight/garland.naturalWidth);c.globalAlpha=1;
    }
    c.fillStyle='#f3ddd780';c.beginPath();c.ellipse(x+180,543,230,74,0,Math.PI,0);c.fill();
    c.fillStyle='#eadfdf60';c.beginPath();c.ellipse(x+470,543,210,53,0,Math.PI,0);c.fill();
  }
  c.fillStyle='#f5e6dc';c.fillRect(0,546,width,65);
  c.strokeStyle='#e7cdc1';c.lineWidth=1;c.beginPath();c.moveTo(0,546);c.lineTo(width,546);c.stroke();
  c.strokeStyle='#fff8f0';c.lineWidth=2;c.setLineDash([5,15]);c.lineDashOffset=view%20;c.beginPath();c.moveTo(0,602);c.lineTo(width,602);c.stroke();c.setLineDash([]);c.lineDashOffset=0;
  for(let n=Math.floor(view/120)-1;n<=Math.ceil((view+width)/120);n++){
    const x=n*120-view;
    circle(c,x+16,574,2,'#dcbcae70');circle(c,x+67,586,1.5,'#dcbcae60');
    c.save();c.translate(x+30,542);c.strokeStyle='#b8bda0';c.lineWidth=1.5;
    c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(4,-10,1,-18);c.stroke();
    for(let petal=0;petal<5;petal++){const a=petal*Math.PI*2/5;circle(c,1+Math.cos(a)*4,-20+Math.sin(a)*4,3,'#eab9be');}
    circle(c,1,-20,2,'#f8e7ba');c.restore();
  }
  for(let n=Math.floor(view*.4/180)-1;n<=Math.ceil((view*.4+width)/180);n++){
    const x=n*180-view*.4;
    c.globalAlpha=.25;c.fillStyle='#dba5ae';c.font='12px serif';c.textAlign='center';
    c.fillText('♡',x+55,300+Math.sin(n*2+t/2600)*7);c.globalAlpha=1;
  }
  c.restore();
}
function world(c,view,width,t){
  const l=room?.left?.taps||0,r=room?.right?.taps||0,s=roadLayout(state(l,r),width,room?.mode),waiting=!room?.right;
  c.save();c.beginPath();c.rect(0,0,width,HEIGHT);c.clip();c.translate(-view,0);
  scenery(c,view,width,t);
  if(room?.mode!=='remote'){c.strokeStyle='#c0a98a';c.lineWidth=1;c.setLineDash([3,8]);c.beginPath();c.moveTo(390,140);c.lineTo(390,710);c.stroke();c.setLineDash([]);}
  c.textAlign='center';
  
  c.fillStyle='#e3d5bd';c.beginPath();c.ellipse(s.leftX,548,49,10,0,0,Math.PI*2);c.ellipse(s.rightX,548,49,10,0,0,Math.PI*2);c.fill();
  // Matching chocolate-heart markers frame the little candy path.
  for(const [x,direction] of [[s.leftMarker,1],[s.rightMarker,-1]]){
    c.save();c.translate(x,0);
    c.fillStyle='#e8d0bf';c.fillRect(-4,447,8,92);
    c.strokeStyle='#f9e6d6';c.lineWidth=2;
    for(let y=455;y<536;y+=14){c.beginPath();c.moveTo(-3,y);c.lineTo(3,y-6);c.stroke();}
    c.fillStyle='#f0dce0';c.beginPath();c.ellipse(0,541,23,6,0,0,Math.PI*2);c.fill();
    const chocolate=c.createLinearGradient(-22,409,23,454);
    chocolate.addColorStop(0,'#b78471');chocolate.addColorStop(1,'#815a50');
    c.fillStyle=chocolate;c.strokeStyle='#d8ab94';c.lineWidth=2;
    c.beginPath();c.moveTo(0,456);c.bezierCurveTo(-46,433,-24,403,0,424);c.bezierCurveTo(24,403,46,433,0,456);c.fill();c.stroke();
    c.strokeStyle='#f4b6be';c.lineWidth=2;c.beginPath();c.moveTo(-18,432);c.bezierCurveTo(-5,426,8,441,21,434);c.stroke();
    c.fillStyle='#eca4b2';
    for(const sign of [-1,1]){c.beginPath();c.moveTo(0,464);c.bezierCurveTo(sign*23,446,sign*26,478,0,468);c.fill();}
    circle(c,0,465,4,'#f7c7ce');
    c.strokeStyle='#eca4b2';c.lineWidth=4;c.beginPath();c.moveTo(-2,468);c.quadraticCurveTo(-12,477,-9,486);c.moveTo(2,468);c.quadraticCurveTo(12,477,9,486);c.stroke();
    for(let i=0;i<3;i++){circle(c,direction*(10+i*7),538-i%2*4,3,'#e9b5be');}
    c.restore();
  }
  pepero(c,s,l,r);
  const animationTime=now(),leftPose=pose('left',l,animationTime),rightPose=pose('right',r,animationTime);
  bear(c,'cream',s.leftX,false,leftPose.frame,leftPose.row);
  bear(c,'pink',s.rightX,true,rightPose.frame,rightPose.row);
  for(const [seat,x] of [['left',s.leftX],['right',s.rightX]]){
    const label=room?.initials?.[seat];if(!label)continue;
    c.font='bold 13px system-ui';
    const labelWidth=c.measureText(label).width+20;
    c.fillStyle='#fff8ef';c.fillRect(x-labelWidth/2,565,labelWidth,25);
    c.fillStyle=seat==='left'?'#a45b69':'#7864aa';c.fillText(label,x,583);
  }
  if(s.done){
    const elapsed=Math.max(0,t-finishAt),burst=Math.min(1,elapsed/1300);
    c.save();
    const glow=c.createRadialGradient(s.meeting,475,5,s.meeting,475,150);
    glow.addColorStop(0,'#ffb4d080');glow.addColorStop(1,'#ffb4d000');
    c.fillStyle=glow;c.fillRect(s.meeting-150,325,300,300);
    const colors=['#ec729c','#d593e8','#ffb957','#ff8eae','#b19aff'];
    if(elapsed<2200){
      c.globalAlpha=Math.max(0,1-elapsed/2200);
      for(let i=0;i<36;i++){
        const angle=i*2.39996,dist=35+burst*(65+(i%5)*19);
        const x=s.meeting+Math.cos(angle)*dist,y=475+Math.sin(angle)*dist+burst*burst*45;
        c.fillStyle=colors[i%colors.length];c.font=`${12+i%4*4}px sans-serif`;
        c.fillText(i%3===0?'♥':'✦',x,y);
      }
    }
    c.globalAlpha=1;
    for(let i=0;i<7;i++){
      const phase=(elapsed/2400+i/7)%1;
      c.globalAlpha=Math.sin(phase*Math.PI)*.85;c.fillStyle=colors[i%colors.length];
      c.font=`${14+i%3*5}px sans-serif`;
      c.fillText(i%2?'♥':'✧',s.meeting+Math.sin(i*2.4+elapsed/1700)*70,435-phase*125);
    }
    c.globalAlpha=1;c.fillStyle='#bb507d';c.font='bold 17px system-ui';
    const message=elapsed<3000?(room?.meetingMessage??'우리 만났어요! ♥'):'';
    const lines=[];let line='';
    for(const character of message){
      if(line&&c.measureText(line+character).width>240){lines.push(line);line='';}
      line+=character;
    }
    if(line)lines.push(line);
    lines.forEach((text,index)=>c.fillText(text,s.meeting,350-(lines.length-1-index)*24+Math.sin(elapsed/350)*4));
    c.restore();
  }
  if(wallEdge&&now()<wallUntil){
    const x=wallEdge==='left'?s.leftX:s.rightX,y=379;
    c.save();
    c.globalAlpha=Math.min(1,(wallUntil-now())/220);
    c.shadowColor='#b67d7a25';c.shadowBlur=10;
    c.fillStyle='#fffaf5';c.strokeStyle='#e5b8bf';c.lineWidth=1.5;
    c.beginPath();c.roundRect(x-43,y,86,37,14);c.fill();c.stroke();
    c.shadowBlur=0;c.beginPath();c.moveTo(x-6,y+36);c.lineTo(x+1,y+46);c.lineTo(x+9,y+36);c.fill();
    c.beginPath();c.moveTo(x-6,y+36);c.lineTo(x+1,y+46);c.lineTo(x+9,y+36);c.stroke();
    c.fillStyle='#ae6473';c.font='bold 16px system-ui';c.textAlign='center';c.fillText('밀지마!',x,y+24);
    c.restore();
  }

  c.fillStyle='#b28f79';c.font='12px sans-serif';c.fillText(waiting?'상대 대기 중':s.done?'':'탭하여 이동',view+width/2,650);
  c.fillStyle='#e1d0bb';c.fillRect(view+50,690,width-100,3);c.fillStyle='#c68585';c.fillRect(view+50,690,(width-100)*s.progress,3);
  c.restore();
}
let lastStatus='';function frame(t){
  if(room&&observedRound!==(room.round??0)){observedRound=room.round??0;resetPresentation();}
  const scene=state(room?.left?.taps,room?.right?.taps);
  const nextWall=scene.done?(scene.meeting<=MIN_MEETING?'left':scene.meeting>=MAX_MEETING?'right':null):null;
  if(nextWall&&nextWall!==wallEdge)wallUntil=now()+1800;
  wallEdge=nextWall;
  if(!cameraReady){cameraX=side==='left'?0:WIDTH;cameraReady=true;}
  cameraX=advanceCamera(cameraX,scene,side,room?.mode,t-lastFrame);lastFrame=t;
  if(!scene.done)finishAt=0;else if(!finishAt){finishAt=t;notify('붙어서 함께 이동해요! 계속 탭해주세요 ♥');}
  const {sceneWidth,view,scale,offsetY}=viewportLayout(canvas.width,canvas.height,side,room?.mode,cameraX);
  ctx.setTransform(1,0,0,1,0,0);const backdrop=ctx.createLinearGradient(0,0,0,canvas.height);backdrop.addColorStop(0,'#fff6f2');backdrop.addColorStop(1,'#f3e9e3');ctx.fillStyle=backdrop;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(scale,0,0,scale,0,offsetY);world(ctx,view,sceneWidth,t);if($('overview').parentElement.open)world(overview,0,780,t);
  if(room){const s=state(room.left?.taps,room.right?.taps);$('score').textContent=`${room.left?.taps||0} : ${room.right?.taps||0}`;
    const seconds=room.startAt?Math.ceil((room.startAt+3000-now())/1000):0;
    const text=!connected?'재연결 중':!room.right?'상대 대기 중':seconds>0?`${seconds} · 준비!`:s.done?'':'탭하여 이동';if(text!==lastStatus){$('status').textContent=text;lastStatus=text;}}
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
const id=location.hash.slice(1);if(id){if(/^[a-f0-9]{32}$/.test(id))enter(id);else error('올바른 초대 링크가 아니에요. 새 방을 만들어주세요.');}





