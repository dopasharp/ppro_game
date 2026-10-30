import {roomStatus} from './room-status.js?v=46';
import {signInWithRetry} from './firebase-session.js?v=35';
import {roomLink,requestedSeat,authSession,seatAction,resumeSeat,lobbyLink} from './room-links.js?v=45';
import {writeLink} from './clipboard.js?v=23';
import {firebaseConfig,emulatorPorts} from './firebase-config.js';
import {WIDTH,HEIGHT,TOTAL,state,canTap,advanceCamera,resetRound,bitePose,MIN_MEETING,MAX_MEETING,viewportLayout,roadLayout,countdownText} from './game.js?v=39';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'),overview=$('overview').getContext('2d');
let demoStarted=false,cameraX=0,cameraReady=false,lastFrame=0,finishAt=0,observedRound=null,resetBusy=false;
let room=null,side='left',uid,db,api,connected=false,offset=0,busy=false,unsub=null,roomId=null,demo=false,lastInput=0,startBusy=false;
let spriteMeta={},spriteLoadError=null;
const spritesReady=fetch(new URL('./assets/sprites.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('이미지를 불러오지 못했어요.');return r.json();}).then(meta=>{spriteMeta=meta;}).catch(e=>{spriteLoadError=e;});
const images={};for(const name of ['cream','pink','pepero']){const i=new Image();i.src=`./assets/${name}.png`;i.onerror=()=>error(`이미지 로딩 실패: ${name}`);images[name]=i;}
const animation={left:{taps:0,at:-Infinity},right:{taps:0,at:-Infinity}};
function pose(player,taps,time){const a=animation[player];if(a.taps!==taps){a.taps=taps;a.at=time;}return bitePose(time-a.at);}
const initials=()=>({left:$('my-initial').value.trim().slice(0,12),right:$('partner-initial').value.trim().slice(0,12)});
let noticeTimer;
let seatKeys=null,controlsSeat=true,roomLoaded=false,seenOpponent=false,enterGeneration=0;
function currentStatus(){return roomStatus({room,side,loaded:roomLoaded,connected,controlsSeat,seenOpponent,now:now()});}
let wallEdge=null,wallUntil=0;
function notify(message){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,5000);}
function copiedNotice(copied){notify(copied?'링크가 복사되었습니다. 상대에게 공유해주세요!':'브라우저에서 복사를 허용하지 않았어요. 하단의 해당 자리 링크 복사 버튼을 눌러주세요.');}
function invitationURL(id=roomId,seat='right'){return roomLink(location.href,id,seat,seatKeys?.[seat]);}
function closeShareMenu(){ $('seat-links').hidden=true;$('share-menu').setAttribute('aria-expanded','false'); }
async function copyInvite(seat='right'){const copied=await writeLink(invitationURL(roomId,seat));if(copied)closeShareMenu();if(copied)notify(`${seat==='left'?'왼쪽':'오른쪽'} 링크가 복사되었습니다.${seat==='right'?' 상대에게 공유해주세요!':' 내 자리로 돌아올 때 사용해주세요.'}`);else copiedNotice(false);}
function createRoom(mode){
  for(const id of ['my-initial','partner-initial']){
    const input=$(id);input.value=input.value.trim();
    if(!input.reportValidity())return;
  }
  const id=newRoom();seatKeys={left:newRoom(),right:newRoom()};
  const copying=writeLink(invitationURL(id));
  return enter(id,true,mode,copying);
}

const now=()=>Date.now()+offset;
function error(e){$('error').hidden=false;if(e?.code==='auth/network-request-failed'){$('error').textContent='Firebase 로그인 서버에 연결하지 못했어요. 게임 위치는 초기화되지 않았습니다. 네트워크 연결과 이 사이트의 콘텐츠 차단 설정을 확인한 뒤 같은 자리 링크를 다시 열어주세요. (auth/network-request-failed)';return;}const permissionDenied=/permission.?denied/i.test(`${e?.code||''} ${e?.message||e}`);$('error').textContent=permissionDenied?'Firebase에서 방 저장을 거부했어요. Firebase Console → Realtime Database → 규칙에 프로젝트의 database.rules.json 전체를 붙여넣고 게시한 뒤 새 방을 만들어주세요.':typeof e==='string'?e:`연결을 확인해주세요: ${e.code||e.message}`;}
function setConnecting(value){
  $('connecting-overlay').hidden=!value;
  document.body.classList.toggle('connecting',value);
  document.querySelector('main').inert=value;
  document.querySelector('main').setAttribute('aria-busy',String(value));
}
function connectionFailed(e){
  returnToLobby();error(e);
  $('error').textContent+=' 방을 다시 만들어주세요.';
}
function clearError(){$('error').hidden=true;}
function syncSeatCards(){
  for(const seat of ['left','right']){
    const name=room?.initials?.[seat]||(seat==='left'?'왼쪽 플레이어':'오른쪽 플레이어');
    $(seat+'-name').textContent=name;
    $(seat+'-current').textContent=side===seat?'· 내 자리':'';
    $(seat+'-seat').classList.toggle('current-seat',side===seat);
    const button=$(seat==='left'?'share-left':'share');
    button.textContent=`${seat==='left'?'L':'R'}: ${name} 링크 복사`;
    button.setAttribute('aria-label',`${name}님의 ${seat==='left'?'왼쪽':'오른쪽'} 방 링크 복사`);
  }
}
function showGame(){setConnecting(!connected);closeShareMenu(); document.body.classList.add('playing');$('lobby').hidden=true;$('game').hidden=false;resize(); }
function resize(){const bounds=$('stage').getBoundingClientRect(),w=bounds.width||window.innerWidth,h=bounds.height||window.innerHeight;const dpr=Math.min(devicePixelRatio||1,3);canvas.style.width='100%';canvas.style.height='100%';canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);new ResizeObserver(resize).observe($('stage'));$('scale').oninput=resize;
let activeAuthSession=null,infoStops=[];
async function firebase(session='[DEFAULT]'){
  if(api&&activeAuthSession===session)return;
  if(unsub){unsub();unsub=null;}for(const stop of infoStops)stop();infoStops=[];connected=false;
  if(firebaseConfig.apiKey==='REPLACE_ME')throw new Error('firebase-config.js에 Firebase 설정을 입력해주세요. 혼자 미리 해보기는 설정 없이 가능합니다.');
  const [a,b,c]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js')]);
  const app=a.getApps().find(app=>app.name===session)||a.initializeApp(firebaseConfig,session),auth=b.getAuth(app);db=c.getDatabase(app);
  if(new URLSearchParams(location.search).has('emulator')&&['localhost','127.0.0.1'].includes(location.hostname)){b.connectAuthEmulator(auth,`http://127.0.0.1:${emulatorPorts.auth}`,{disableWarnings:true});c.connectDatabaseEmulator(db,'127.0.0.1',emulatorPorts.database);}
  await b.setPersistence(auth,b.browserLocalPersistence);uid=(await signInWithRetry(auth,b.signInAnonymously)).uid;api=c;activeAuthSession=session;
  infoStops.push(c.onValue(c.ref(db,'.info/serverTimeOffset'),s=>offset=s.val()||0));
  infoStops.push(c.onValue(c.ref(db,'.info/connected'),s=>{connected=!!s.val();$('connection').textContent=connected?'연결됨':'재연결 중';if(roomLoaded)setConnecting(!connected);}));
}
function roomRef(path=''){return api.ref(db,`rooms/${roomId}${path?'/'+path:''}`);}
async function enter(id,create=false,mode='remote',copying=null){
  clearError();setConnecting(true);for(const id of ['create-together','create-remote'])$(id).disabled=true;
  const generation=++enterGeneration;roomLoaded=false;seenOpponent=false;room=null;controlsSeat=false;
  const selectedSeat=create?'left':requestedSeat(location.href);
  try{roomId=id;side=selectedSeat||'right';await spritesReady;if(spriteLoadError)throw spriteLoadError;await firebase(authSession(id,selectedSeat));if(generation!==enterGeneration)return;demo=false;cameraReady=false;finishAt=0;
    if(create){await api.set(roomRef(),{mode,seatKeys,initials:initials(),meetingMessage:$('meeting-message').value.trim().slice(0,40),round:0,createdAt:api.serverTimestamp(),left:{uid,accessKey:seatKeys.left,round:0,taps:0,lastTap:0}});}
    else{const snapshot=await api.get(roomRef());const r=snapshot.val();if(!r)throw new Error('방이 없어요. 새 방을 만들어주세요.');
      const accessKey=new URL(location.href).searchParams.get('seatKey');
      const action=seatAction(r,uid,selectedSeat,accessKey);seatKeys=r.seatKeys||null;
      if(action==='invalid')throw new Error('자리 링크가 올바르지 않아요. 하단에서 복사한 전체 링크를 열어주세요.');
      if(action==='resume'){const resumed=await api.runTransaction(roomRef(selectedSeat),p=>resumeSeat(p,uid,accessKey,r[selectedSeat])??undefined,{applyLocally:false});if(!resumed.committed)throw new Error('자리 연결을 다시 시도해주세요.');side=selectedSeat;}
      if(action==='occupied')throw new Error(`${selectedSeat==='left'?'왼쪽':selectedSeat==='right'?'오른쪽':'선택한'} 자리가 이미 사용 중이에요. 처음 입장했던 브라우저에서 해당 자리 링크를 다시 열어주세요. 다른 브라우저로 바꿨다면 새 방을 만들어주세요.`);
      if(action==='claim'){const claim=await api.runTransaction(roomRef('right'),v=>v?undefined:{uid,...(seatKeys?{accessKey:seatKeys.right}:{}),round:r.round??0,taps:0,lastTap:0},{applyLocally:false});if(!claim.committed)throw new Error('오른쪽 자리에 다른 사람이 먼저 들어왔어요. 새 방을 만들어주세요.');side='right';}else if(action!=='resume')side=action;
    }
    const confirmed=(await api.get(roomRef())).val();
    if(generation!==enterGeneration)return;
    if(!confirmed)throw new Error('방 정보를 불러오지 못했어요. 같은 링크를 다시 열어주세요.');
    room=confirmed;roomLoaded=true;controlsSeat=room[side]?.uid===uid;
    seenOpponent=!!room[side==='left'?'right':'left'];syncSeatCards();
    history.replaceState(null,'',selectedSeat?invitationURL(roomId,side):`${location.pathname}${location.search}#${roomId}`);showGame();
    $('share').hidden=false;$('share-left').hidden=false;
    if(create){copiedNotice(copying?await copying:await writeLink(invitationURL()));}
    if(unsub)unsub();unsub=api.onValue(roomRef(),snapshot=>{if(generation!==enterGeneration)return;room=snapshot.val();if(!room){connectionFailed(new Error('방이 삭제되었어요.'));return;}const assignedSide=selectedSeat||(room.left.uid===uid?'left':'right');if(assignedSide!==side)cameraReady=false;side=assignedSide;controlsSeat=room[side]?.uid===uid;roomLoaded=true;seenOpponent=seenOpponent||!!room[side==='left'?'right':'left'];syncSeatCards();
      if(controlsSeat&&room.right&&!room.startAt&&!startBusy){startBusy=true;api.runTransaction(roomRef('startAt'),v=>v??api.serverTimestamp(),{applyLocally:false}).catch(error).finally(()=>startBusy=false);}
    },e=>{if(generation===enterGeneration)connectionFailed(e);});
  }catch(e){if(generation===enterGeneration)connectionFailed(e);}finally{for(const id of ['create-together','create-remote'])$(id).disabled=false;}
}
function newRoom(){const bytes=crypto.getRandomValues(new Uint8Array(16));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
$('create-together').onclick=()=>createRoom('together');
$('create-remote').onclick=()=>createRoom('remote');
function resetPresentation(){wallEdge=null;wallUntil=0;cameraReady=false;finishAt=0;lastInput=0;demoStarted=false;for(const a of Object.values(animation)){a.taps=0;a.at=-Infinity;}}
$('new').onclick=async()=>{
  if(!room||resetBusy||(!demo&&!controlsSeat))return;clearError();
  if(demo){room=resetRound(room,now());resetPresentation();return;}
  if(!connected){error('다시 연결한 후 다시하기를 눌러주세요.');return;}
  if(!room.right){error('상대가 접속한 후 다시하기를 눌러주세요.');return;}
  const expectedRound=room.round??0,beforeReset=room;resetBusy=true;$('new').disabled=true;
  try{await api.runTransaction(roomRef(),r=>{const current=r??beforeReset;return (current.round??0)===expectedRound?resetRound(current,api.serverTimestamp())??undefined:undefined;},{applyLocally:false});}catch(e){error(e);}finally{resetBusy=false;$('new').disabled=false;}
};
function returnToLobby(){
  if(room){
    $('my-initial').value=room.initials?.left??$('my-initial').value;
    $('partner-initial').value=room.initials?.right??$('partner-initial').value;
    $('meeting-message').value=room.meetingMessage??$('meeting-message').value;
  }
  ++enterGeneration;
  if(unsub){unsub();unsub=null;}
  for(const stop of infoStops)stop();infoStops=[];activeAuthSession=null;api=null;db=null;
  room=null;roomId=null;seatKeys=null;roomLoaded=false;seenOpponent=false;controlsSeat=false;connected=false;
  busy=false;resetBusy=false;startBusy=false;observedRound=null;side='left';demo=false;
  resetPresentation();lastStatus='';lastCountdown='';
  clearError();clearTimeout(noticeTimer);$('notice').hidden=true;$('countdown').hidden=true;
  $('game').hidden=true;$('lobby').hidden=false;document.body.classList.remove('playing');
  setConnecting(false);$('connection').textContent='';$('new').disabled=false;
  history.replaceState(null,'',lobbyLink(location.href));
  $('my-initial').focus();
}
$('create-new').onclick=returnToLobby;
$('share-menu').onclick=()=>{
  const opening=$('seat-links').hidden;$('seat-links').hidden=!opening;
  $('share-menu').setAttribute('aria-expanded',String(opening));
};
document.addEventListener('pointerdown',event=>{if(!$('seat-links').contains(event.target)&&!$('share-menu').contains(event.target))closeShareMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeShareMenu();});
$('share').onclick=()=>copyInvite('right');
$('share-left').onclick=()=>copyInvite('left');

setInterval(()=>{if(demo&&demoStarted&&canTap({...room,startAt:room.startAt+3000},now())){const position=state(room.left.taps,room.right.taps);if(!position.done||position.meeting>MIN_MEETING)room.right.taps++;}},280);
async function tap(){
  if(!room||!connected||busy||now()-lastInput<65)return;
  lastInput=now();
  if(demo){if(canTap({...room,startAt:room.startAt?room.startAt+3000:null},now())){demoStarted=true;room.left.taps++;}return;}
  const seat=side,activeRoom=roomId,generation=enterGeneration;
  busy=true;
  try{
    // Ownership changes only on a deliberate touch, never on a room update.
    if(!controlsSeat||room[seat]?.uid!==uid){
      const key=seatKeys?.[seat],fallback=room[seat];
      if(!key){error('이 자리의 전체 링크를 다시 열어주세요.');return;}
      const result=await api.runTransaction(roomRef(seat),p=>resumeSeat(p,uid,key,fallback)??undefined,{applyLocally:false});
      if(generation!==enterGeneration||activeRoom!==roomId)return;
      if(!result.committed){error('제어권을 가져오지 못했어요. 화면을 다시 터치해주세요.');return;}
      const player=result.snapshot.val();room={...room,[seat]:player};controlsSeat=player.uid===uid;
      clearError();syncSeatCards();
      const waitForTap=Math.max(0,65-(now()-(player.lastTap||0)));
      if(waitForTap)await new Promise(resolve=>setTimeout(resolve,waitForTap));
      if(generation!==enterGeneration||activeRoom!==roomId)return;
    }
    if(!canTap({...room,startAt:room.startAt?room.startAt+3000:null},now()))return;
    const position=state(room.left?.taps,room.right?.taps);
    if(position.done&&((seat==='left'&&position.meeting>=MAX_MEETING)||(seat==='right'&&position.meeting<=MIN_MEETING))){wallUntil=now()+1500;return;}
    const expectedRound=room.round??0,fallback=room[seat];
    await api.runTransaction(roomRef(seat),p=>{const current=p??fallback;return current?.uid===uid&&(current.round??0)===expectedRound?{...current,taps:current.taps+1,lastTap:api.serverTimestamp()}:undefined;},{applyLocally:false});
  }catch(e){if(generation===enterGeneration)error(e);}finally{if(generation===enterGeneration)busy=false;}
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
  const bounds=spriteMeta.pepero?.[0];if(!bounds)return;
  const [sx,sy,sw,sh]=bounds;
  const chocolateX=sx+sw*.18,chocolateWidth=sw*.75;
  const gap=s.rightX-s.leftX-96;
  if(gap<=.01)return;
  // Tile at one uniform scale; longer tablet roads add length, never distortion.
  const height=14,tileWidth=chocolateWidth/sh*height,cookieSourceWidth=sw*.10,cookieWidth=cookieSourceWidth/sh*height;
  const origin=roadLayout(state(),s.roadWidth,room?.mode).leftX+48;
  const start=s.leftX+48,end=start+gap;
  c.save();c.beginPath();c.rect(start,477-height/2,gap,height);c.clip();
  // Keep one biscuit handle at the host's end; only chocolate repeats beyond it.
  c.drawImage(img,sx,sy,cookieSourceWidth,sh,origin,477-height/2,cookieWidth,height);
  const chocolateOrigin=origin+cookieWidth;
  // A continuous chocolate core closes tiny transparent seams between repeats.
  const cocoa=c.createLinearGradient(0,472,0,482);
  cocoa.addColorStop(0,'#9e5134');cocoa.addColorStop(.4,'#6e2d1c');cocoa.addColorStop(1,'#4a2017');
  c.fillStyle=cocoa;c.fillRect(Math.max(start,chocolateOrigin-1),473,Math.max(0,end-Math.max(start,chocolateOrigin-1)),9);
  const stride=tileWidth-1;
  for(let x=chocolateOrigin+Math.max(0,Math.floor((start-chocolateOrigin)/stride))*stride;x<end;x+=stride){
    c.drawImage(img,chocolateX,sy,chocolateWidth,sh,x,477-height/2,tileWidth,height);
  }
  // Finish with the original rounded chocolate tip at the guest's mouth.
  const tipSourceWidth=sw*.065,tipWidth=tipSourceWidth/sh*height;
  if(gap>cookieWidth+tipWidth)c.drawImage(img,sx+sw-tipSourceWidth,sy,tipSourceWidth,sh,end-tipWidth,477-height/2,tipWidth,height);
  c.restore();
}
function scenery(c,view,width,t){
  c.save();c.translate(view,0);
  const sky=c.createLinearGradient(0,0,0,HEIGHT);
  sky.addColorStop(0,'#cfe9f7');sky.addColorStop(.55,'#edf7fa');sky.addColorStop(.65,'#f7f5e9');sky.addColorStop(1,'#f6f0df');
  c.fillStyle=sky;c.fillRect(0,0,width,HEIGHT);
  // The distant decorations scroll slowly; the path stays anchored to the bears.
  for(let n=Math.floor(view*.22/640)-1;n<=Math.ceil((view*.22+width)/640);n++){
    const x=n*640-view*.22;
    // Soft clouds stay above the action, with a slower parallax than the path.
    c.fillStyle='#ffffffc9';
    for(const [cx,cy,size] of [[x+145,154,1],[x+480,248,.7]]){
      c.beginPath();c.ellipse(cx,cy,62*size,17*size,0,0,Math.PI*2);c.fill();
      circle(c,cx-20*size,cy-12*size,22*size,'#ffffffc9');
      circle(c,cx+10*size,cy-19*size,28*size,'#ffffffc9');
      circle(c,cx+38*size,cy-8*size,18*size,'#ffffffc9');
    }
    c.fillStyle='#cee0c8';c.beginPath();c.ellipse(x+180,543,230,74,0,Math.PI,0);c.fill();
    c.fillStyle='#e0eaca';c.beginPath();c.ellipse(x+470,543,210,53,0,Math.PI,0);c.fill();
  }
  c.fillStyle='#e5edcc';c.fillRect(0,537,width,9);
  c.fillStyle='#f2e5cb';c.fillRect(0,546,width,65);
  c.strokeStyle='#d6d9b7';c.lineWidth=1;c.beginPath();c.moveTo(0,546);c.lineTo(width,546);c.stroke();
  c.strokeStyle='#fffdf4';c.lineWidth=2;c.setLineDash([5,15]);c.lineDashOffset=view%20;c.beginPath();c.moveTo(0,602);c.lineTo(width,602);c.stroke();c.setLineDash([]);c.lineDashOffset=0;
  for(let n=Math.floor(view/120)-1;n<=Math.ceil((view+width)/120);n++){
    const x=n*120-view;
    circle(c,x+16,574,2,'#c6b28d70');circle(c,x+67,586,1.5,'#c6b28d60');
    c.save();c.translate(x+30,542);c.strokeStyle='#a1b58c';c.lineWidth=1.5;
    c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(4,-10,1,-18);c.stroke();
    for(let petal=0;petal<5;petal++){const a=petal*Math.PI*2/5;circle(c,1+Math.cos(a)*4,-20+Math.sin(a)*4,3,n%3===0?'#e9bcc4':'#fffdf2');}
    circle(c,1,-20,2,'#f8e7ba');c.restore();
  }
  for(let n=Math.floor(view*.4/180)-1;n<=Math.ceil((view*.4+width)/180);n++){
    const x=n*180-view*.4;
    c.globalAlpha=.15;c.fillStyle='#88adbd';c.font='12px serif';c.textAlign='center';
    c.fillText('♡',x+55,300+Math.sin(n*2+t/2600)*7);c.globalAlpha=1;
  }
  c.restore();
}
function world(c,view,width,t){
  const l=room?.left?.taps||0,r=room?.right?.taps||0,s=roadLayout(state(l,r),width,room?.mode);
  c.save();c.beginPath();c.rect(0,0,width,HEIGHT);c.clip();c.translate(-view,0);
  scenery(c,view,width,t);
  if(room?.mode!=='remote'){c.strokeStyle='#c0a98a';c.lineWidth=1;c.setLineDash([3,8]);c.beginPath();c.moveTo(390,140);c.lineTo(390,710);c.stroke();c.setLineDash([]);}
  c.textAlign='center';
  
  c.fillStyle='#c7bba077';c.beginPath();c.ellipse(s.leftX,548,49,10,0,0,Math.PI*2);c.ellipse(s.rightX,548,49,10,0,0,Math.PI*2);c.fill();
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
    const savedMessage=room?.meetingMessage;
    const message=elapsed<3000?(savedMessage==null||savedMessage==='우리 만났어요! ♥'?'다 먹었다! ♥':savedMessage):'';
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

  c.fillStyle='#6d8b96';c.font='12px sans-serif';c.fillText(currentStatus(),view+width/2,650);
  c.fillStyle='#d9dfd3';c.fillRect(view+50,690,width-100,3);c.fillStyle='#88b2a9';c.fillRect(view+50,690,(width-100)*s.progress,3);
  c.restore();
}
let lastCountdown='';
let lastStatus='';function frame(t){
  if(room&&observedRound!==(room.round??0)){observedRound=room.round??0;resetPresentation();}
  const scene=state(room?.left?.taps,room?.right?.taps);
  const nextWall=scene.done?(scene.meeting<=MIN_MEETING?'left':scene.meeting>=MAX_MEETING?'right':null):null;
  if(nextWall&&nextWall!==wallEdge)wallUntil=now()+1800;
  wallEdge=nextWall;
  if(!cameraReady){cameraX=side==='left'?0:WIDTH;cameraReady=true;}
  cameraX=advanceCamera(cameraX,scene,side,room?.mode,t-lastFrame);lastFrame=t;
  if(!scene.done)finishAt=0;else if(!finishAt){finishAt=t;notify('붙어서 함께 이동해요! 계속 탭해주세요 ♥');}
  const {sceneWidth,view,scale,offsetY}=viewportLayout(canvas.width,canvas.height,side,room?.mode,cameraX,scene);
  ctx.setTransform(1,0,0,1,0,0);const backdrop=ctx.createLinearGradient(0,0,0,canvas.height);backdrop.addColorStop(0,'#cfe9f7');backdrop.addColorStop(.65,'#f7f5e9');backdrop.addColorStop(1,'#f6f0df');ctx.fillStyle=backdrop;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(scale,0,0,scale,0,offsetY);world(ctx,view,sceneWidth,t);if($('overview').parentElement.open)world(overview,0,780,t);
  if(room){const s=state(room.left?.taps,room.right?.taps);$('score').textContent=`${room.left?.taps||0} : ${room.right?.taps||0}`;
    const seconds=room.startAt?Math.ceil((room.startAt+3000-now())/1000):0;
    const countText=room.startAt?countdownText(now()-room.startAt):'';
    const counting=roomLoaded&&connected&&!!room.left&&!!room.right&&!!countText;
    $('countdown').hidden=!counting;
    if(counting&&countText!==lastCountdown){
      $('countdown-number').textContent=countText;
      $('countdown-number').animate([{transform:'scale(.65)',opacity:.3},{transform:'scale(1.12)',opacity:1,offset:.65},{transform:'scale(1)',opacity:1}],{duration:420,easing:'ease-out'});
    }
    lastCountdown=counting?countText:'';
    const text=currentStatus();if(text!==lastStatus){$('status').textContent=text;lastStatus=text;}}else if(!roomLoaded){const text=currentStatus();if(text!==lastStatus){$('status').textContent=text;lastStatus=text;}}
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
const id=location.hash.slice(1);if(id){if(/^[a-f0-9]{32}$/.test(id))enter(id);else connectionFailed(new Error('올바른 초대 링크가 아니에요.'));}






// A hash-only navigation can switch rooms without reloading the page.
addEventListener('hashchange',()=>{if(location.hash.slice(1)!==roomId)location.reload();});
