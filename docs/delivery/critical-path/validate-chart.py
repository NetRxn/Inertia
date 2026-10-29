"""Validate persistent chart structure without changing row status or credits."""
from pathlib import Path
from html.parser import HTMLParser
import json
root=Path(__file__).parent
state=json.loads((root/'status.json').read_text())
rows=state.get('items',state.get('rows',state.get('criticalPath',[])))
assert isinstance(rows,list) and rows,'nonempty rows required'
errors=[];warnings=[];seen=set()
for n,row in enumerate(rows):
 key=row.get('id',row.get('name',f'row{n}'))
 if key in seen:errors.append(f'{key}: duplicate row identity')
 seen.add(key)
 for field in ['owner','status','cleanPlan','evidence','proofAt','nextStep']:
  if field not in row:errors.append(f'{key}: missing {field}')
 if not isinstance(row.get('cleanPlan'),bool):errors.append(f'{key}: cleanPlan must be boolean')
 for field in ['owner','status','nextStep']:
  if not row.get(field):errors.append(f'{key}: empty {field}')
 plan=row.get('plan',row.get('planLink',row.get('planPath')))
 if isinstance(plan,dict):plan=plan.get('path',plan.get('href'))
 if not isinstance(plan,str) or not plan:errors.append(f'{key}: missing plan link')
 elif '://' not in plan and not (root/plan.split('#')[0]).exists():errors.append(f'{key}: plan target missing: {plan}')
 if row.get('cleanPlan') is False:warnings.append(f'{key}: no clean plan; triangle required')
 if str(row.get('status','')).lower().startswith('green') and not row.get('proofAt'):errors.append(f'{key}: GREEN needs proofAt')
row_text={}
class Links(HTMLParser):
 def __init__(self):super().__init__();self.row=None
 def handle_data(self,data):
  if self.row is not None:row_text[self.row]=row_text.get(self.row,'')+data
 def handle_endtag(self,t):
  if t=='tr':self.row=None
 def handle_starttag(self,t,a):
  if t=='tr':self.row=dict(a).get('id')
  if t=='a':
   href=dict(a).get('href','')
   if href and not href.startswith(('#','http:','https:','mailto:')) and not (root/href.split('#')[0]).exists():errors.append('HTML missing target: '+href)
html=(root/'index.html').read_text();Links().feed(html)
if warnings and not any(x in html for x in ['⚠','&#9888','&#x26a0','\\u26a0']):errors.append('no-clean-plan rows exist, but HTML has no warning triangle')
for row in rows:
 if row.get('cleanPlan') is False and '⚠' not in row_text.get(row.get('id'),''):errors.append(str(row.get('id'))+': row missing warning triangle')
credits=state.get('earnedGreenCredits',[])
if len({json.dumps(c,sort_keys=True) for c in credits})!=len(credits):errors.append('duplicate exact earned-green credit')
result={'rows':len(rows),'errors':errors,'warnings':warnings,'statusUnchanged':True,'creditsUnchanged':True}
print(json.dumps(result,indent=2))
if errors:raise SystemExit(1)
