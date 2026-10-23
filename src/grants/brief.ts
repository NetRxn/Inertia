import { runPartnerResearch, type ResearchSource, type ResearchRun, type ResearchInput } from '../partners/research.js';
type Cited = {
    text: string;
    source_refs: string[];
};
type Effort = {
    minimum_hours: number;
    maximum_hours: number;
    basis: string;
    source_refs: string[];
} | null;
export interface OpportunityBrief {
    contract_version: 'opportunity-brief-v1';
    organization_id: string;
    opportunity_id: string;
    title: string;
    deadline: string | null;
    amount: {
        minimum: string | null;
        maximum: string | null;
        currency: string;
        source_refs: string[];
    } | null;
    route: 'direct_application' | 'partner_contribution' | 'next_cycle_readiness' | 'monitor_only';
    fit: Cited;
    project_alignment: (Cited & {
        project_id: string;
    })[];
    proposed_outcome: string;
    effort: {
        application: Effort;
        delivery: Effort;
        reporting: Effort;
    };
    obligations: Cited[];
    partners: {
        entity_id: string;
        name: string;
        proposed_role: string;
        source_refs: string[];
        remaining_checks: string[];
    }[];
    prepared_materials: {
        title: string;
        artifact_key: string;
        content_hash: string;
    }[];
    decisions: {
        id: string;
        question: string;
        owner: string | null;
        scope: string;
        options: string[];
        blocks: string[];
    }[];
    recommendation: string;
    next_action: string;
    packet: {
        id: string;
        version: number;
        content_hash: string;
    };
    sources: {
        id: string;
        url: string | null;
        title: string;
        source_revision: string;
        source_hash: string;
        quote: string;
    }[];
    gaps: string[];
    audience: 'public' | 'internal' | 'restricted';
}
const hex = /^[a-f0-9]{64}$/;
function text(value: unknown): asserts value is string { if (typeof value !== 'string' || !value.trim() || value.length > 20000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))
    throw Error('Invalid brief text.'); }
function list(value: unknown, maximum = 100): asserts value is unknown[] { if (!Array.isArray(value) || value.length > maximum)
    throw Error('Unbounded brief collection.'); }
