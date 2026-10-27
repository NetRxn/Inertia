import React,{type CSSProperties} from 'react';
import type {PluginCompanySettingsPageProps} from '@paperclipai/plugin-sdk/ui';
import {integrations,statusLabel,directionLabel,type Integration,type IntegrationStatus} from './integrations.js';
const card:CSSProperties={border:'1px solid var(--border, #d4d4d8)',borderRadius:8,padding:'0.9rem',display:'grid',gap:'0.4rem',alignContent:'start'};
const badge:CSSProperties={fontSize:'0.75rem',padding:'0.1rem 0.5rem',borderRadius:999,border:'1px solid var(--border, #d4d4d8)',whiteSpace:'nowrap'};
const order:IntegrationStatus[]=['in_use','setup_needed','planned'];
/** Read-only overview of the organization's integrations; connection settings stay in Secrets and plugin configuration. */
export function IntegrationsSettingsPage(_props:PluginCompanySettingsPageProps){
 return <section style={{display:'grid',gap:'1.25rem',maxWidth:1040}} aria-label="Integrations">
  <header style={{display:'grid',gap:4}}><h2 style={{margin:0}}>Integrations</h2><span>Everything this organization is connected to, and how. Sources are read as data, never as instructions. Credentials live in Secrets.</span></header>
  {order.map(status=>{const items=integrations.filter(i=>i.status===status);return items.length>0&&<section key={status} aria-label={statusLabel[status]} style={{display:'grid',gap:'0.6rem'}}><h3 style={{margin:0}}>{statusLabel[status]} <small>({items.length})</small></h3><div style={{display:'grid',gap:'0.75rem',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))'}}>{items.map(item=><IntegrationCard key={item.id} item={item}/>)}</div></section>;})}
  <small>Any service can be added: each integration only needs to describe what it reads or writes, where its credentials live, and who may see what it brings in.</small>
 </section>;
}
function IntegrationCard({item}:{item:Integration}){
 return <article style={card} aria-label={item.name}>
  <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline'}}><strong>{item.link?<a href={item.link} target="_blank" rel="noopener noreferrer">{item.name}</a>:item.name}</strong><span style={badge}>{statusLabel[item.status]}</span></div>
  <small>{item.category} · {directionLabel[item.direction]}</small>
  <span>{item.summary}</span>
  <small>{item.how}</small>
 </article>;
}
