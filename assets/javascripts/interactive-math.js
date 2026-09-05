function isChinesePage() {
  const lang = (document.documentElement && document.documentElement.lang)
    || (window.SITE_CONFIG && window.SITE_CONFIG.defaultLanguage)
    || 'zh';
  return lang.toLowerCase().startsWith('zh');
}

// Resolve this script's URL once so the (large) Plotly bundle can be fetched
// from the same vendor directory later, on demand.
var INTERACTIVE_SCRIPT_BASE = (function () {
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName('script');
    script = scripts[scripts.length - 1];
  }
  return String(script.src).replace(/interactive-math\.js.*$/, '');
})();

var plotlyLoadPromise = null;

function loadPlotlyScript() {
  return new Promise(function (resolve, reject) {
    var tag = document.createElement('script');
    tag.src = INTERACTIVE_SCRIPT_BASE + 'vendor/plotly/plotly-2.35.2.min.js';
    tag.async = true;
    tag.onload = function () { resolve(); };
    tag.onerror = function () {
      tag.remove();
      reject(new Error('Plotly failed to load'));
    };
    document.head.appendChild(tag);
  });
}

function ensurePlotly() {
  if (window.Plotly && typeof window.Plotly.react === 'function') {
    return Promise.resolve();
  }
  if (!plotlyLoadPromise) {
    // One automatic retry: large bundle over a flaky mobile link can drop.
    plotlyLoadPromise = loadPlotlyScript().catch(function () {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          loadPlotlyScript().then(resolve, reject);
        }, 1500);
      });
    });
    plotlyLoadPromise.catch(function () { plotlyLoadPromise = null; });
  }
  return plotlyLoadPromise;
}

function whenVisible(element, callback) {
  if (typeof IntersectionObserver === 'undefined') {
    callback();
    return;
  }
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          observer.disconnect();
          callback();
        }
      });
    },
    { rootMargin: '300px' }
  );
  observer.observe(element);
}

function reactPlot(plot, traces, layout) {
  if (!plot) return;
  plot.__plotlyPending = { traces: traces, layout: layout };
  if (!window.Plotly || typeof window.Plotly.react !== 'function') {
    if (!plot.textContent) {
      plot.textContent = isChinesePage() ? '交互图形加载中…' : 'Loading interactive figure…';
    }
    ensurePlotly()
      .then(function () {
        if (plot.__plotlyPending) {
          var pending = plot.__plotlyPending;
          plot.__plotlyPending = null;
          plot.textContent = '';
          reactPlot(plot, pending.traces, pending.layout);
        }
      })
      .catch(function () {
        plot.textContent = isChinesePage() ? '图形库加载失败，请刷新重试。' : 'Failed to load the plotting library; please refresh.';
      });
    return;
  }
  window.Plotly.react(plot, traces, layout, {
    responsive: true,
    displayModeBar: false
  });
}

function initializeInteractiveRoot(root, name) {
  if (!root || root.dataset.interactiveMathInitialized === name) return false;
  root.dataset.interactiveMathInitialized = name;
  return true;
}

