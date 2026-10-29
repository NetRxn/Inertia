"""Offline, reproducible printable chart. Never changes status or earned credits."""
from pathlib import Path
from html import escape
from datetime import datetime,timezone
import json,hashlib
from reportlab.platypus import SimpleDocTemplate,Table,TableStyle,Paragraph,Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.graphics.shapes import Drawing,Polygon,String
r=Path(__file__).parent;raw=(r/'status.json').read_bytes();s=json.loads(raw);rows=s.get('items',s.get('rows',s.get('criticalPath',[])));assert rows
body=ParagraphStyle('body',fontName='Helvetica',fontSize=11,leading=15,wordWrap='CJK',textColor=HexColor('#21374a'))
small=ParagraphStyle('small',parent=body,fontSize=10,leading=14)
head=ParagraphStyle('head',parent=body,fontName='Helvetica-Bold',fontSize=25,leading=31)
sub=ParagraphStyle('sub',parent=small,textColor=HexColor('#526879'))
def txt(v):return json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else str(v if v is not None else 'Not yet proved')
def p(v,style=body):return Paragraph(escape(txt(v)).replace('\n','<br/>'),style)
data=[[p(t) for t in ['Outcome / clean plan','Status / proof time','Owner','Evidence','Next step / plan']]]
for row in rows:
 label=row.get('label',row.get('title',row.get('name',row.get('id','unnamed'))))
 clean=row.get('cleanPlan') is True
 plan=row.get('plan',row.get('planLink',row.get('planPath','MISSING PLAN')))
 cell=p(txt(label)+('\nClean plan' if clean else '\nNO CLEAN PLAN'))
 if not clean:
  triangle=Drawing(16,16);triangle.add(Polygon([8,15,0,1,16,1],fillColor=HexColor('#ffcf59'),strokeColor=HexColor('#92600e')));triangle.add(String(6.3,3,'!',fontName='Helvetica-Bold',fontSize=11));cell=[triangle,cell]
 data.append([cell,p(txt(row.get('status'))+'\n'+txt(row.get('proofAt'))),p(row.get('owner')),p(row.get('evidence'),small),p(txt(row.get('nextStep'))+'\nPlan: '+txt(plan),small)])
t=Table(data,colWidths=[170,150,115,295,370],repeatRows=1,hAlign='LEFT')
styles=[('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),HexColor('#dfeaf3')),('GRID',(0,0),(-1,-1),.5,HexColor('#c6d4df')),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]
for n,row in enumerate(rows,1):
 color='#ecf6ef' if str(row.get('status','')).lower().startswith('green') else '#fff7e8' if row.get('cleanPlan') is False else '#ffffff'
 styles.append(('BACKGROUND',(0,n),(-1,n),HexColor(color)))
t.setStyle(TableStyle(styles))
cut=s.get('updatedAt',s.get('observedAt',s.get('baselineAt','See individual row proofs')))
story=[p('Inertia critical path - plans and proof',head),Spacer(1,8),p('Saved status: '+txt(cut)+'. Generated '+datetime.now(timezone.utc).isoformat(timespec='seconds')+'. Source SHA256 '+hashlib.sha256(raw).hexdigest()[:16],sub),Spacer(1,8),p('Mechanism GREEN is not full business acceptance. [!] marks no clean plan. Earlier credits remain historical; this export changes no status, proof or clock endpoint.',sub),Spacer(1,18),t]
ledger={k:s[k] for k in ['rule','renewedAt','earnedGreenCredits','earnedMinutes','explicitDiagnosticBonusMinutes','firstNewGreenRequiredBy','firstNewGreenRequirementMet','baseDeadline'] if k in s}
if ledger is not None:story.extend([Spacer(1,16),p('Parent-owned earned-time record',body),p('Critical greens: '+str(s.get('earnedMinutes',0))+' minutes. Separate explicit human diagnostic bonus: '+str(s.get('explicitDiagnosticBonusMinutes',0))+' minutes. No additional business green is implied.',small),p(ledger,small)])
def footer(c,doc):
 c.setFont('Helvetica',9);c.setFillColor(HexColor('#526879'));c.drawString(50,25,'Static export; canonical status.json and linked plans remain authoritative. No new green credit is created by rendering.');c.drawRightString(1150,25,str(doc.page))
SimpleDocTemplate(str(r/'critical-path.pdf'),pagesize=(1200,900),rightMargin=50,leftMargin=50,topMargin=42,bottomMargin=45,title='Inertia critical path plans and proof').build(story,onFirstPage=footer,onLaterPages=footer)
print(r/'critical-path.pdf')
