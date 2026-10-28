/** Tiny Node HTTP request/response streams, no listen/connect/TCP or actor override.
 * Express still parses the body, invokes authentication/authorization and serializes
 * the actual route response. Discarding that result models caller delivery loss.
 */
import {IncomingMessage,ServerResponse} from 'node:http';
import {Duplex} from 'node:stream';
export function inProcessRequest(app,{method='POST',url,body,headers={}}){
 return new Promise((resolve,reject)=>{
  const payload=Buffer.from(JSON.stringify(body)),chunks=[];
  const socket=new Duplex({read(){},write(_chunk,_encoding,callback){callback();}});
  const req=new IncomingMessage(socket);req.method=method;req.url=url;req.headers={host:'synthetic.invalid','content-type':'application/json','content-length':String(payload.length),...headers};req.complete=true;
  const res=new ServerResponse(req);res.assignSocket(socket);
  const write=res.write.bind(res),end=res.end.bind(res);
  res.write=(chunk,...args)=>{if(chunk)chunks.push(Buffer.from(chunk));return write(chunk,...args);};
  res.end=(chunk,...args)=>{if(chunk)chunks.push(Buffer.from(chunk));return end(chunk,...args);};
  const timer=setTimeout(()=>{req.destroy();res.destroy();socket.destroy();reject(Error('Synthetic in-process route deadline'));},15000);
  res.once('finish',()=>{clearTimeout(timer);const text=Buffer.concat(chunks).toString('utf8');let value;try{value=text?JSON.parse(text):null;}catch{value=text;}socket.destroy();resolve({status:res.statusCode,body:value});});
  res.once('error',error=>{clearTimeout(timer);socket.destroy();reject(error);});
  req.push(payload);req.push(null);
  app.handle(req,res,error=>{if(error){res.statusCode=error.status??500;res.end(JSON.stringify({error:error.message}));}else if(!res.writableEnded){res.statusCode=404;res.end('{}');}});
 });
}
