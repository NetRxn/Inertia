from pathlib import Path
import json, html
p=Path(__file__).resolve().parents[1]
d=json.loads((p/'status.json').read_text())
e=html.escape
colors={'green':'#198754','yellow':'#b38600','red':'#dc4545'}
icons={'green':'🟢','yellow':'🟡','red':'🔴'}
rows=[]
for r in d['items']:
 warning='⚠️ ' if not r['cleanPlan'] else ''
 rows.append(f'''<tr id="{e(r['id'])}"><td><span class="state" style="color:{colors[r['status']]}">{icons[r['status']]} {r['status'].upper()}</span></td><td><a href="{e(r['plan'])}">{warning}{e(r['label'])}</a><small>{e(r['owner'])}</small></td><td>{e(r['evidence'])}</td><td>{e(r['nextStep'])}<small>Proof: {e(r['proofAt'] or 'not yet established')}</small></td></tr>''')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inertia — critical path</title><style>
:root{font-family:system-ui,sans-serif;color:#e9eef5;background:#101822}body{margin:auto;max-width:1550px;padding:30px}h1{font-size:30px;margin-bottom:8px}p{line-height:1.5;color:#bccada}a{color:#8ecbff;text-decoration:none}a:hover{text-decoration:underline}.banner{background:#1c2a3b;border:1px solid #405673;padding:18px;border-radius:10px;margin:22px 0}.credits{font-size:20px;color:#fff}table{border-collapse:collapse;width:100%;font-size:14px}th{text-align:left;background:#223146;padding:13px;position:sticky;top:0}td{vertical-align:top;padding:15px 12px;border-bottom:1px solid #334354;line-height:1.45}td:first-child{width:100px}.state{font-weight:700;white-space:nowrap}td:nth-child(2){width:25%;font-weight:600}td:nth-child(3){width:30%}small{display:block;font-weight:400;color:#a5b6c8;margin-top:8px;font-size:12px}.foot{padding:20px 0}@media(max-width:850px){body{padding:15px}table{font-size:12px}.state{white-space:normal}td,th{padding:10px 6px}}@media print{body{background:white;color:#152536}a{color:#174e7b}p,small{color:#38495b}th{position:static;background:#e6edf5}.banner{background:#edf3fa}.credits{color:#152536}}
</style><h1>Inertia critical path</h1>'''
page+=f'<p>Updated {e(d["updatedAt"])} · displayed proof timestamps are UTC; local working timezone is America/Chicago.</p>'
page+='<div class="banner"><strong>⚠️ Warning = no clean plan established yet.</strong> Every item links its closure plan. A green applies only to the named capability, not complete production readiness.'
page+=f'<p class="credits">New earned time from critical greens: {d["earnedMinutes"]} minutes</p>'
page+=f'<p>Separate explicit human diagnostic bonus: {d.get("explicitDiagnosticBonusMinutes", 0)} minutes. This is not a business green.</p>'
page+='<a href="earned-time.md">Proof / time-credit ledger</a> · <a href="status.json">Machine-readable snapshot</a></div>'
page+='<table><thead><tr><th>Status</th><th>Item / linked plan / owner</th><th>Current evidence</th><th>Next step / proof time</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table>'
page+='<p class="foot">Keep partial work and evidence. Hold exhausted cases independently. Do not count source tests, a saved setting, or a successful agent run as a delivered application. Existing greens are not re-credited.</p></html>'
(p/'index.html').write_text(page)
missing=[r['plan'] for r in d['items'] if not(p/r['plan']).is_file()]
if missing: raise SystemExit('Missing plans: '+repr(missing))
print(f'Rendered {len(rows)} rows; all plan links exist.')
