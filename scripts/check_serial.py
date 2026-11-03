#!/usr/bin/env python3
"""Valida la salida USB del firmware (JSON por línea) contra el contrato v1.0.

Uso: python scripts/check_serial.py <log del monitor serie>
Informa, por captura: registros, saltos de secuencia, período entre registros,
desfase entre canales, lecturas fallidas y líneas corruptas."""
import json, sys, collections
ALL=["L_HEEL","L_MEDIAL","L_LATERAL","R_HEEL","R_MEDIAL","R_LATERAL"]
# Los canales esperados se toman de la línea `info` del propio log (una configuración puede declarar un subconjunto).
CODES=None
caps=collections.OrderedDict(); bad=[]; rec_lines=0
for n,line in enumerate(open(sys.argv[1],encoding="utf-8",errors="replace"),1):
    i=line.find('{"')
    if i<0: continue
    raw=line[i:].strip()
    try: o=json.loads(raw)
    except Exception as e:
        if '"record"' in raw or '"samples"' in raw: bad.append((n,str(e)[:60],len(raw)))
        continue
    if o.get("type")=="info" and isinstance(o.get("channels"),list):
        CODES=[c if isinstance(c,str) else c.get("code") for c in o["channels"]]
        assert CODES==[c for c in ALL if c in CODES], ("info","orden del contrato")
        continue
    if o.get("type")!="record" and "samples" not in o: continue
    if CODES is None: CODES=[x["channel_id"] for x in o["samples"]]; print("aviso: sin línea info; canales tomados del primer registro:",CODES)
    rec_lines+=1
    cid=o["capture_id"]; c=caps.setdefault(cid,{"seq":[],"t0":[],"dt":[],"err":0,"keys":set(),"vals":[]})
    c["seq"].append(o["sequence"])
    s=o["samples"]; assert [x["channel_id"] for x in s]==CODES, (n,"orden")
    ts=[x["time_us"] for x in s]; c["t0"].append(ts[0]); c["dt"].append(ts[-1]-ts[0])
    for x in s:
        if x["status"]=="read_error": c["err"]+=1; assert x["raw_value"] is None
        else: c["vals"].append(x["raw_value"]); assert 0<=x["raw_value"]<=4095
    c["keys"]|=set(o.keys())
print("canales:",CODES)
print("registros JSON válidos:",rec_lines,"| líneas de registro corruptas:",len(bad), bad[:5])
for cid,c in caps.items():
    seq=c["seq"]; gaps=[(a,b) for a,b in zip(seq,seq[1:]) if b!=a+1]
    per=[(b-a)/1000 for a,b in zip(c["t0"],c["t0"][1:])]
    print(f"\n{cid}: {len(seq)} registros, sequence {seq[0]}..{seq[-1]}, saltos {gaps[:5]}")
    print(f"  período entre registros (ms): min {min(per):.2f} med {sorted(per)[len(per)//2]:.2f} max {max(per):.2f}")
    print(f"  desfase 1.º→último canal dentro del registro (µs): min {min(c['dt'])} max {max(c['dt'])}")
    print(f"  read_error: {c['err']} | valores ok: min {min(c['vals'])} max {max(c['vals'])} | campos: {sorted(c['keys'])}")
