export function roomStatus({room,side,loaded,connected,controlsSeat=true,seenOpponent=false,now}){
  if(!connected)return '재연결 중';
  if(!loaded||!room)return '방 정보 불러오는 중';
  if(!room[side])return '내 자리 연결 중';
  if(!controlsSeat)return '다른 브라우저에서 이어 하는 중 · 터치해서 제어하기';
  const opponent=side==='left'?'right':'left';
  if(!room[opponent])return seenOpponent||room.startAt?'방 정보 동기화 중':'상대 대기 중';
  if(!room.startAt)return '시작 준비 중';
  if(now<room.startAt+3000)return '';
  return (room.left?.taps||0)+(room.right?.taps||0)>=24?'':'탭하여 이동';
}