function initQuadraticExplorer(root) {
  if (!initializeInteractiveRoot(root, 'quadratic')) return;
  const aInput = root.querySelector('[data-param="a"]');
  const bInput = root.querySelector('[data-param="b"]');
  const cInput = root.querySelector('[data-param="c"]');
  const formula = root.querySelector('[data-output="formula"]');
  const vertex = root.querySelector('[data-output="vertex"]');
  const plot = root.querySelector('[data-output="plot"]');
  if (!aInput || !bInput || !cInput || !formula || !vertex || !plot) return;

  function numberValue(input) {
    return Number.parseFloat(input.value);
  }

  function formatSigned(value) {
    if (value === 0) return '';
    return value > 0 ? `+ ${value}` : `- ${Math.abs(value)}`;
  }

  function render() {
    const a = numberValue(aInput);
    const b = numberValue(bInput);
    const c = numberValue(cInput);
    const xs = [];
    const ys = [];

    for (let i = -100; i <= 100; i += 1) {
      const x = i / 10;
      xs.push(x);
      ys.push(a * x * x + b * x + c);
    }

    formula.textContent = `f(x) = ${a}x² ${formatSigned(b)}x ${formatSigned(c)}`.replace(/\s+/g, ' ').trim();
    if (a === 0) {
      vertex.textContent = isChinesePage()
        ? '当 a = 0 时不是二次函数。'
        : 'When a = 0, the function is not quadratic.';
    } else {
      const vx = -b / (2 * a);
      const vy = a * vx * vx + b * vx + c;
      vertex.textContent = isChinesePage()
        ? `顶点约为 (${vx.toFixed(2)}, ${vy.toFixed(2)})。`
        : `Vertex: approximately (${vx.toFixed(2)}, ${vy.toFixed(2)}).`;
    }

    reactPlot(plot, [{
      x: xs,
      y: ys,
      mode: 'lines',
      line: { color: '#3f51b5', width: 3 },
      name: 'f(x)'
    }], {
      margin: { t: 20, r: 20, b: 40, l: 45 },
      xaxis: { title: 'x', zeroline: true },
      yaxis: { title: 'f(x)', zeroline: true },
      responsive: true
    });
  }

  [aInput, bInput, cInput].forEach((input) => {
    const valueLabel = root.querySelector(`[data-value="${input.dataset.param}"]`);
    input.addEventListener('input', () => {
      if (valueLabel) valueLabel.textContent = input.value;
      render();
    });
  });

  render();
}

function initDerivativeExplorer(root) {
  if (!initializeInteractiveRoot(root, 'derivative')) return;
  const hInput = root.querySelector('[data-param="h"]');
  const hValue = root.querySelector('[data-value="h"]');
  const slopeText = root.querySelector('[data-output="slope"]');
  const plot = root.querySelector('[data-output="plot"]');
  if (!hInput || !hValue || !slopeText || !plot) return;
  const pointX = 1;

  function f(x) {
    return x * x;
  }

  function render() {
    const h = Number.parseFloat(hInput.value);
    const secantSlope = (f(pointX + h) - f(pointX)) / h;
    const xs = [];
    const ys = [];
    for (let i = -40; i <= 60; i += 1) {
      const x = i / 10;
      xs.push(x);
      ys.push(f(x));
    }

    const secantXs = [pointX - 1, pointX + h + 1];
    const secantYs = secantXs.map((x) => f(pointX) + secantSlope * (x - pointX));

    hValue.textContent = h.toFixed(2);
    slopeText.textContent = isChinesePage()
      ? `割线斜率 = ${secantSlope.toFixed(4)}，当 h → 0 时趋近于导数 f'(1)=2。`
      : `Secant slope = ${secantSlope.toFixed(4)}; as h → 0 it approaches f'(1)=2.`;
    const secantName = isChinesePage() ? '割线' : 'Secant';
    const pointsName = isChinesePage() ? '取点' : 'Points';

    reactPlot(plot, [
      {
        x: xs,
        y: ys,
        mode: 'lines',
        line: { color: '#3f51b5', width: 3 },
        name: 'f(x)=x²'
      },
      {
        x: secantXs,
        y: secantYs,
        mode: 'lines',
        line: { color: '#e91e63', width: 2, dash: 'dash' },
        name: secantName
      },
      {
        x: [pointX, pointX + h],
        y: [f(pointX), f(pointX + h)],
        mode: 'markers',
        marker: { color: '#e91e63', size: 8 },
        name: pointsName
      }
    ], {
      margin: { t: 20, r: 20, b: 40, l: 45 },
      xaxis: { title: 'x', zeroline: true },
      yaxis: { title: 'y', zeroline: true },
      responsive: true
    });
  }

  hInput.addEventListener('input', render);
  render();
}

