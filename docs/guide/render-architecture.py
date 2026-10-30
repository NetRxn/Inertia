"""Rebuild the static source architecture SVG/PDF with ReportLab; no runtime access."""
from pathlib import Path
from html import escape
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.colors import HexColor
R=Path(__file__).parent;W,H=1200,900
c=Canvas(str(R/'architecture.pdf'),pagesize=(W,H));c.setTitle('Inertia MVP architecture and scope')
s=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-labelledby="title desc"><title id="title">Inertia MVP architecture and scope</title><desc id="desc">A general Coordinator delegates discovery and parallel funding cases, with separate independent review. Durable native, domain and member storage remain distinct. Notes, real Buzz and exhaustion revisit are deferred.</desc>']
def rect(x,y,w,h,color='#ffffff',stroke='#d4dfe8'):
 c.setFillColor(HexColor(color));c.setStrokeColor(HexColor(stroke));c.roundRect(x,H-y-h,w,h,12,fill=1,stroke=1);s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{color}" stroke="{stroke}"/>')
def text(x,y,t,size=18,color='#20394c',bold=False):
 c.setFont('Helvetica-Bold'if bold else'Helvetica',size);c.setFillColor(HexColor(color));c.drawString(x,H-y,t);s.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(t)}</text>')
def para(x,y,t,width,size=17):
 line=''
 for word in t.split():
  z=(line+' '+word).strip()
  if stringWidth(z,'Helvetica',size)>width and line:text(x,y,line,size);y+=size*1.4;line=word
  else:line=z
 if line:text(x,y,line,size);y+=size*1.4
 return y

def card(x,y,w,h,title,body,color='#ffffff'):
 rect(x,y,w,h,color);text(x+18,y+31,title,22,bold=True);end=para(x+18,y+61,body,w-36);assert end-24<y+h-13,(title,end)
def arrow(x,y,x2,y2):
 c.setStrokeColor(HexColor('#547895'));c.setLineWidth(2);c.line(x,H-y,x2,H-y2)
 s.append(f'<path d="M{x} {y} L{x2} {y2}" stroke="#547895" stroke-width="2"/>')
 if y2>y:c.line(x2,H-y2,x2-5,H-y2+8);c.line(x2,H-y2,x2+5,H-y2+8);s.append(f'<path d="M{x2-5} {y2-8} L{x2} {y2} L{x2+5} {y2-8}" fill="none" stroke="#547895" stroke-width="2"/>')
rect(0,0,W,H,'#f4f7fa','#f4f7fa');text(40,40,'INERTIA / MVP ARCHITECTURE',14,'#286587',True);text(40,88,'Knowledge into accountable work',35,bold=True);para(40,121,'Logical architecture and verified scope, October 29. A source diagram does not establish current deployment or final application approval.',1110,17)
card(40,160,350,125,'People and objectives','Own account, current organization access and exact final decisions. No agent impersonates human authority.')
card(425,160,350,125,'Member knowledge','Existing shared corpus and scoped search/read; source, passage and hash attribution remain explicit.')
card(810,160,350,125,'VPS access boundary','Cloudflare Access + tunnel and application auth. Durable stores. No Caddy layer.')
arrow(600,285,600,314)
rect(40,320,1120,82,'#e1edf5');text(61,352,'GENERAL COORDINATOR',17,'#286587',True);text(61,381,'Rank active saved opportunities; delegate, monitor and return useful work across the organization.',20)
arrow(215,402,215,431);arrow(600,402,600,431);arrow(985,402,985,431)
card(40,438,350,175,'Alpha / discovery','Retain candidates and source frontier. Reuse saved evidence. Full 1,475-record coverage is not tomorrow\'s MVP gate.')
card(425,438,350,175,'Parallel Beta / cases','Research, propose, save and correct. Thirteen case tasks and four overlapping providers observed. Preserve useful partial work.')
card(810,438,350,175,'Charlie / independent review','Exact source and artifact versions. Rejection returns correction. FUTO 393f is source acceptance, not final packet approval.')
card(40,636,545,128,'Separate durable ownership','Paperclip: tasks/reviews/run history. DFW: funding evidence/cases. Member app: organization sources and shares. Scoped readers connect them.')
card(610,636,550,128,'Readable proposed work -> human decision','Organization-grounded writing and artifact readback observed. Human accepted FUTO sample quality; current submission remains manual.')
rect(40,776,1120,72,'#fff4df','#e1c387');text(60,803,'DEFERRED FROM THIS MVP',14,'#865a12',True);text(60,829,'Real Paperclip-Buzz loop  |  Gemini notes import/triage  |  Durable exhaustion/new-evidence revisit',18)
text(40,873,'Source, release tag, deployed image, source approval and application approval are separate evidence.',14,'#526879');s.append('</svg>');(R/'architecture.svg').write_text('\n'.join(s));c.save();print(R/'architecture.pdf')
