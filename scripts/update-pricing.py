#!/usr/bin/env python3
"""
Gera src/data/pricing.json a partir das páginas públicas de preço do Google Cloud.

As páginas de preço trazem, embutidas no HTML, as tabelas de TODAS as regiões
(o seletor de região só alterna qual tabela fica visível). Este script extrai:

  * Compute Engine: preço por vCPU e por GiB de RAM de cada família, por região
    (ajuste por mínimos quadrados sobre todos os machine types predefinidos),
    além dos multiplicadores de CUD por recurso (1 e 3 anos).
  * Cloud SQL (Enterprise): vCPU, RAM, SSD e tiers compartilhados por região.
  * Persistent Disk / Hyperdisk / snapshots por região.
  * Cloud Storage (regional) por classe e região.

Uso:  python3 scripts/update-pricing.py
"""
import json
import re
import statistics
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'data' / 'pricing.json'

PAGES = {
    'gce': 'https://cloud.google.com/products/compute/pricing/general-purpose?hl=en',
    'gce_co': 'https://cloud.google.com/products/compute/pricing/compute-optimized?hl=en',
    'disk': 'https://cloud.google.com/compute/disks-image-pricing?hl=en',
    'sql': 'https://cloud.google.com/sql/pricing?hl=en',
    'gcs': 'https://cloud.google.com/storage/pricing?hl=en',
}

FAMILIES = ['e2', 'n1', 'n2', 'n2d', 'n4', 'n4d', 't2d', 'c3', 'c3d', 'c4', 'c4d', 'c2', 'c2d', 'h3']
SHARED_CORE = {'e2-micro': 0.25, 'e2-small': 0.5, 'e2-medium': 1.0}

MARKER = re.compile(r'"([^"\\]{2,80}) \(([a-z]+-[a-z]+\d+)\)",\[(\d+)\]')
TOKEN = re.compile(r'\[null,\[null,"((?:[^"\\]|\\.)*)"\]\]')
PRICE = re.compile(r'^\$([\d,]+(?:\.\d+)?) / 1 (?:gibibyte )?(hour|month)')
MT = re.compile(r'^([a-z0-9]+)-(standard|highmem|highcpu|micro|small|medium)(?:-(\d+))?$')


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (pricing-table-generator)'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read().decode('utf-8')


def region_tables(html: str):
    """Lista de (region_id, region_name, tokens) — uma entrada por tabela regional."""
    out, prev = [], 0
    for m in MARKER.finditer(html):
        seg = html[prev:m.start()]
        prev = m.end()
        toks = []
        for t in TOKEN.findall(seg):
            try:
                txt = json.loads('"' + t + '"')
            except json.JSONDecodeError:
                continue
            toks.append(re.sub(r'<[^>]+>', '', txt).replace('\xa0', ' ').strip())
        out.append((m.group(2), m.group(1), toks))
    return out


def price(tok: str, unit: str):
    m = PRICE.match(tok)
    if not m or m.group(2) != unit:
        return None
    return float(m.group(1).replace(',', ''))


def after(toks, label, unit, n=1):
    """Primeiro(s) preço(s) após o rótulo `label` na tabela."""
    if label not in toks:
        return None
    i = toks.index(label)
    vals = []
    for t in toks[i + 1:i + 1 + 8]:
        # faixas de uso (ex.: free tier "0 gibibyte month to 30 gibibyte month") — usa o preço da faixa paga
        if ' to ' in t or t.endswith('and above') or '(Free)' in t:
            continue
        p = price(t, unit)
        if p is not None:
            vals.append(p)
            if len(vals) == n:
                return vals if n > 1 else vals[0]
        elif vals or (t and not t.startswith('$') and t != 'Unavailable'):
            break
    return None


# ---------------------------------------------------------------- Compute