function initHelixExplorer(root) {
  if (!initializeInteractiveRoot(root, 'helix')) return;
  const aInput = root.querySelector('[data-param="a"]');
  const bInput = root.querySelector('[data-param="b"]');
  const curvature = root.querySelector('[data-output="curvature"]');
  const plot = root.querySelector('[data-output="plot"]');
  if (!aInput || !bInput || !curvature || !plot) return;

  function render() {
    const a = Number.parseFloat(aInput.value);
    const b = Number.parseFloat(bInput.value);
    const xs = [];
    const ys = [];
    const zs = [];

    for (let i = 0; i <= 240; i += 1) {
      const t = (6 * Math.PI * i) / 240;
      xs.push(a * Math.cos(t));
      ys.push(a * Math.sin(t));
      zs.push(b * t);
    }

    const denom = a * a + b * b;
    curvature.textContent = isChinesePage()
      ? `曲率 κ = ${(a / denom).toFixed(4)}，挠率 τ = ${(b / denom).toFixed(4)}`
      : `Curvature κ = ${(a / denom).toFixed(4)}, torsion τ = ${(b / denom).toFixed(4)}`;
    const aValue = root.querySelector('[data-value="a"]');
    const bValue = root.querySelector('[data-value="b"]');
    if (aValue) aValue.textContent = a.toFixed(2);
    if (bValue) bValue.textContent = b.toFixed(2);

    reactPlot(plot, [{
      type: 'scatter3d',
      x: xs,
      y: ys,
      z: zs,
      mode: 'lines',
      line: { color: '#3f51b5', width: 6 },
      name: isChinesePage() ? '螺旋线' : 'Helix'
    }], {
      margin: { t: 0, r: 0, b: 0, l: 0 },
      scene: {
        xaxis: { title: 'x' },
        yaxis: { title: 'y' },
        zaxis: { title: 'z' },
        aspectmode: 'cube'
      }
    });
  }

  [aInput, bInput].forEach((input) => input.addEventListener('input', render));
  render();
}

function finiteTopologySubsets(topology, pointCount) {
  const full = (1 << pointCount) - 1;
  if (topology === 'trivial') return [0, full];
  // On a finite set every complement is finite, so the cofinite topology is discrete.
  return Array.from({ length: full + 1 }, (_, mask) => mask);
}

function formatFiniteSet(mask, pointCount) {
  if (mask === 0) return '∅';
  const full = (1 << pointCount) - 1;
  if (mask === full) return 'X';
  const points = [];
  for (let i = 0; i < pointCount; i += 1) {
    if (mask & (1 << i)) points.push(`x${i + 1}`);
  }
  return `{${points.join(', ')}}`;
}

function checkFiniteTopology(openSets, pointCount) {
  const set = new Set(openSets);
  const full = (1 << pointCount) - 1;
  const containsEmptyAndWhole = set.has(0) && set.has(full);
  let closedUnderUnions = true;
  let closedUnderIntersections = true;
  for (let i = 0; i < openSets.length; i += 1) {
    for (let j = 0; j < openSets.length; j += 1) {
      if (!set.has(openSets[i] | openSets[j])) closedUnderUnions = false;
      if (!set.has(openSets[i] & openSets[j])) closedUnderIntersections = false;
    }
  }
  return { containsEmptyAndWhole, closedUnderUnions, closedUnderIntersections };
}

function initFiniteTopologyExplorer(root) {
  if (!initializeInteractiveRoot(root, 'finite-topology')) return;
  const topologyInput = root.querySelector('[data-param="topology"]');
  const pointsInput = root.querySelector('[data-param="points"]');
  const opens = root.querySelector('[data-output="opens"]');
  const axioms = root.querySelector('[data-output="axioms"]');
  if (!topologyInput || !pointsInput || !opens || !axioms) return;

  function render() {
    const pointCount = Number.parseInt(pointsInput.value, 10);
    const topology = topologyInput.value;
    const openSets = finiteTopologySubsets(topology, pointCount);
    const checks = checkFiniteTopology(openSets, pointCount);
    const pointSet = `{${Array.from({ length: pointCount }, (_, i) => `x${i + 1}`).join(', ')}}`;
    const openSetText = openSets.map((mask) => formatFiniteSet(mask, pointCount)).join(', ');
    const pointsValue = root.querySelector('[data-value="points"]');
    if (pointsValue) pointsValue.textContent = String(pointCount);

    if (isChinesePage()) {
      opens.textContent = `X = ${pointSet}；开集（${openSets.length} 个）：${openSetText}`;
      const cofiniteNote = topology === 'cofinite' ? '（有限集上有限补拓扑恰好等于离散拓扑）' : '';
      axioms.textContent = `拓扑公理：空集与全集 ${checks.containsEmptyAndWhole ? '✓' : '✗'}；任意并 ${checks.closedUnderUnions ? '✓' : '✗'}；有限交 ${checks.closedUnderIntersections ? '✓' : '✗'}。${cofiniteNote}`;
    } else {
      opens.textContent = `X = ${pointSet}; open sets (${openSets.length}): ${openSetText}`;
      const cofiniteNote = topology === 'cofinite' ? ' (on a finite set, the cofinite topology is exactly the discrete topology)' : '';
      axioms.textContent = `Topology axioms: ∅ and X ${checks.containsEmptyAndWhole ? '✓' : '✗'}; arbitrary unions ${checks.closedUnderUnions ? '✓' : '✗'}; finite intersections ${checks.closedUnderIntersections ? '✓' : '✗'}.${cofiniteNote}`;
    }
  }

  topologyInput.addEventListener('change', render);
  pointsInput.addEventListener('input', render);
  render();
}

