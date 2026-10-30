from pathlib import Path
from html import escape
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth
R=Path(__file__).resolve().parents[1]/'architecture';W,H=1200,900
c=Canvas(str(R/'demo-guide.pdf'),pagesize=(W,H));svg=[]
def rect(x,y,w,h,fill,stroke='#dae2e9'):
 c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke));c.roundRect(x,H-y-h,w,h,12,fill=1,stroke=1)
 svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}"/>')
def line(x,y,t,size=19,color='#21374a',bold=False):
 f='Helvetica-Bold' if bold else 'Helvetica';c.setFont(f,size);c.setFillColor(HexColor(color));c.drawString(x,H-y,t)
 svg.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(t)}</text>')
def para(x,y,t,width,size=18,color='#475b6c'):
 words=t.split();s=''
 for word in words:
  nxt=(s+' '+word).strip()
  if stringWidth(nxt,'Helvetica',size)>width and s:line(x,y,s,size,color);y+=size*1.45;s=word
  else:s=nxt
 if s:line(x,y,s,size,color);y+=size*1.45
 return y

def start(title,sub):
 global svg
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">']
 rect(0,0,W,H,'#f5f7fa','#f5f7fa');line(40,43,'INERTIA / OCTOBER 30 DEMO',14,'#286587',True);line(40,92,title,35,bold=True);para(40,126,sub,1110,17)
def card(x,y,w,h,title,body,tag=''):
 rect(x,y,w,h,'#ffffff');line(x+19,y+33,title,22,bold=True);end=para(x+19,y+66,body,w-38,16)
 if tag:para(x+19,y+h-25,tag,w-38,13,'#286587')
 assert end-16*1.45<y+h-(40 if tag else 16),(title,end,y+h)
def end(name):
 line(40,868,'Snapshot: 29 Oct 2026, 16:22:18 CDT operator proof. Static document; refresh before presenting.',13)
 svg.append('</svg>');(R/name).write_text('\n'.join(svg));c.showPage()
start('The intended architecture','Organization-wide work, with funding as the first full workflow target. This is the approved direction; it is not a deployment-status diagram.')
card(40,165,350,140,'People + authorized sources','Current membership and action authority. Website, shares, meetings, Buzz and funding sources.')
card(425,165,350,140,'Member app + Paperclip','Partner owns the member app. Native goals, tasks, dependencies and review coordinate work.')
card(810,165,350,140,'Protected VPS boundary','Cloudflare Access + tunnel. Durable state and artifacts. No Caddy; one execution plane.')
rect(40,329,1120,85,'#e4edf5');line(62,363,'GENERAL COORDINATOR',17,'#286587',True);line(62,392,'Funding priorities + meetings + ordinary organization work; delegate, monitor, return useful results.',20)
card(40,438,350,183,'Alpha / discovery','Incremental and change-aware scanning, source high-water/checkpoint reuse, targeted discovery and full coverage accounting. Retain captures and explain failures.')
card(425,438,350,183,'Parallel Beta / cases','Each actionable opportunity: research, compile, draft and correct. Retain valid checkpoints; genuine human waits do not stop other cases.')
card(810,438,350,183,'Charlie / independent review','Separate principal reviews exact source/artifact versions. Rejection returns the same case for correction; source admission is not final packet approval.')
card(40,645,545,176,'P1 / reuse knowledge + careful Buzz','Existing member corpus is useful now. Funding machine-reader wiring and Paperclip real bridge are separate gaps. Signed admission, current audience, pairing and replay remain explicit.')
card(610,645,550,176,'P2 / Google push + human authority','Existing Gemini notes -> owning DAO import/readback -> deduplicated action triage. Review useful outputs; current submission is manual. Future agent submission requires separate exact-package authorization and qualification.')
end('big-picture.svg')
start('What is actually demonstrated','Normal startup restored: scheduler true, plugin READY, HTTP200; company active/drain off. Continuation accepted; native admission and portfolio fanout remain pending.')
card(40,165,545,185,'Member knowledge / working','Human confirmed /work answers organization questions from the stored corpus. Funding agents still lack a scoped machine reader. Source chips do not constitute immutable review receipts.','WORKING CAPABILITY / HUMAN CONFIRMED')
card(610,165,550,185,'Alpha -> Coordinator / handoff','13 source/case bindings with provenance reached the Coordinator. All 13 Beta child attempts hit native capacity. Capacity repair live; Coordinator0 PATCH rejected.','PRODUCTION HANDOFF / FANOUT NOT PROVEN')
card(40,374,545,185,'Review -> correction / proven','Independent Charlie rejection automatically resumed the same case in Beta. Deployed large-source paging delivered36 pages; isolated1.2MB/182-page scale proof is separate.','RECORDED PRODUCTION + ISOLATED SCALE CHECK')
card(610,374,550,185,'Rendered brief / retained output','Current NSF: eight-field pursuit brief, ~1,179 words, MD/DOCX; no final packet. Legacy Carter program narratives and budget framework also exist, unapproved/incomplete, with separate workflow history.','UNREVIEWED BRIEF / NOT SUBMISSION READY')
card(40,583,545,220,'Normal startup / target verified','Integrated capacity/startup repair is live on image2d8d252b, original boot46a. Target health/plugin/security42guards22 passed. Newer completed review preserved; unreviewed DONE denied.','TARGET BOOT PROVEN / BUSINESS EXECUTION PENDING')
card(610,583,550,220,'What is still missing','Native admission/new work; Coordinator0 save (422 from JSONB comparison under repair); actual fanout; accepted application material; scoped corpus reader; real Buzz bridge; notes import/intake.','NO FULL MISSION OR FINAL PACKET ACCEPTANCE')
end('current-proof-map.svg')
start('A useful five-minute walkthrough','Use existing artifacts and a harmless organization question. If a step is unavailable, show dated evidence; do not run repair commands during the demo.')
steps=[('1 / Purpose + architecture - 30 sec','Show the big-picture view. Explain the general Coordinator, native work, separate case owners and independent review.'),('2 / Existing knowledge - 60 sec','Ask the known DATACU-style question in /work. Show sources. State that funding machine-reader wiring is still missing.'),('3 / Discovery handoff - 60 sec','Open the retained13-binding Alpha -> Coordinator queue. Explain the capacity blocker; do not pretend case fanout succeeded.'),('4 / Critique and correction - 60 sec','Show the retained independent rejection and same-case Beta continuation. Rejection demonstrates quality control, not accepted application content.'),('5 / Actual generated output - 60 sec','Show the eight-field brief and available render. Call it a pursuit brief; narrative, project, budget and final packet remain unfinished.'),('6 / Next useful outcome - 30 sec','Normal execution, retained portfolio fanout and reviewed application material. Connect existing corpus/notes through owning interfaces.')]
y=170
for title,body in steps:
 rect(40,y,1120,94,'#ffffff');line(60,y+29,title,20,bold=True);para(60,y+57,body,1070,17);y+=109
end('demo-walkthrough.svg');c.save();print(R/'demo-guide.pdf')
