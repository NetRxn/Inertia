// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {describe,it,expect,afterEach,vi} from 'vitest';
import {pluginManifestV1Schema} from '@paperclipai/shared';
import {IntegrationsSettingsPage} from '../../src/ui/IntegrationsSettingsPage.js';
import {integrations} from '../../src/ui/integrations.js';
import {manifest} from '../../src/manifest.js';
let root:Root|undefined,dom:JSDOM|undefined;
afterEach(async()=>{if(root)await act(()=>root!.unmount());root=undefined;dom?.window.close();vi.unstubAllGlobals();});
async function mount(){dom=new JSDOM('<div id="root"></div>',{url:'https://native.example/'});vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('navigator',dom.window.navigator);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);root=createRoot(document.getElementById('root')!);await act(async()=>{root!.render(<IntegrationsSettingsPage context={{companyId:'company',companyPrefix:'fwtx',projectId:null,entityId:null,entityType:null,userId:'user'}}/>);});return document.getElementById('root')!;}

describe('Integrations company settings page',()=>{
 it('lists every integration once, grouped by status, with how it connects',async()=>{const el=await mount();expect(el.querySelectorAll('article')).toHaveLength(integrations.length);for(const item of integrations)expect(el.querySelector(`[aria-label="${item.name}"]`)?.textContent).toContain(item.how);expect([...el.querySelectorAll('h3')].map(h=>h.textContent?.replace(/\s*\(\d+\)$/,''))).toEqual(['In use','Setup needed','Planned']);});
 it('opens external links safely and keeps credentials out of the page',async()=>{const el=await mount();for(const a of el.querySelectorAll('a')){expect(a.getAttribute('target')).toBe('_blank');expect(a.getAttribute('rel')).toBe('noopener noreferrer');}expect(el.textContent).toContain('Credentials live in Secrets');});
 it('has unique ids and a manifest slot the host accepts',()=>{expect(new Set(integrations.map(i=>i.id)).size).toBe(integrations.length);const parsed=pluginManifestV1Schema.safeParse(manifest);expect(parsed.success,parsed.success?'':JSON.stringify(parsed.error.issues.slice(0,3))).toBe(true);expect(manifest.ui?.slots).toContainEqual(expect.objectContaining({type:'companySettingsPage',exportName:'IntegrationsSettingsPage',routePath:'integrations'}));});
});
