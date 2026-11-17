import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
export async function startServer(){
  const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'};
  const server=http.createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
      const file=pathname==='/vendor/three.module.js'
        ? resolve(root,'tools/render/node_modules/three/build/three.module.js')
        : resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
      if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
      const data=await readFile(file);
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(done=>server.close(done))};
}