function escape(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]()#!|]/g, '\\$&').replace(/[\r\n]+/g, ' '); }
function validate(b: OpportunityBrief) {
    if (!b || b.contract_version !== 'opportunity-brief-v1' || !['public', 'internal', 'restricted'].includes(b.audience) || !['direct_application', 'partner_contribution', 'next_cycle_readiness', 'monitor_only'].includes(b.route))
        throw Error('Invalid brief contract.');
    for (const v of [b.organization_id, b.opportunity_id, b.title, b.proposed_outcome, b.recommendation, b.next_action, b.packet?.id])
        text(v);
    if (!Number.isSafeInteger(b.packet.version) || b.packet.version < 1 || !hex.test(b.packet.content_hash))
        throw Error('Invalid packet binding.');
    if (b.deadline !== null) {
        text(b.deadline);
        if (!Number.isFinite(Date.parse(b.deadline)))
            throw Error('Invalid deadline.');
    }
    list(b.sources, 101);
    for (const rows of [b.project_alignment, b.obligations, b.partners, b.prepared_materials, b.decisions, b.gaps])
        list(rows);
    const ids = new Set<string>();
    for (const s of b.sources) {
        for (const v of [s.id, s.title, s.source_revision, s.quote])
            text(v);
        if (ids.has(s.id) || !hex.test(s.source_hash))
            throw Error('Invalid evidence binding.');
        ids.add(s.id);
        if (s.url !== null) {
            const url = new URL(s.url);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
                throw Error('Unsafe evidence URL.');
        }
    }
    const refs = (values: string[]) => { list(values); if (!values.length || values.some(v => !ids.has(v)))
        throw Error('Missing source binding.'); };
    const cited = (v: Cited) => { text(v.text); refs(v.source_refs); };
    cited(b.fit);
    if (b.amount) {
        const a = b.amount;
        if ([a.minimum, a.maximum].some(v => v !== null && (!/^\d+(\.\d{1,2})?$/.test(v) || !Number.isFinite(Number(v)))) || (a.minimum !== null && a.maximum !== null && Number(a.minimum) > Number(a.maximum)) || !/^[A-Z]{3}$/.test(a.currency))
            throw Error('Invalid amount range.');
        refs(a.source_refs);
    }
    for (const phase of ['application', 'delivery', 'reporting'] as const) {
        const e = b.effort[phase];
        if (e !== null) {
            if (!e || !Number.isFinite(e.minimum_hours) || !Number.isFinite(e.maximum_hours) || e.minimum_hours < 0 || e.minimum_hours > e.maximum_hours)
                throw Error('Invalid effort range.');
            text(e.basis);
            refs(e.source_refs);
        }
    }
    for (const p of b.project_alignment) {
        text(p.project_id);
        cited(p);
    }
    for (const o of b.obligations)
        cited(o);
    for (const p of b.partners) {
        for (const v of [p.entity_id, p.name, p.proposed_role])
            text(v);
        refs(p.source_refs);
        list(p.remaining_checks);
        p.remaining_checks.forEach(text);
    }
    for (const p of b.prepared_materials) {
        text(p.title);
        text(p.artifact_key);
        if (!hex.test(p.content_hash))
            throw Error('Invalid artifact hash.');
    }
    const decisions = new Set<string>();
    for (const d of b.decisions) {
        for (const v of [d.id, d.question, d.scope])
            text(v);
        if (decisions.has(d.id))
            throw Error('Duplicate decision identity.');
        decisions.add(d.id);
        if (d.owner !== null)
            text(d.owner);
        list(d.options);
        list(d.blocks);
        if (!d.options.length || !d.blocks.length)
            throw Error('Decision requires options and consequence.');
        d.options.forEach(text);
        d.blocks.forEach(text);
    }
    b.gaps.forEach(text);
}
/** Pure rendering only. The DFW builder owns current packet/evidence checks and authority. */
export function renderOpportunityBrief(b: OpportunityBrief): string {
    validate(b);
    const e = escape;
    const refs = (r: string[]) => r.map(x => `[${e(x)}]`).join(' ');
    const effort = (label: string, v: Effort) => `${label} effort: ${v ? `${v.minimum_hours}–${v.maximum_hours} hours. Basis: ${e(v.basis)} ${refs(v.source_refs)}` : 'Unknown; estimate required.'}`;
    return [
        `# ${e(b.title)}`, `Opportunity: ${e(b.opportunity_id)} · Deadline: ${b.deadline ? e(b.deadline) : 'Unknown'}`,
        `Amount: ${b.amount ? `${b.amount.minimum === null ? (b.amount.maximum === null ? 'Unknown' : `Up to ${e(b.amount.maximum)}`) : (b.amount.maximum === null ? `From ${e(b.amount.minimum)}` : `${e(b.amount.minimum)}–${e(b.amount.maximum)}`)} ${e(b.amount.currency)} ${refs(b.amount.source_refs)}` : 'Unknown'}`,
        `Route: ${e(b.route)}`, `Fit: ${e(b.fit.text)} ${refs(b.fit.source_refs)}`,
        '## Existing projects', ...b.project_alignment.map(p => `- ${e(p.project_id)}: ${e(p.text)} ${refs(p.source_refs)}`),
        `Proposed outcome: ${e(b.proposed_outcome)}`,
        '## Anticipated effort', effort('Application', b.effort.application), effort('Delivery', b.effort.delivery), effort('Reporting', b.effort.reporting),
        ...b.obligations.map(o => `- Obligation: ${e(o.text)} ${refs(o.source_refs)}`),
        '## Evidence-backed partner options', ...b.partners.map(p => `- ${e(p.name)}: ${e(p.proposed_role)} ${refs(p.source_refs)}. Remaining checks: ${p.remaining_checks.map(e).join('; ') || 'None recorded'}`),
        '## Prepared materials', ...b.prepared_materials.map(p => `- ${e(p.title)} (${e(p.artifact_key)}), SHA256 ${p.content_hash}`),
        '## Decisions required', ...b.decisions.map(d => `- ${e(d.question)} [${e(d.id)}]\n  Information owner: ${d.owner ? e(d.owner) : 'Unassigned'}. Scope: ${e(d.scope)}. Options: ${d.options.map(e).join(' / ')}. Blocks: ${d.blocks.map(e).join('; ')}.`),
        '## Remaining evidence gaps', ...b.gaps.map(g => `- ${e(g)}`),
        `Recommendation: ${e(b.recommendation)}`, `Next action: ${e(b.next_action)}`,
        `Packet: ${e(b.packet.id)} v${b.packet.version}, SHA256 ${b.packet.content_hash}`,
        '## Sources', ...b.sources.map(s => `- [${e(s.id)}] ${s.url ? `[${e(s.title)}](${new URL(s.url).href.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : e(s.title)}. Revision ${e(s.source_revision)}, SHA256 ${s.source_hash}. Evidence: ${e(s.quote)}`),
    ].join('\n\n');
}
export interface BriefDependencies {
    knowledge: ResearchSource;
    research: (saved: Awaited<ReturnType<ResearchSource['begin']>>) => Promise<ResearchInput>;
    /** Bound trusted DFW builder: reauthorizes audience/current packet and evidence after writeback. */
    readBrief: (opportunityId: string) => Promise<OpportunityBrief>;
}
/** A brief is not complete until useful knowledge (or explained reuse) has a durable receipt. */
export async function prepareOpportunityBrief(run: ResearchRun, deps: BriefDependencies) {
    if (!run.query.opportunity_id)
        throw Error('Opportunity binding required.');
    const result = await runPartnerResearch(deps.knowledge, run, deps.research);
    const brief = await deps.readBrief(run.query.opportunity_id);
    if (brief.opportunity_id !== run.query.opportunity_id)
        throw Error('Opportunity binding mismatch.');
    return { ...result, brief, markdown: renderOpportunityBrief(brief) };
}
