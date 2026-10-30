import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root)){res.writeHead(403).end();return;}const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(content);}catch{res.writeHead(404).end('Not found');}});
let port=Number(process.env.PORT||8080);
const lastPort=port+20;
server.on('error',err=>{
  if(err.code==='EADDRINUSE'&&port<lastPort){
    console.log(`Port ${port} is busy; trying ${port+1}...`);
    server.listen(++port,'127.0.0.1');
  }else{
    console.error(`Cannot start preview: ${err.message}`);
    process.exitCode=1;
  }
});
server.on('listening',()=>console.log(`Local: http://127.0.0.1:${port}`));
server.listen(port,'127.0.0.1');

