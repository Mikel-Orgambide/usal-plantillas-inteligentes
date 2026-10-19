/* @ds-bundle: {"format":4,"namespace":"Plantillas","components":[{"name":"Button"},{"name":"Card"},{"name":"Chip"},{"name":"ListRow"},{"name":"Header"},{"name":"StatusBanner"},{"name":"ValueCard"},{"name":"FootMap"},{"name":"LineChart"},{"name":"Icon"}]} */
(function () {
  var React = window.React, h = React.createElement;
  var cx = function () { return Array.prototype.slice.call(arguments).filter(Boolean).join(' '); };
  var fmt = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var dec = Number.isInteger(n) ? '' : ',' + Math.abs(n % 1).toFixed(1).slice(2); var s = String(Math.trunc(Math.abs(n))), out = '';
    while (s.length > 3) { out = '\u202f' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (n < 0 ? '−' : '') + s + out + dec;
  };

  /* ---------- Icon ---------- */
  var ICONS = {
    'bluetooth': [['path', { d: 'M6.5 6.5l11 11-5.5 5.5V1l5.5 5.5-11 11' }]],
    'bluetooth-off': [['path', { d: 'M12 13.5V23l5.5-5.5-3-3M12 1v4M12 5l5.5 5.5-2.5 2.5M3 3l18 18' }]],
    'play': [['path', { d: 'M7 4.5v15l12-7.5z' }]],
    'stop': [['rect', { x: 6, y: 6, width: 12, height: 12, rx: 1 }]],
    'history': [['path', { d: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.5H8M12 7.5V12l3 2' }]],
    'compare': [['path', { d: 'M10 4H4v16h6M14 4h6v16h-6M12 2v20' }]],
    'settings': [['path', { d: 'M4 7h9M19 7h1M4 17h3M13 17h7' }], ['circle', { cx: 16, cy: 7, r: 2.5 }], ['circle', { cx: 10, cy: 17, r: 2.5 }]],
    'check': [['path', { d: 'M5 12.5l4.5 4.5L19 7' }]],
    'alert': [['path', { d: 'M12 3.5l9.5 17h-19zM12 10v4M12 17.3v.4' }]],
    'chevron-right': [['path', { d: 'M9 6l6 6-6 6' }]],
    'chevron-down': [['path', { d: 'M6 9l6 6 6-6' }]],
    'plus': [['path', { d: 'M12 5v14M5 12h14' }]],
    'search': [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M20 20l-3.6-3.6' }]],
    'foot': [['path', { d: 'M14.5 2.5c3.2 0 5 2.8 4.5 6.5-.4 3-1.6 5.5-1.6 9 0 2.3-1.3 3.5-3.2 3.5s-3.4-1.2-3.4-3.6c0-3.6-2.3-6.4-2.3-9.7 0-3.5 2.6-5.7 6-5.7z' }]]
  };
  function Icon(props) {
    var parts = ICONS[props.name] || [];
    return h('svg', { className: cx('pi-icon', props.className), viewBox: '0 0 24 24', 'aria-hidden': props.label ? undefined : 'true', role: props.label ? 'img' : undefined, 'aria-label': props.label, style: props.size ? { width: props.size, height: props.size } : undefined },
      parts.map(function (p, i) { return h(p[0], Object.assign({ key: i }, p[1])); }));
  }
  Icon.names = Object.keys(ICONS);

  /* ---------- Button ---------- */
  function Button(props) {
    var variant = props.variant || 'secondary';
    return h('button', { type: props.type || 'button', disabled: props.disabled, onClick: props.onClick,
      className: cx('pi-btn', 'pi-btn-' + variant, props.block && 'pi-btn-block', props.className) },
      props.icon ? h(Icon, { name: props.icon }) : null, props.children);
  }

  /* ---------- Card ---------- */
  function Card(props) {
    return h('section', { className: cx('pi-card', props.elevated && 'pi-card-elevated', props.className) },
      props.title ? h('h2', { className: 'pi-card-title' }, props.title) : null,
      h('div', { className: 'pi-card-body' }, props.children));
  }

  /* ---------- Chip ---------- */
  function Chip(props) {
    var variant = props.variant || 'neutral';
    var icon = props.icon || (variant === 'alert' ? 'alert' : variant === 'selected' ? 'check' : null);
    return h('button', { type: 'button', onClick: props.onClick, 'aria-pressed': variant === 'selected' ? true : undefined,
      className: cx('pi-chip', 'pi-chip-' + variant, props.className) },
      icon ? h(Icon, { name: icon }) : null, props.children);
  }

  /* ---------- ListRow ---------- */
  function ListRow(props) {
    return h('button', { type: 'button', onClick: props.onClick, className: cx('pi-row', props.selected && 'pi-row-selected', props.className) },
      props.selected ? h(Icon, { name: 'check' }) : null,
      h('div', { className: 'pi-row-main' },
        h('p', { className: 'pi-row-title' }, props.title),
        props.subtitle ? h('p', { className: 'pi-row-sub' }, props.subtitle) : null),
      props.chip ? props.chip : null,
      props.value !== undefined ? h('span', { className: 'pi-row-value pi-num' }, props.value) : null,
      props.chevron === false ? null : h(Icon, { name: 'chevron-right', className: 'pi-row-chevron' }));
  }

  /* ---------- Header ---------- */
  function Header(props) {
    var status = props.status; // 'connected' | 'searching' | 'off' | undefined
    return h('header', { className: 'pi-header' },
      h('div', null,
        h('h1', { className: 'pi-header-title' }, props.title),
        (props.context || status) ? h('p', { className: 'pi-header-context' },
          status ? h('span', { className: cx('pi-dot', 'pi-dot-' + status), 'aria-hidden': 'true' }) : null,
          props.context) : null),
      props.action ? h('button', { type: 'button', className: 'pi-btn pi-btn-secondary', style: { height: 40, padding: '0 12px' }, onClick: props.onAction, 'aria-label': props.actionLabel }, h(Icon, { name: props.action })) : null);
  }

  /* ---------- StatusBanner ---------- */
  function StatusBanner(props) {
    var tone = props.tone || 'neutral';
    return h('div', { role: 'status', className: cx('pi-banner', 'pi-banner-' + tone, props.className) },
      h(Icon, { name: props.icon || (tone === 'alert' ? 'alert' : 'bluetooth') }),
      h('div', { className: 'pi-banner-text' }, props.children,
        props.detail ? h('span', { className: 'pi-banner-sub' }, props.detail) : null),
      props.actionLabel ? h('button', { type: 'button', className: 'pi-banner-action', onClick: props.onAction }, props.actionLabel) : null);
  }

  /* ---------- ValueCard ---------- */
  function ValueCard(props) {
    var empty = props.value === null || props.value === undefined;
    var text = empty ? 'Sin datos' : (typeof props.value === 'number' ? fmt(props.value) : props.value);
    return h('div', { className: cx('pi-value', props.size === 'xl' && 'pi-value-xl', props.stale && 'pi-value-stale', empty && 'pi-value-empty', props.live && 'pi-value-live', props.className) },
      h('p', { className: 'pi-value-label' }, props.label),
      h('div', { className: 'pi-value-main' },
        h('span', { className: 'pi-value-num pi-num', key: props.live ? String(props.value) : 'v' }, text),
        (!empty && props.unit) ? h('span', { className: 'pi-value-unit' }, props.unit) : null),
      (props.sub || props.stale) ? h('p', { className: 'pi-value-sub pi-num' }, props.stale ? 'desactualizado' + (props.sub ? ' · ' + props.sub : '') : props.sub) : null);
  }

  /* ---------- FootMap ---------- */
  var FOOT_D = 'M98 10C124 10 138 36 134 70 130 100 120 118 118 140 116 170 126 196 122 222 118 248 98 256 80 254 60 252 46 236 46 212 46 184 40 150 34 120 26 90 22 56 44 30 58 16 78 12 98 10Z';
  var MAX = 4095;
  var POINTS = { heel: { x: 84, y: 210, label: 'Talón', ly: 184, vy: 244 }, medial: { x: 104, y: 76, label: 'Medial', ly: 46, vy: 112 }, lateral: { x: 50, y: 72, label: 'Lateral', ly: 42, vy: 108 } };
  function Foot(props) {
    var right = props.side === 'right', v = props.values || {};
    var mx = function (x) { return right ? 150 - x : x; };
    return h('div', { className: cx('pi-foot', right ? 'pi-foot-right' : 'pi-foot-left', props.stale && 'pi-foot-stale') },
      h('span', { className: 'pi-foot-side' }, right ? 'Derecho' : 'Izquierdo'),
      h('svg', { viewBox: '0 0 150 260', role: 'img', 'aria-label': (right ? 'Pie derecho' : 'Pie izquierdo') + ': talón ' + fmt(v.heel) + ', medial ' + fmt(v.medial) + ', lateral ' + fmt(v.lateral) },
        h('path', { className: 'pi-foot-outline', d: FOOT_D, transform: right ? 'translate(150 0) scale(-1 1)' : undefined }),
        Object.keys(POINTS).map(function (k) {
          var p = POINTS[k], val = v[k], none = val === null || val === undefined;
          var t = none ? 0 : Math.max(0, Math.min(1, val / MAX));
          return h('g', { key: k, className: none ? 'pi-foot-none' : undefined },
            h('text', { className: 'pi-foot-name', x: mx(p.x), y: p.ly, textAnchor: 'middle' }, p.label),
            h('circle', { className: 'pi-foot-ring', cx: mx(p.x), cy: p.y, r: 6 + 10 * t }),
            h('circle', { className: 'pi-foot-point', cx: mx(p.x), cy: p.y, r: 5, opacity: none ? 0 : 0.25 + 0.75 * t }),
            h('text', { className: 'pi-foot-value', x: mx(p.x), y: p.vy, textAnchor: 'middle' }, none ? '—' : fmt(val)));
        })));
  }
  function FootMap(props) {
    var l = props.left || {}, r = props.right || {};
    var missing = ['heel', 'medial', 'lateral'].filter(function (k) { return l[k] == null; }).length + ['heel', 'medial', 'lateral'].filter(function (k) { return r[k] == null; }).length;
    return h('div', { className: props.className },
      h('div', { className: 'pi-feet' }, h(Foot, { side: 'left', values: l, stale: props.stale }), h(Foot, { side: 'right', values: r, stale: props.stale })),
      h('p', { className: 'pi-feet-caption' }, props.caption || ('cuentas ADC · 0–4095' + (props.stale ? ' · desactualizado' : '') + (missing ? ' · ' + missing + (missing === 1 ? ' posición sin datos' : ' posiciones sin datos') : ''))));
  }

  /* ---------- LineChart ---------- */
  function LineChart(props) {
    var W = props.width || 348, H = props.height || 120, padL = 44, padB = 20, padT = 8, padR = 4;
    var max = props.max || MAX, series = props.series || [];
    var n = Math.max.apply(null, series.map(function (s) { return s.values.length; }).concat([2]));
    var x = function (i) { return padL + (i / (n - 1)) * (W - padL - padR); };
    var y = function (v) { return padT + (1 - v / max) * (H - padT - padB); };
    var base = H - padB;
    var els = [];
    series.forEach(function (s, si) {
      var d = '', pen = false, gapStart = null;
      s.values.forEach(function (v, i) {
        if (v === null || v === undefined) { pen = false; if (gapStart === null) gapStart = i; return; }
        if (gapStart !== null) { els.push(h('line', { key: 'g' + si + '-' + i, className: 'pi-chart-gap', x1: x(Math.max(0, gapStart - 1)), x2: x(i), y1: base, y2: base })); gapStart = null; }
        d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true;
      });
      if (gapStart !== null) els.push(h('line', { key: 'g' + si + '-end', className: 'pi-chart-gap', x1: x(Math.max(0, gapStart - 1)), x2: x(n - 1), y1: base, y2: base }));
      els.push(h('path', { key: 'l' + si, className: cx('pi-chart-line', si === 1 && 'pi-chart-line-2', s.stale && 'pi-chart-line-stale'), d: d }));
    });
    var ticks = props.ticks || [{ at: 0, label: props.startLabel || '' }, { at: n - 1, label: props.endLabel || '' }];
    return h('div', { className: props.className },
      h('svg', { className: 'pi-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': props.label || 'Gráfico de línea' },
        h('line', { className: 'pi-chart-axis', x1: padL, x2: W - padR, y1: base, y2: base }),
        h('line', { className: 'pi-chart-axis', x1: padL, x2: padL, y1: padT, y2: base }),
        h('text', { className: 'pi-chart-tick pi-num', x: padL - 6, y: padT + 10, textAnchor: 'end' }, fmt(max)),
        h('text', { className: 'pi-chart-tick pi-num', x: padL - 6, y: base, textAnchor: 'end' }, '0'),
        ticks.map(function (t, i) { return h('text', { key: i, className: 'pi-chart-tick', x: x(t.at), y: H - 4, textAnchor: i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle' }, t.label); }),
        els),
      series.length > 1 || props.showLegend ? h('div', { className: 'pi-chart-legend' },
        series.map(function (s, i) { return h('span', { key: i }, h('i', { className: i === 1 ? 's2' : '' }), s.name); }),
        h('span', null, h('i', { className: 'gap' }), 'hueco')) : null);
  }

  var ns = window.Plantillas || (window.Plantillas = {});
  Object.assign(ns, { Button: Button, Card: Card, Chip: Chip, ListRow: ListRow, Header: Header, StatusBanner: StatusBanner, ValueCard: ValueCard, FootMap: FootMap, LineChart: LineChart, Icon: Icon, formatNumber: fmt });
})();