function initProductBoxExplorer(root) {
  if (!initializeInteractiveRoot(root, 'product-box')) return;
  const coordinatesInput = root.querySelector('[data-param="coordinates"]');
  const comparison = root.querySelector('[data-output="comparison"]');
  const plot = root.querySelector('[data-output="plot"]');
  if (!coordinatesInput || !comparison || !plot) return;

  function render() {
    const coordinates = Number.parseInt(coordinatesInput.value, 10);
    const coordinatesValue = root.querySelector('[data-value="coordinates"]');
    if (coordinatesValue) coordinatesValue.textContent = String(coordinates);
    if (isChinesePage()) {
      comparison.textContent = `n = ${coordinates} 个坐标：乘积拓扑的柱集示例只限制 1 个坐标；箱拓扑的盒集示例可同时限制全部 ${coordinates} 个坐标。这里 n 有限，因此两种拓扑最终相同；真正的差异出现在无限乘积中。`;
    } else {
      comparison.textContent = `With n = ${coordinates} coordinates, an example product cylinder restricts 1 coordinate, while an example box restricts all ${coordinates}. Since n is finite here, the two topologies coincide; the distinction appears for infinite products.`;
    }

    const productName = isChinesePage() ? '乘积柱集（示例）' : 'Product cylinder (example)';
    const boxName = isChinesePage() ? '箱式盒集（示例）' : 'Box open box (example)';
    reactPlot(plot, [
      {
        type: 'bar',
        x: [isChinesePage() ? '示例基本开集' : 'Basic-open-set example'],
        y: [1],
        name: productName,
        marker: { color: '#3f51b5' }
      },
      {
        type: 'bar',
        x: [isChinesePage() ? '示例基本开集' : 'Basic-open-set example'],
        y: [coordinates],
        name: boxName,
        marker: { color: '#e91e63' }
      }
    ], {
      barmode: 'group',
      margin: { t: 30, r: 20, b: 65, l: 50 },
      yaxis: {
        title: isChinesePage() ? '被限制的坐标数' : 'Number of restricted coordinates',
        range: [0, Math.max(2, coordinates + 1)],
        dtick: 1
      },
      responsive: true
    });
  }

  coordinatesInput.addEventListener('input', render);
  render();
}

let topologyDiagramCounter = 0;

