// Original code-native artwork. Four 120 × 140 frames, facing RIGHT.
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir(new URL('../assets/',import.meta.url),{recursive:true});
for(const [name,fur,shade,accent] of [['vanilla','#f7dfb7','#e5c18b','#d7898f'],['melon','#d3e7b9','#adc98e','#e6ae7a']]){
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="140" viewBox="0 0 480 140"><defs><filter id="soft"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity=".08"/></filter></defs>';
for(let i=0;i<4;i++){const b=[0,-2,0,2][i],step=[0,5,0,-5][i];svg+=`<g transform="translate(${120*i} ${b})" stroke="#987657" stroke-width="1.4" stroke-linejoin="round" filter="url(#soft)">
<ellipse cx="58" cy="101" rx="31" ry="31" fill="${shade}"/><ellipse cx="42" cy="128" rx="16" ry="9" transform="rotate(${step} 42 128)" fill="${fur}"/><ellipse cx="79" cy="128" rx="16" ry="9" transform="rotate(${-step} 79 128)" fill="${fur}"/>
<circle cx="31" cy="29" r="17" fill="${fur}"/><circle cx="82" cy="26" r="17" fill="${fur}"/><circle cx="31" cy="29" r="10" fill="${shade}"/><circle cx="82" cy="26" r="10" fill="${shade}"/>
<ellipse cx="59" cy="61" rx="43" ry="39" fill="${fur}"/><ellipse cx="86" cy="72" rx="19" ry="14" fill="#fff4dd" stroke="none"/><ellipse cx="98" cy="67" rx="5" ry="3.5" fill="#694b3a" stroke="none"/><circle cx="77" cy="57" r="3.5" fill="#503d31" stroke="none"/><circle cx="78" cy="56" r="1" fill="white" stroke="none"/><ellipse cx="67" cy="74" rx="9" ry="5" fill="#e8a29d" opacity=".7" stroke="none"/><path d="M92 78q5 5 10-1" fill="none" stroke="#805a44"/>
<ellipse cx="51" cy="105" rx="17" ry="12" transform="rotate(${-15+step} 51 105)" fill="${fur}"/><path d="M42 24q-18-21-21-3q3 13 21 3q19-18 23-4q-1 13-23 4" fill="${accent}"/><circle cx="42" cy="23" r="4" fill="${accent}"/>
</g>`;}svg+='</svg>';await writeFile(new URL(`../assets/${name}.svg`,import.meta.url),svg);
}
