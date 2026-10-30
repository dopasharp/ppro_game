// Call directly from the click handler, before authentication or database awaits.
export async function writeLink(text,env=globalThis){
  try{
    if(env.navigator.clipboard?.writeText){await env.navigator.clipboard.writeText(text);return true;}
  }catch{}
  const doc=env.document,previous=doc.activeElement,field=doc.createElement('textarea');
  field.value=text;field.readOnly=true;
  field.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none';
  doc.body.append(field);
  try{field.focus({preventScroll:true});field.select();field.setSelectionRange(0,text.length);return !!doc.execCommand('copy');}
  catch{return false;}
  finally{field.remove();previous?.focus({preventScroll:true});}
}