function quotientGluingSvg(gluing) {
  topologyDiagramCounter += 1;
  const markerId = `topology-glue-arrow-${topologyDiagramCounter}`;
  const isMobius = gluing === 'mobius';
  const hasVerticalPair = gluing === 'torus' || gluing === 'klein';
  const verticalReversed = gluing === 'klein';
  const horizontalLabel = isMobius ? 'left ↔ right (reverse)' : 'left ↔ right (same)';
  const verticalLabel = verticalReversed ? 'top ↔ bottom (reverse)' : 'top ↔ bottom (same)';
  const horizontalArrow = isMobius
    ? '<path d="M 23 125 C 8 105, 8 75, 23 55" class="topology-glue-arrow" marker-end="url(#' + markerId + ')"/><path d="M 237 55 C 252 75, 252 105, 237 125" class="topology-glue-arrow" marker-end="url(#' + markerId + ')"/>'
    : '<path d="M 23 55 C 8 75, 8 105, 23 125" class="topology-glue-arrow" marker-end="url(#' + markerId + ')"/><path d="M 237 125 C 252 105, 252 75, 237 55" class="topology-glue-arrow" marker-end="url(#' + markerId + ')"/>';
  const verticalArrow = verticalReversed
    ? '<path d="M 125 23 C 105 8, 75 8, 55 23" class="topology-glue-arrow" marker-end="url(#' + markerId + ')"/><path d="M 55 237 C 75 252, 105 252, 125 237" class="topology-glue-arrow" marker-end="url(#' + markerId + ')"/>'
    : '<path d="M 55 23 C 75 8, 105 8, 125 23" class="topology-glue-arrow" marker-end="url(#' + markerId + ')"/><path d="M 125 237 C 105 252, 75 252, 55 237" class="topology-glue-arrow" marker-end="url(#' + markerId + ')"/>';
  const verticalEdges = hasVerticalPair
    ? `<line x1="55" y1="35" x2="215" y2="35" class="topology-glue-edge topology-glue-edge-vertical"/><line x1="55" y1="215" x2="215" y2="215" class="topology-glue-edge topology-glue-edge-vertical"/>${verticalArrow}<text x="58" y="16" class="topology-glue-label">${verticalLabel}</text>`
    : '';
  const result = isChinesePage()
    ? ({
      cylinder: '圆柱面',
      mobius: 'Möbius 带',
      torus: '环面',
      klein: 'Klein 瓶'
    }[gluing] || '商空间')
    : ({
      cylinder: 'cylinder',
      mobius: 'Möbius strip',
      torus: 'torus',
      klein: 'Klein bottle'
    }[gluing] || 'quotient space');
  const resultLabel = isChinesePage() ? '得到：' : 'Result: ';

  return `<svg viewBox="0 0 420 270" role="img" aria-label="${result}" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
    <g class="topology-glue-square">
      <rect x="55" y="35" width="160" height="180" rx="2"/>
      <line x1="55" y1="35" x2="55" y2="215" class="topology-glue-edge topology-glue-edge-horizontal"/>
      <line x1="215" y1="35" x2="215" y2="215" class="topology-glue-edge topology-glue-edge-horizontal"/>
      ${verticalEdges}
      ${horizontalArrow}
      <text x="58" y="260" class="topology-glue-label">${horizontalLabel}</text>
    </g>
    <g class="topology-glue-result">
      <text x="285" y="108" class="topology-glue-result-label">${resultLabel}</text>
      <text x="285" y="137" class="topology-glue-result-name">${result}</text>
      <circle cx="340" cy="190" r="25"/><path d="M 315 190 C 315 160, 365 160, 365 190"/><path d="M 315 190 C 315 220, 365 220, 365 190"/>
    </g>
  </svg>`;
}

function initQuotientGluingExplorer(root) {
  if (!initializeInteractiveRoot(root, 'quotient-gluing')) return;
  const gluingInput = root.querySelector('[data-param="gluing"]');
  const description = root.querySelector('[data-output="description"]');
  const diagram = root.querySelector('[data-output="diagram"]');
  if (!gluingInput || !description || !diagram) return;

  function render() {
    const gluing = gluingInput.value;
    const descriptionsZh = {
      cylinder: '把正方形的左、右边同向识别，得到圆柱面；上下边仍是边界。',
      mobius: '把左、右边反向识别，得到 Möbius 带；一次绕行会反转横向方向。',
      torus: '把左、右边与上、下边都同向识别，得到环面；没有边界。',
      klein: '一组边同向、另一组边反向识别，得到 Klein 瓶；它不能嵌入三维欧氏空间而不自交。'
    };
    const descriptionsEn = {
      cylinder: 'Identify the left and right edges with the same orientation to obtain a cylinder; the horizontal edges remain boundary.',
      mobius: 'Identify the left and right edges with reversed orientation to obtain a Möbius strip; one circuit reverses the transverse direction.',
      torus: 'Identify both pairs of opposite edges with the same orientation to obtain a torus; it has no boundary.',
      klein: 'Identify one pair with the same orientation and the other with reversed orientation to obtain a Klein bottle; it cannot embed in 3-space without self-intersection.'
    };
    description.textContent = isChinesePage() ? descriptionsZh[gluing] : descriptionsEn[gluing];
    diagram.innerHTML = quotientGluingSvg(gluing);
  }

  gluingInput.addEventListener('change', render);
  render();
}

