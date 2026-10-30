export function roomLink(base,id,side='right',key=null){
  const url=new URL(base);url.searchParams.set('v','34');if(key)url.searchParams.set('seatKey',key);else url.searchParams.delete('seatKey');url.searchParams.set('side',side);url.hash=id;return url.href;
}
export function requestedSeat(url){const side=new URL(url).searchParams.get('side');return side==='left'||side==='right'?side:null;}
export function authSession(id,side){return side?`ppro-${id}-${side}`:'[DEFAULT]';}
export function seatAction(room,uid,seat,key=null){
  if(!seat){if(room.left.uid===uid)return 'left';if(room.right?.uid===uid)return 'right';return room.right?'occupied':'claim';}
  if(room[seat]?.uid===uid)return seat;
  if(room.seatKeys&&key!==room.seatKeys[seat])return 'invalid';
  if(room[seat]&&key&&key===room.seatKeys?.[seat])return 'resume';
  return seat==='right'&&!room.right?'claim':'occupied';
}
export function resumeSeat(player,uid,key){return player&&key&&player.accessKey===key?{...player,uid}:null;}