def parse_compute(htmls):
    machines = {}                                  # name -> [vcpu, ram]
    rows = defaultdict(list)                       # (region, family) -> [(vcpu_billable, ram, hourly)]
    cud = defaultdict(lambda: {'1': [], '3': []})  # family -> ratios
    for html in htmls:
        for region, _, toks in region_tables(html):
            if 'Machine type' not in toks[:2]:
                continue
            is_cud = any('Resource CUDs - 1 Year' in t for t in toks[:10])
            for i, t in enumerate(toks):
                m = MT.match(t)
                if not m or m.group(1) not in FAMILIES or i + 3 >= len(toks):
                    continue
                try:
                    vcpu = float(toks[i + 1])
                    ram = float(toks[i + 2].replace(' GiB', '').replace(',', ''))
                except ValueError:
                    continue
                fam = m.group(1)
                if is_cud:
                    vals = [price(x, 'hour') for x in toks[i + 3:i + 8]]
                    if len(vals) == 5 and all(v is not None for v in vals) and vals[0] > 0:
                        cud[fam]['1'].append(vals[3] / vals[0])
                        cud[fam]['3'].append(vals[4] / vals[0])
                    continue
                hourly = price(toks[i + 3], 'hour')
                if hourly is None:
                    continue
                machines[t] = [vcpu, ram]
                billable = SHARED_CORE.get(t, vcpu)
                rows[(region, fam)].append((billable, ram, hourly, t))

    def fit(pts):
        """mínimos quadrados sem intercepto: price = a*vcpu + b*ram (None se degenerado)"""
        sxx = sum(v * v for v, _, _, _ in pts)
        syy = sum(r * r for _, r, _, _ in pts)
        sxy = sum(v * r for v, r, _, _ in pts)
        sxp = sum(v * p for v, _, p, _ in pts)
        syp = sum(r * p for _, r, p, _ in pts)
        det = sxx * syy - sxy * sxy
        if abs(det) < 1e-9 * max(1.0, sxx * syy):
            return None
        return (sxp * syy - syp * sxy) / det, (syp * sxx - sxp * sxy) / det

    def err(ab, pt):
        v, r, p, _ = pt
        return abs(ab[0] * v + ab[1] * r - p) / p

    rates = defaultdict(dict)
    outliers = set()
    degenerate = []
    worst = 0.0
    for (region, fam), pts in rows.items():
        pts = [p for p in pts if p[3] not in SHARED_CORE] or pts
        ab = fit(pts)
        if ab is None:
            degenerate.append((region, fam, pts))
            continue
        # descarta linhas mal extraídas (ex.: célula de memória deslocada) e reajusta
        clean = [p for p in pts if err(ab, p) < 0.02]
        outliers.update(p[3] for p in pts if err(ab, p) >= 0.02)
        if len(clean) >= 2 and len(clean) < len(pts):
            ab = fit(clean) or ab
            pts = clean
        worst = max([worst] + [err(ab, p) for p in pts])
        rates[region][fam] = [round(ab[0], 9), round(ab[1], 9)]

    # Famílias com uma só proporção RAM/vCPU (ex.: T2D): usa a divisão vCPU:RAM de uma família de referência
    REF = {'t2d': 'n2d', 'c2d': 'n2d', 'h3': 'c3'}
    for region, fam, pts in degenerate:
        ref = rates[region].get(REF.get(fam, 'n2')) or rates['us-central1'].get(REF.get(fam, 'n2'))
        if not ref:
            continue
        k = ref[1] / ref[0]
        a = sum(p * (v + k * r) for v, r, p, _ in pts) / sum((v + k * r) ** 2 for v, r, _, _ in pts)
        rates[region][fam] = [round(a, 9), round(a * k, 9)]
        worst = max([worst] + [err((a, a * k), p) for p in pts])
    for name in outliers:
        machines.pop(name, None)
    if outliers:
        print(f'  compute: descartados por extração inconsistente: {sorted(outliers)}')
    print(f'  compute: {len(rates)} regiões, {len(machines)} machine types, erro máx. do ajuste {worst:.4%}')

    cud_out = {}
    for fam, d in cud.items():
        if d['1'] and d['3']:
            cud_out[fam] = [round(1 - statistics.median(d['1']), 4), round(1 - statistics.median(d['3']), 4)]
    return machines, rates, cud_out


# ---------------------------------------------------------------- Cloud SQL