function initTopologistSineExplorer(root) {
  if (!initializeInteractiveRoot(root, 'topologist-sine')) return;
  const xminInput = root.querySelector('[data-param="xmin"]');
  const xminValue = root.querySelector('[data-value="xmin"]');
  const description = root.querySelector('[data-output="description"]');
  const plot = root.querySelector('[data-output="plot"]');
  if (!xminInput || !xminValue || !description || !plot) return;

  function render() {
    const xmin = Number.parseFloat(xminInput.value);
    const xs = [];
    const ys = [];
    const samples = 700;
    for (let i = 0; i <= samples; i += 1) {
      const x = xmin + ((1 - xmin) * i) / samples;
      xs.push(x);
      ys.push(Math.sin(1 / x));
    }
    xminValue.textContent = xmin.toFixed(2);
    description.textContent = isChinesePage()
      ? `显示 x ∈ [${xmin.toFixed(2)}, 1] 上的 y = sin(1/x)。虚线 x = 0 是闭包补上的竖直线段 {0}×[-1,1]；xmin 越小，振荡越密。`
      : `Showing y = sin(1/x) for x ∈ [${xmin.toFixed(2)}, 1]. The dashed x = 0 segment is the vertical line {0}×[-1,1] added in the closure; smaller xmin reveals denser oscillation.`;

    reactPlot(plot, [
      {
        x: xs,
        y: ys,
        mode: 'lines',
        line: { color: '#3f51b5', width: 2 },
        name: isChinesePage() ? '正弦曲线' : 'Sine graph'
      },
      {
        x: [0, 0],
        y: [-1, 1],
        mode: 'lines',
        line: { color: '#e91e63', width: 4, dash: 'dash' },
        name: isChinesePage() ? '闭包中的竖直段' : 'Vertical segment in closure'
      }
    ], {
      margin: { t: 25, r: 20, b: 45, l: 48 },
      xaxis: { title: 'x', range: [0, 1.02], zeroline: true },
      yaxis: { title: 'y', range: [-1.15, 1.15], zeroline: true },
      showlegend: true,
      responsive: true
    });
  }

  xminInput.addEventListener('input', render);
  render();
}

