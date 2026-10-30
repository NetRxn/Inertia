import {accessSync,constants,realpathSync,statSync} from 'node:fs';
import {isAbsolute,join} from 'node:path';

/** Cross-repository qualification is opt-in; public synthetic tests need no DFW checkout. */
export function dfwFixture(){
 const source=process.env.INERTIA_DFW_SOURCE_ROOT,executable=process.env.INERTIA_DFW_PYTHON;
 if(source===undefined&&executable===undefined)return{enabled:false,backend:'',python:''};
 if(!source||!executable||!isAbsolute(source)||!isAbsolute(executable))
  throw Error('DFW qualification requires absolute INERTIA_DFW_SOURCE_ROOT and INERTIA_DFW_PYTHON paths');
 // Keep a virtual environment's executable path: resolving its symlink would
 // launch the base Python without the environment's installed dependencies.
 const backend=realpathSync(source),python=executable;
 for(const directory of [join(backend,'src','dfw_incentives'),join(backend,'tests')])
  if(!statSync(directory).isDirectory())throw Error('DFW qualification source directory required: '+directory);
 if(!statSync(python).isFile())throw Error('DFW qualification Python executable required');
 accessSync(python,constants.X_OK);
 return{enabled:true,backend,python};
}
