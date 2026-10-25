import {rm} from 'node:fs/promises';
import {build} from 'esbuild';
import {createPluginBundlerPresets} from '@paperclipai/plugin-sdk/bundlers';
const presets=createPluginBundlerPresets({uiEntry:'src/ui/MemberPacketTab.tsx',outdir:'dist',sourcemap:false});
await rm('dist/ui',{recursive:true,force:true});
await build({...presets.esbuild.ui,jsx:'automatic',entryNames:'index'});