function initCoveringWindingExplorer(root) {
  if (!initializeInteractiveRoot(root, 'covering-winding')) return;
  const windingInput = root.querySelector('[data-param="winding"]');
  const windingValue = root.querySelector('[data-value="winding"]');
  const description = root.querySelector('[data-output="description"]');
  const plot = root.querySelector('[data-output="plot"]');
  if (!windingInput || !windingValue || !description || !plot) return;

  function render() {
    const winding = Number.parseInt(windingInput.value, 10);
    const circleX = [];
    const circleY = [];
    const baseX = [];
    const baseY = [];
    const liftX = [];
    const liftY = [];
    const steps = Math.max(180, Math.abs(winding) * 120);
    for (let i = 0; i <= steps; i += 1) {
      const unit = i / steps;
      const theta = 2 * Math.PI * unit;
      circleX.push(Math.cos(theta));
      circleY.push(Math.sin(theta));
      const liftedAngle = 2 * Math.PI * winding * unit;
      baseX.push(Math.cos(liftedAngle));
      baseY.push(Math.sin(liftedAngle));
      liftX.push(unit);
      liftY.push(liftedAngle);
    }
    const liftExtent = Math.max(Math.PI, Math.abs(winding) * 2 * Math.PI);
    windingValue.textContent = String(winding);
    description.textContent = isChinesePage()
      ? `绕数 w = ${winding}：提升路径的终点为 s(1) = ${winding}·2π = ${(winding * 2 * Math.PI).toFixed(2)}，而投影仍回到圆周基点 (1,0)。`
      : `Winding w = ${winding}: the lift ends at s(1) = ${winding}·2π = ${(winding * 2 * Math.PI).toFixed(2)}, while its projection returns to the base point (1,0).`;

    reactPlot(plot, [
      {
        x: circleX,
        y: circleY,
        mode: 'lines',
        line: { color: '#9e9e9e', width: 2 },
        name: isChinesePage() ? '圆周 S¹' : 'Circle S¹',
        xaxis: 'x',
        yaxis: 'y'
      },
      {
        x: baseX,
        y: baseY,
        mode: 'lines+markers',
        marker: { size: 3, color: '#e91e63' },
        line: { color: '#e91e63', width: 2 },
        name: isChinesePage() ? '投影路径' : 'Projected path',
        xaxis: 'x',
        yaxis: 'y'
      },
      {
        x: liftX,
        y: liftY,
        mode: 'lines+markers',
        marker: { size: 4, color: '#3f51b5' },
        line: { color: '#3f51b5', width: 3 },
        name: isChinesePage() ? '提升路径 s(t)' : 'Lift s(t)',
        xaxis: 'x2',
        yaxis: 'y2'
      }
    ], {
      margin: { t: 35, r: 20, b: 48, l: 48 },
      grid: { rows: 1, columns: 2, pattern: 'independent' },
      xaxis: {
        domain: [0, 0.43],
        range: [-1.25, 1.25],
        title: isChinesePage() ? '圆周' : 'Base circle',
        scaleanchor: 'y',
        scaleratio: 1
      },
      yaxis: { range: [-1.25, 1.25], title: 'y' },
      xaxis2: { domain: [0.57, 1], range: [0, 1], title: 't' },
      yaxis2: {
        range: [-liftExtent * 1.15, liftExtent * 1.15],
        title: isChinesePage() ? '提升坐标 s' : 'Lift coordinate s'
      },
      annotations: [
        { x: 0.215, y: 1.12, xref: 'paper', yref: 'paper', text: isChinesePage() ? '投影到 S¹' : 'Projection to S¹', showarrow: false },
        { x: 0.785, y: 1.12, xref: 'paper', yref: 'paper', text: isChinesePage() ? '覆盖空间 ℝ' : 'Cover ℝ', showarrow: false }
      ],
      showlegend: true,
      responsive: true
    });
  }

  windingInput.addEventListener('input', render);
  render();
}

function matrixRank(matrix) {
  if (!matrix.length || !matrix[0].length) return 0;
  const work = matrix.map((row) => row.slice());
  const rowCount = work.length;
  const columnCount = work[0].length;
  let rank = 0;
  for (let column = 0; column < columnCount && rank < rowCount; column += 1) {
    let pivot = rank;
    while (pivot < rowCount && Math.abs(work[pivot][column]) < 1e-9) pivot += 1;
    if (pivot === rowCount) continue;
    [work[rank], work[pivot]] = [work[pivot], work[rank]];
    const pivotValue = work[rank][column];
    for (let j = column; j < columnCount; j += 1) work[rank][j] /= pivotValue;
    for (let i = 0; i < rowCount; i += 1) {
      if (i === rank) continue;
      const factor = work[i][column];
      for (let j = column; j < columnCount; j += 1) work[i][j] -= factor * work[rank][j];
    }
    rank += 1;
  }
  return rank;
}

function formatMatrix(matrix) {
  if (!matrix.length || !matrix[0].length) return '[ ]';
  return `[${matrix.map((row) => `[${row.join(', ')}]`).join('; ')}]`;
}