def parse_sql(html):
    out = {}
    for region, _, toks in region_tables(html):
        r = out.setdefault(region, {})
        hdr = toks[:3]
        if hdr[:2] == ['Price (USD)', 'vCPUs'] and 'Data Cache Storage' not in toks and 'vcpu' not in r:
            ha_v, ha_m = after(toks, 'HA vCPUs', 'hour'), after(toks, 'HA Memory', 'hour')
            if ha_v and ha_m:
                r['vcpu'], r['ram'] = round(ha_v / 2, 7), round(ha_m / 2, 7)
        if 'SSD storage capacity' in toks and 'ssd' not in r:
            v = after(toks, 'SSD storage capacity', 'month')
            if v:
                r['ssd'] = v
                hdd = after(toks, 'HDD storage capacity', 'month')
                if hdd:
                    r['hdd'] = hdd
        if 'db-f1-micro*' in toks and 'f1' not in r:
            i = toks.index('db-f1-micro*')
            r['f1'] = price(toks[i + 4], 'hour')
            j = toks.index('db-g1-small*')
            r['g1'] = price(toks[j + 4], 'hour')
    out = {k: v for k, v in out.items() if {'vcpu', 'ram', 'ssd'} <= v.keys()}
    print(f'  cloud sql: {len(out)} regiões')
    return out


# ---------------------------------------------------------------- Discos

def parse_disk(html):
    out = {}
    for region, _, toks in region_tables(html):
        r = out.setdefault(region, {})
        if 'Balanced provisioned space' in toks and 'pd-balanced' not in r:
            for label, key in [('Standard provisioned space', 'pd-standard'), ('Balanced provisioned space', 'pd-balanced'),
                               ('SSD provisioned space', 'pd-ssd')]:
                v = after(toks, label, 'month')
                if v is not None:
                    r[key] = v
        for t in toks:
            if t.startswith('Hyperdisk Balanced') and 'provisioned space' in t and 'High Availability' not in t and 'hyperdisk-balanced' not in r:
                v = after(toks, t, 'month')
                if v is not None:
                    r['hyperdisk-balanced'] = v
        if 'Standard snapshot storage' in toks and 'snapshot' not in r:
            v = after(toks, 'Standard snapshot storage', 'month')
            if v is not None:
                r['snapshot'] = v
    out = {k: v for k, v in out.items() if 'pd-balanced' in v}
    print(f'  discos: {len(out)} regiões, hyperdisk em {sum("hyperdisk-balanced" in v for v in out.values())}')
    return out


# ---------------------------------------------------------------- Cloud Storage

def parse_gcs(html):
    out = {}
    for region, _, toks in region_tables(html):
        if region in out or toks[:4] != ['Standard storage', 'Nearline storage', 'Coldline storage', 'Archive storage']:
            continue
        vals = [price(t, 'month') for t in toks if price(t, 'month') is not None][:4]
        if len(vals) == 4:
            out[region] = dict(zip(['standard', 'nearline', 'coldline', 'archive'], vals))
    print(f'  cloud storage: {len(out)} regiões')
    return out


def main():
    print('Baixando páginas de preço...')
    html = {k: fetch(u) for k, u in PAGES.items()}
    machines, compute, cud = parse_compute([html['gce'], html['gce_co']])
    sql = parse_sql(html['sql'])
    disk = parse_disk(html['disk'])
    gcs = parse_gcs(html['gcs'])

    names = {}
    for page in html.values():
        for m in MARKER.finditer(page):
            names.setdefault(m.group(2), m.group(1))

    regions = {}
    for rid in sorted(set(compute) | set(sql) | set(disk)):
        regions[rid] = {
            'name': names.get(rid, rid),
            'compute': compute.get(rid, {}),
            'sql': sql.get(rid),
            'disk': disk.get(rid),
            'storage': gcs.get(rid),
        }

    data = {
        'generatedAt': date.today().isoformat(),
        'sources': list(PAGES.values()),
        'machineTypes': dict(sorted(machines.items())),
        'cud': cud,
        'regions': regions,
    }
    OUT.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False))
    print(f'OK: {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB, {len(regions)} regiões)')


if __name__ == '__main__':
    sys.exit(main())
