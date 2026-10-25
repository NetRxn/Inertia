import {expect, it} from "vitest";

const api = async () => {
  const mod = await import("../../src/member-funding/contracts.js").catch(() => null);
  expect(mod, "bounded member catalog contract exists").not.toBeNull();
  return mod!;
};
const row = () => ({id:"opportunity-1", sponsor:null, program:"Synthetic public opportunity",
  route:null, summary:null, deadline:"2026-11-20", benefit:null, effort:null, nextStep:null,
  sourceUrl:"https://example.org/fund", observedAt:"2026-10-25T12:00:00Z", initiativeId:null});
const page = () => ({schema:"inertia.member-funding-opportunities.v1", opportunities:[row()], nextCursor:null});

it("preserves date-only deadlines, honest nulls and grouped unknowns without inventing readiness", async () => {
  expect((await api()).parseFundingOpportunityPage(page())).toEqual(page());
});

it.each([
  (p:any)=>p.opportunities[0].packet={private:true},
  (p:any)=>p.total=999,
  (p:any)=>p.opportunities[0].deadline="2026-02-30",
  (p:any)=>p.opportunities[0].deadline="2026-11-20T12:00:00",
  (p:any)=>p.opportunities[0].observedAt="2026-10-25",
  (p:any)=>p.opportunities[0].sourceUrl="javascript:alert(1)",
  (p:any)=>p.opportunities[0].sourceUrl="https://user:password@example.org/fund",
  (p:any)=>p.opportunities[0].route="approved",
  (p:any)=>p.opportunities[0].route=["direct"],
  (p:any)=>p.opportunities[0].program="x".repeat(501),
  (p:any)=>p.opportunities.push({...p.opportunities[0]}),
  (p:any)=>p.opportunities=Array.from({length:101},(_,i)=>({...row(),id:`opportunity-${String(i).padStart(3,"0")}`})),
])("rejects invalid or overbroad source response %#", async mutate => {
  const value=page();mutate(value);
  const mod=await api();expect(()=>mod.parseFundingOpportunityPage(value)).toThrow();
});

it("requires page progression and the requested row bound", async () => {
  const mod=await api();
  expect(()=>mod.parseFundingOpportunityPage(page(),{limit:1,cursor:"opportunity-1"})).toThrow();
  expect(()=>mod.parseFundingOpportunityPage({...page(),nextCursor:"aaa"})).toThrow();
  expect(()=>mod.parseFundingOpportunityPage({...page(),opportunities:[row(),{...row(),id:"opportunity-2"}]},{limit:1,cursor:null})).toThrow();
});