function initSimplicialHomologyExplorer(root) {
  if (!initializeInteractiveRoot(root, 'simplicial-homology')) return;
  const complexInput = root.querySelector('[data-param="complex"]');
  const boundary = root.querySelector('[data-output="boundary"]');
  const betti = root.querySelector('[data-output="betti"]');
  const plot = root.querySelector('[data-output="plot"]');
  if (!complexInput || !boundary || !betti || !plot) return;

  function render() {
    const isDisk = complexInput.value === 'disk';
    const edges = [[0, 1], [1, 2], [0, 2]];
    const d1 = [
      [-1, 0, -1],
      [1, -1, 0],
      [0, 1, 1]
    ];
    const d2 = isDisk ? [[1], [1], [-1]] : [];
    const rankD1 = matrixRank(d1);
    const rankD2 = matrixRank(d2);
    const beta0 = 3 - rankD1;
    const beta1 = edges.length - rankD1 - rankD2;
    const beta2 = (isDisk ? 1 : 0) - rankD2;

    if (isChinesePage()) {
      boundary.textContent = `边界矩阵（边取向 01, 12, 02）：\n∂₁ = ${formatMatrix(d1)}\n∂₂ = ${formatMatrix(d2)}\n∂₁∂₂ = 0（边界的边界为零）`;
      betti.textContent = `Betti 数：β₀ = ${beta0}，β₁ = ${beta1}，β₂ = ${beta2}。${isDisk ? '实心三角形可缩，只有一个连通分支。' : '空心三角形保留一个一维洞。'}`;
    } else {
      boundary.textContent = `Boundary matrices (edge orientations 01, 12, 02):\n∂₁ = ${formatMatrix(d1)}\n∂₂ = ${formatMatrix(d2)}\n∂₁∂₂ = 0 (the boundary of a boundary is zero)`;
      betti.textContent = `Betti numbers: β₀ = ${beta0}, β₁ = ${beta1}, β₂ = ${beta2}. ${isDisk ? 'The filled triangle is contractible and has one component.' : 'The hollow triangle retains one one-dimensional hole.'}`;
    }

    const verticesX = [0, 1, 0.5];
    const verticesY = [0, 0, Math.sqrt(3) / 2];
    const traces = [];
    if (isDisk) {
      traces.push({
        x: [verticesX[0], verticesX[1], verticesX[2], verticesX[0]],
        y: [verticesY[0], verticesY[1], verticesY[2], verticesY[0]],
        mode: 'lines',
        fill: 'toself',
        fillcolor: 'rgba(63, 81, 181, 0.18)',
        line: { color: 'rgba(63, 81, 181, 0.45)', width: 1 },
        name: isChinesePage() ? '二维单形' : '2-simplex'
      });
    }
    traces.push({
      x: [verticesX[0], verticesX[1], verticesX[2], verticesX[0]],
      y: [verticesY[0], verticesY[1], verticesY[2], verticesY[0]],
      mode: 'lines+markers',
      marker: { color: '#e91e63', size: 9 },
      line: { color: '#3f51b5', width: 3 },
      text: ['v₀', 'v₁', 'v₂', 'v₀'],
      name: isChinesePage() ? '单纯复形' : 'Simplicial complex'
    });
    reactPlot(plot, traces, {
      margin: { t: 20, r: 20, b: 40, l: 45 },
      xaxis: { range: [-0.2, 1.2], visible: false, scaleanchor: 'y', scaleratio: 1 },
      yaxis: { range: [-0.2, 1.05], visible: false },
      showlegend: true,
      responsive: true
    });
  }

  complexInput.addEventListener('change', render);
  render();
}

if (typeof document$ !== 'undefined' && document$ && typeof document$.subscribe === 'function') {
  document$.subscribe(() => {
    // Pure-DOM components initialize immediately; components that need the
    // 4.6 MB Plotly bundle wait until their card approaches the viewport so
    // regular chapter pages stay lightweight.
    var initializers = {
      'quadratic-explorer': initQuadraticExplorer,
      'derivative-explorer': initDerivativeExplorer,
      'helix-explorer': initHelixExplorer,
      'finite-topology-explorer': initFiniteTopologyExplorer,
      'product-box-explorer': initProductBoxExplorer,
      'quotient-gluing-explorer': initQuotientGluingExplorer,
      'topologist-sine-explorer': initTopologistSineExplorer,
      'covering-winding-explorer': initCoveringWindingExplorer,
      'simplicial-homology-explorer': initSimplicialHomologyExplorer
    };
    Object.keys(initializers).forEach(function (name) {
      var roots = document.querySelectorAll('[data-component="' + name + '"]');
      roots.forEach(function (root) {
        if (root.dataset.interactiveMathInitialized) return;
        if (root.querySelector('[data-output="plot"]')) {
          whenVisible(root, function () { initializers[name](root); });
        } else {
          initializers[name](root);
        }
      });
    });
  });
}
