export const WIDTH=390, HEIGHT=844, TOTAL=24;
export const LEFT_START=46, RIGHT_START=734, KISS_GAP=96;
export const STEP=(RIGHT_START-LEFT_START-KISS_GAP)/TOTAL;
export function state(left=0,right=0){
  const leftX=LEFT_START+left*STEP, rightX=RIGHT_START-right*STEP;
  const meeting=(leftX+rightX)/2;
  return {progress:Math.min(1,(left+right)/TOTAL),meeting,leftX,rightX,done:left+right>=TOTAL,winner:left===right?'tie':left>right?'left':'right',meetingSide:Math.abs(meeting-WIDTH)<1e-9?'tie':meeting<WIDTH?'left':'right'};
}
export function canTap(room,now){return !!room?.startAt && now>=room.startAt && !state(room.left?.taps,room.right?.taps).done;}
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
