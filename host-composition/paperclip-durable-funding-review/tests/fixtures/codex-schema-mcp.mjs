// Deterministic, unauthenticated read-only MCP fixture. Never used by live agents.
import readline from 'node:readline';
const input=readline.createInterface({input:process.stdin});
for await(const line of input){const m=JSON.parse(line);if(m.id===undefined)continue;let result;
 if(m.method==='initialize')result={protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'schema-fixture',version:'0.0.0'}};
 else if(m.method==='tools/list')result={tools:[{name:'read_fixture',description:'Read-only synthetic schema fixture',inputSchema:{type:'object',properties:{},additionalProperties:false}}]};
 else if(m.method==='tools/call')result={content:[{type:'text',text:'Synthetic fixture only'}]};
 else if(m.method==='ping')result={};
 else {process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Fixture method unsupported'}})+'\n');continue;}
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\n');
}
