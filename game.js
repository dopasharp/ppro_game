export const WIDTH=390, HEIGHT=844, TOTAL=24;
// Use one scale on both axes. Together screens meet at the same world seam.
export function viewportLayout(width,height,side,mode,cameraX,scene=null){
  const scale=Math.min(width/WIDTH,height/HEIGHT);
  const sceneWidth=width/scale;
  const offsetY=(height-HEIGHT*scale)/2;
  const stretch=roadStretch(sceneWidth);
  const center=scene?.done?scene.meeting:cameraX+WIDTH/2;
  const view=mode==='together'?(side==='left'?WIDTH-sceneWidth:WIDTH):WIDTH+(center-WIDTH)*stretch-sceneWidth/2;
  return {sceneWidth,view,scale,offsetY};
}
// Each bite opens and closes the mouth twice, then returns to rest.
export function bitePose(elapsed){
  const chewing=elapsed>=0&&elapsed<480;
  return {frame:chewing?Math.floor(elapsed/120)%4:0,row:chewing&&Math.floor(elapsed/120)%2===0?1:0};
}
export const LEFT_START=104, RIGHT_START=676, KISS_GAP=96;
export const MIN_MEETING=LEFT_START+KISS_GAP/2, MAX_MEETING=RIGHT_START-KISS_GAP/2;
export const STEP=(RIGHT_START-LEFT_START-KISS_GAP)/TOTAL;
function roadStretch(width){return Math.max(1,(width/2-KISS_GAP/2)/(WIDTH-LEFT_START-KISS_GAP/2));}
// Extend walking distances on wide screens without widening sprites.
export function roadLayout(scene,width,mode){
  const stretch=roadStretch(width);
  const center=x=>WIDTH+(x-WIDTH)*stretch;
  const left=x=>center(x)+(stretch-1)*KISS_GAP/2;
  const right=x=>center(x)-(stretch-1)*KISS_GAP/2;
  return {...scene,leftX:left(scene.leftX),rightX:right(scene.rightX),meeting:center(scene.meeting),roadWidth:width,leftMarker:WIDTH-width+35,rightMarker:WIDTH+width-35};
}
export function state(left=0,right=0){
  const done=left+right>=TOTAL;
  const rawMeeting=(LEFT_START+RIGHT_START+(left-right)*STEP)/2;
  const meeting=done?Math.max(MIN_MEETING,Math.min(MAX_MEETING,rawMeeting)):rawMeeting;
  const leftX=done?meeting-KISS_GAP/2:LEFT_START+left*STEP;
  const rightX=done?meeting+KISS_GAP/2:RIGHT_START-right*STEP;
  return {progress:Math.min(1,(left+right)/TOTAL),meeting,leftX,rightX,done:left+right>=TOTAL,winner:left===right?'tie':left>right?'left':'right',meetingSide:Math.abs(meeting-WIDTH)<1e-9?'tie':meeting<WIDTH?'left':'right'};
}
export function canTap(room,now){return !!room?.startAt && now>=room.startAt;}
// Cameras are local presentation; gameplay state remains shared tap counters.
export function cameraTarget(s,side,mode='together'){
  const clamp=x=>Math.max(0,Math.min(WIDTH,x));
  if(mode!=='remote')return side==='left'?0:WIDTH;
  if(s.done)return clamp(s.meeting-WIDTH/2);
  return clamp((side==='left'?s.leftX:s.rightX)-WIDTH*(side==='left'?.45:.55));
}
export function advanceCamera(current,s,side,mode,deltaMs){
  const target=cameraTarget(s,side,mode);
  if(mode!=='remote')return target;
  const blend=1-Math.exp(-Math.max(0,Math.min(deltaMs,100))/125);
  let next=current+(target-current)*blend;
  if(s.done)return Math.max(s.rightX+48-WIDTH,Math.min(s.leftX-48,next));
  // Keep the subject visible even when snapshots jump after reconnection.
  const low=s.done?s.rightX+48-WIDTH:(side==='left'?s.leftX:s.rightX)+48-WIDTH;
  const high=s.done?s.leftX-48:(side==='left'?s.leftX:s.rightX)-48;
  const min=Math.max(0,Math.min(WIDTH,low)),max=Math.max(0,Math.min(WIDTH,high));
  if(min<=max)next=Math.max(min,Math.min(max,next));
  return Math.max(0,Math.min(WIDTH,next));
}
// Reset a shared room atomically while preserving the room link and seats.
export function resetRound(room,timestamp){
  if(!room?.left||!room?.right)return null;
  const round=(room.round??0)+1;
  return {...room,round,startAt:timestamp,
    left:{...room.left,round,taps:0,lastTap:0},
    right:{...room.right,round,taps:0,lastTap:0}};
}
