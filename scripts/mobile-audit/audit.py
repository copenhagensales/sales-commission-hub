"""Mobil-audit: åbner sider som indlogget bruger i telefonbredder og finder layoutfejl.

Kør: python3 scripts/mobile-audit/audit.py [/sti ...]
Resultat: /tmp/mobile-audit/report.json + skærmbilleder.
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
WIDTHS = [360, 393, 430]
DEFAULT_ROUTES = ["/home", "/storkbook", "/my-goals", "/vagt-flow", "/my-profile", "/messages"]
OUT = Path("/tmp/mobile-audit"); OUT.mkdir(parents=True, exist_ok=True)

CHECK_JS = r"""
() => {
  const W = innerWidth, H = innerHeight, issues = [];
  const label = (e) => (e.getAttribute('aria-label') || e.innerText || e.tagName).trim().replace(/\s+/g,' ').slice(0,40);
  const visible = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect();
    return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0 && r.width > 0 && r.height > 0; };
  const inHScroll = (e) => { for (let p = e.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true; } return false; };
  if (document.documentElement.scrollWidth > W + 1) issues.push({type:'sideskrul', detail: document.documentElement.scrollWidth + 'px'});
  const main = document.querySelector('main') || document.body;
  // Tekst der går ud over skærmkanten
  main.querySelectorAll('*').forEach(e => { if (!visible(e) || inHScroll(e)) return; const r = e.getBoundingClientRect();
    if (r.right > W + 1 && e.children.length === 0) issues.push({type:'ud-over-kant', detail: label(e)}); });
  // Afskåret tekst (ikke bevidst truncate)
  main.querySelectorAll('p,span,h1,h2,h3,h4,button,a,div').forEach(e => { if (!visible(e) || e.children.length) return;
    const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') return;
    if ((s.overflowX === 'hidden' || s.overflow === 'hidden') && e.scrollWidth > e.clientWidth + 2) issues.push({type:'afskåret', detail: label(e)}); });
  // Overlappende tekstblokke
  const leaves = [...main.querySelectorAll('p,span,h1,h2,h3,h4,a,button,label')].filter(e => visible(e) && e.innerText.trim() && !inHScroll(e) && !e.querySelector('p,span,h1,h2,h3,h4,a,button,label'));
  const rects = leaves.map(e => [e, e.getBoundingClientRect()]);
  for (let i = 0; i < rects.length; i++) for (let j = i+1; j < rects.length; j++) {
    const [a, ra] = rects[i], [b, rb] = rects[j]; if (a.contains(b) || b.contains(a)) continue;
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 4 && oy > 4) issues.push({type:'overlap', detail: label(a) + ' ⟷ ' + label(b)}); }
  // Tapmål
  main.querySelectorAll('button,a,[role=button],input,select').forEach(e => { if (!visible(e) || inHScroll(e)) return; const r = e.getBoundingClientRect();
    if (e.closest('p') && e.tagName === 'A') return;
    if (r.width < 40 || r.height < 40) issues.push({type:'lille-tapmål', detail: label(e) + ` ${Math.round(r.width)}×${Math.round(r.height)}`}); });
  // Faste bjælker der overlapper hinanden
  const fixed = [...document.querySelectorAll('body *')].filter(e => { const p = getComputedStyle(e).position; return (p === 'fixed' || p === 'sticky') && visible(e); }).map(e => [e, e.getBoundingClientRect()]);
  for (let i = 0; i < fixed.length; i++) for (let j = i+1; j < fixed.length; j++) { const [a, ra] = fixed[i], [b, rb] = fixed[j];
    if (a.contains(b) || b.contains(a)) continue; if (ra.width < W*0.8 || rb.width < W*0.8) continue;
    const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top); if (oy > 2) issues.push({type:'faste-bjælker-overlapper', detail: label(a) + ' ⟷ ' + label(b)}); }
  // Enlig knap skubbet ud i højre side på egen linje
  main.querySelectorAll('a,button').forEach(e => { if (!visible(e)) return; const s = getComputedStyle(e); const p = e.parentElement; if (!p) return;
    const ps = getComputedStyle(p); if (ps.display !== 'flex' || ps.flexWrap !== 'wrap') return;
    const r = e.getBoundingClientRect(); const sib = [...p.children].filter(c => c !== e && visible(c));
    if (sib.length && sib.every(c => c.getBoundingClientRect().bottom <= r.top + 2) && r.left > p.getBoundingClientRect().left + 40)
      issues.push({type:'enlig-knap', detail: label(e)}); });
  const seen = new Set(); return issues.filter(i => { const k = i.type + i.detail; if (seen.has(k)) return false; seen.add(k); return true; });
}
"""

def session():
    if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") == "injected":
        return os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"], os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
    m = json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
    return m["storage_key"], json.dumps(m["session"])

async def main(routes):
    k, v = session(); report = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for w in WIDTHS:
            c = await b.new_context(viewport={"width": w, "height": 852}, device_scale_factor=2); pg = await c.new_page()
            await pg.goto(BASE); await pg.evaluate("([k,v])=>localStorage.setItem(k,v)", [k, v])
            for r in routes:
                await pg.goto(BASE + r); await pg.wait_for_timeout(7000)
                issues = await pg.evaluate(CHECK_JS)
                name = r.strip('/').replace('/', '_') or 'root'
                await pg.screenshot(path=str(OUT / f"{name}_{w}.png"))
                report.setdefault(r, {})[w] = issues
            await c.close()
        await b.close()
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    for r, ws in report.items():
        print(f"\n{r}")
        for w, iss in ws.items():
            print(f"  {w}px: {len(iss)} fejl")
            for i in iss[:15]: print(f"    - {i['type']}: {i['detail']}")

asyncio.run(main(sys.argv[1:] or DEFAULT_ROUTES))
