// SMC Viewer — Build Components Plugin
// Creates actual editable Figma nodes (Auto Layout, text, fills, etc.)

// ─── Design Tokens ───────────────────────────────────────────────────────────
// Dark mode — converted from globals.css OKLCH values
const T = {
  bg:           { r: 0.098, g: 0.098, b: 0.098 }, // oklch(0.145 0 0) ≈ #181818
  fg:           { r: 0.973, g: 0.973, b: 0.973 }, // oklch(0.985 0 0) ≈ #f8f8f8
  card:         { r: 0.149, g: 0.149, b: 0.149 }, // oklch(0.205 0 0) ≈ #262626
  cardFg:       { r: 0.973, g: 0.973, b: 0.973 },
  border:       { r: 1,     g: 1,     b: 1,     a: 0.10 }, // oklch(1 0 0 / 10%)
  muted:        { r: 0.196, g: 0.196, b: 0.196 }, // oklch(0.269 0 0) ≈ #323232
  mutedFg:      { r: 0.612, g: 0.612, b: 0.612 }, // oklch(0.708 0 0) ≈ #9c9c9c
  primary:      { r: 0.894, g: 0.894, b: 0.894 }, // oklch(0.922 0 0) ≈ #e4e4e4
  primaryFg:    { r: 0.149, g: 0.149, b: 0.149 },
  secondary:    { r: 0.196, g: 0.196, b: 0.196 },
  secondaryFg:  { r: 0.973, g: 0.973, b: 0.973 },
  accent:       { r: 0.196, g: 0.196, b: 0.196 },
  destructive:  { r: 0.918, g: 0.267, b: 0.267 }, // oklch(0.704 0.191 22.2)
  amber:        { r: 0.910, g: 0.647, b: 0.082 }, // amber-500
  amberBg:      { r: 0.910, g: 0.647, b: 0.082, a: 0.08 },
  emerald:      { r: 0.204, g: 0.839, b: 0.580 }, // emerald-400
  red:          { r: 0.937, g: 0.267, b: 0.267 },
  ring:         { r: 0.420, g: 0.420, b: 0.420 },
  // Nav drawer neon colors (dark mode)
  navBg:        { r: 0.055, g: 0.055, b: 0.137 }, // oklch(0.11 0.02 270) dark blue
  navBorder:    { r: 0.176, g: 0.761, b: 0.855 }, // oklch(0.7 0.2 195) cyan
  navActiveBg:  { r: 0.043, g: 0.200, b: 0.133, a: 0.5 }, // oklch(0.2 0.1 145 / 50%)
  navActiveBrd: { r: 0.176, g: 0.906, b: 0.565 }, // oklch(0.75 0.22 145) green
  navActiveText:{ r: 0.431, g: 0.949, b: 0.733 }, // oklch(0.85 0.16 175) teal
  navHoverBg:   { r: 0.310, g: 0.094, b: 0.310, a: 0.4 },
};

const RADIUS = 10; // --radius: 0.625rem ≈ 10px
const SCREEN_W = 1440;
const SCREEN_H = 900;
const SCREEN_GAP = 120;
const NAV_W = 240;
const FONT_SANS = "Inter"; // close to Geist Sans — Inter is available in Figma
const FONT_MONO = "Roboto Mono"; // close to Geist Mono

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rgb(c, a) {
  const base = { type: "SOLID", color: { r: c.r, g: c.g, b: c.b } };
  if (a !== undefined) base.opacity = a;
  else if (c.a !== undefined) base.opacity = c.a;
  return base;
}

function solidFill(c, opacity) {
  return [rgb(c, opacity)];
}

function stroke(c, weight = 1, opacity) {
  const s = rgb(c, opacity);
  return { strokes: [s], strokeWeight: weight, strokeAlign: "INSIDE" };
}

function setAutoLayout(node, opts = {}) {
  node.layoutMode = opts.direction || "VERTICAL";
  node.primaryAxisSizingMode = opts.primaryFix ? "FIXED" : "AUTO";
  node.counterAxisSizingMode = opts.counterFix ? "FIXED" : "AUTO";
  if (opts.gap !== undefined) node.itemSpacing = opts.gap;
  if (opts.paddingH !== undefined) { node.paddingLeft = opts.paddingH; node.paddingRight = opts.paddingH; }
  if (opts.paddingV !== undefined) { node.paddingTop = opts.paddingV; node.paddingBottom = opts.paddingV; }
  if (opts.paddingLeft !== undefined) node.paddingLeft = opts.paddingLeft;
  if (opts.paddingRight !== undefined) node.paddingRight = opts.paddingRight;
  if (opts.paddingTop !== undefined) node.paddingTop = opts.paddingTop;
  if (opts.paddingBottom !== undefined) node.paddingBottom = opts.paddingBottom;
  if (opts.align) node.primaryAxisAlignItems = opts.align;       // START, CENTER, END, SPACE_BETWEEN
  if (opts.crossAlign) node.counterAxisAlignItems = opts.crossAlign; // MIN, CENTER, MAX
  if (opts.wrap) node.layoutWrap = "WRAP";
}

async function makeText(content, opts = {}) {
  const t = figma.createText();
  const fontName = { family: opts.mono ? FONT_MONO : FONT_SANS, style: opts.weight || "Regular" };
  await figma.loadFontAsync(fontName);
  t.fontName = fontName;
  t.characters = content;
  t.fontSize = opts.size || 14;
  t.fills = solidFill(opts.color || T.fg);
  if (opts.opacity !== undefined) t.opacity = opts.opacity;
  if (opts.width) { t.textAutoResize = "HEIGHT"; t.resize(opts.width, 100); }
  else t.textAutoResize = "WIDTH_AND_HEIGHT";
  if (opts.lineHeight) t.lineHeight = { value: opts.lineHeight, unit: "PIXELS" };
  if (opts.letterSpacing) t.letterSpacing = { value: opts.letterSpacing, unit: "PERCENT" };
  if (opts.name) t.name = t.name = opts.name;
  return t;
}

function makeFrame(name, opts = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.fills = opts.fills !== undefined ? opts.fills : solidFill(opts.bg || T.bg);
  f.clipsContent = true;
  if (opts.cornerRadius !== undefined) f.cornerRadius = opts.cornerRadius;
  if (opts.w && opts.h) f.resize(opts.w, opts.h);
  return f;
}

function makeRect(name, opts = {}) {
  const r = figma.createRectangle();
  r.name = name;
  r.fills = opts.fills !== undefined ? opts.fills : solidFill(opts.bg || T.border);
  if (opts.cornerRadius !== undefined) r.cornerRadius = opts.cornerRadius;
  if (opts.w && opts.h) r.resize(opts.w, opts.h);
  if (opts.strokes) { r.strokes = opts.strokes; r.strokeWeight = opts.strokeWeight || 1; r.strokeAlign = "INSIDE"; }
  return r;
}

function progress(text, pct) {
  figma.ui.postMessage({ type: "progress", text, pct });
}

// ─── Design System Components ─────────────────────────────────────────────────

async function makeButton(label, variant = "default", small = false) {
  const frame = makeFrame("Button/" + variant, {
    bg: variant === "default" ? T.primary :
        variant === "outline" ? { r:0,g:0,b:0,a:0 } :
        variant === "secondary" ? T.secondary :
        variant === "ghost" ? { r:0,g:0,b:0,a:0 } :
        variant === "destructive" ? T.destructive : T.primary,
    cornerRadius: RADIUS,
    fills: variant === "outline" || variant === "ghost"
      ? [{ type: "SOLID", color: {r:0,g:0,b:0}, opacity: 0 }]
      : solidFill(variant === "default" ? T.primary : variant === "secondary" ? T.secondary : variant === "destructive" ? T.destructive : T.muted),
  });
  if (variant === "outline") {
    frame.strokes = [rgb(T.border)];
    frame.strokeWeight = 1;
    frame.strokeAlign = "INSIDE";
  }
  setAutoLayout(frame, { direction: "HORIZONTAL", gap: 6, paddingH: small ? 12 : 16, paddingV: small ? 6 : 9, align: "CENTER", crossAlign: "CENTER", primaryFix: false, counterFix: false });
  const textColor = variant === "default" ? T.primaryFg : variant === "destructive" ? T.fg : T.fg;
  const t = await makeText(label, { size: small ? 12 : 14, weight: "Medium", color: textColor });
  frame.appendChild(t);
  return frame;
}

async function makeBadge(label, color) {
  const f = makeFrame("Badge", { bg: color || T.muted, cornerRadius: 9999, fills: solidFill(color || T.muted, 0.15) });
  setAutoLayout(f, { direction: "HORIZONTAL", paddingH: 8, paddingV: 2, align: "CENTER", crossAlign: "CENTER" });
  const t = await makeText(label, { size: 11, weight: "Medium", color: color || T.mutedFg });
  f.appendChild(t);
  return f;
}

async function makeSectionCard(title, subtitleOrLines, includeActions = []) {
  const frame = makeFrame("SectionCard", { bg: T.card, cornerRadius: RADIUS });
  frame.strokes = [rgb(T.border)];
  frame.strokeWeight = 1;
  frame.strokeAlign = "INSIDE";
  setAutoLayout(frame, { direction: "VERTICAL", gap: 12, paddingH: 20, paddingV: 20, counterFix: false });

  const titleText = await makeText(title, { size: 15, weight: "SemiBold", color: T.fg });
  frame.appendChild(titleText);

  if (typeof subtitleOrLines === "string") {
    const sub = await makeText(subtitleOrLines, { size: 13, color: T.mutedFg, width: 640 });
    frame.appendChild(sub);
  } else if (Array.isArray(subtitleOrLines)) {
    for (const line of subtitleOrLines) {
      const li = await makeText("• " + line, { size: 13, color: T.mutedFg, width: 640 });
      frame.appendChild(li);
    }
  }

  for (const [label, variant] of includeActions) {
    const btn = await makeButton(label, variant || "outline", true);
    frame.appendChild(btn);
  }

  return frame;
}

async function makeCodeBlock(content, monospace = true) {
  const f = makeFrame("CodeBlock", { bg: T.muted, cornerRadius: 6 });
  f.strokes = [rgb(T.border)];
  f.strokeWeight = 1;
  f.strokeAlign = "INSIDE";
  setAutoLayout(f, { paddingH: 16, paddingV: 12 });
  const t = await makeText(content, { size: 12, mono: monospace, color: T.fg, width: 600 });
  f.appendChild(t);
  return f;
}

async function makeTabBar(tabs, activeIndex = 0) {
  const bar = makeFrame("TabBar", { fills: [{ type: "SOLID", color: {r:0,g:0,b:0}, opacity: 0 }] });
  bar.strokes = [{ type: "SOLID", color: T.border.r ? T.border : {r:1,g:1,b:1} }];
  bar.strokeWeight = 1;
  bar.strokeAlign = "INSIDE";
  setAutoLayout(bar, { direction: "HORIZONTAL", gap: 0, paddingH: 0, paddingV: 0, counterFix: false });
  for (let i = 0; i < tabs.length; i++) {
    const tab = makeFrame("Tab/" + tabs[i], { fills: [{ type: "SOLID", color: {r:0,g:0,b:0}, opacity: 0 }] });
    setAutoLayout(tab, { direction: "HORIZONTAL", paddingH: 16, paddingV: 12, align: "CENTER", crossAlign: "CENTER" });
    const isActive = i === activeIndex;
    if (isActive) {
      tab.strokes = [{ type: "SOLID", color: T.primary }];
      tab.strokeWeight = 2;
      tab.strokeAlign = "INSIDE";
      tab.strokeTopWeight = 0; tab.strokeLeftWeight = 0; tab.strokeRightWeight = 0;
    }
    const t = await makeText(tabs[i], { size: 14, weight: isActive ? "Medium" : "Regular", color: isActive ? T.fg : T.mutedFg });
    tab.appendChild(t);
    bar.appendChild(tab);
  }
  return bar;
}

async function makeTableRow(cells, isHeader = false) {
  const row = makeFrame(isHeader ? "TableHeaderRow" : "TableRow", {
    bg: isHeader ? T.muted : { r:0,g:0,b:0,a:0 },
    fills: isHeader ? solidFill(T.muted, 0.3) : [{ type:"SOLID", color:{r:0,g:0,b:0}, opacity: 0 }],
  });
  row.strokes = [rgb(T.border)];
  row.strokeWeight = 1;
  row.strokeAlign = "INSIDE";
  row.strokeTopWeight = 0; row.strokeLeftWeight = 0; row.strokeRightWeight = 0;
  setAutoLayout(row, { direction: "HORIZONTAL", gap: 0, paddingH: 0, paddingV: 0, counterFix: false });
  for (const [text, colW] of cells) {
    const cell = makeFrame("Cell", { fills: [{ type:"SOLID", color:{r:0,g:0,b:0}, opacity: 0 }] });
    setAutoLayout(cell, { paddingH: 16, paddingV: 10, counterFix: false });
    cell.primaryAxisSizingMode = "FIXED";
    cell.resize(colW || 180, 40);
    const t = await makeText(text, { size: 13, weight: isHeader ? "Medium" : "Regular", color: isHeader ? T.mutedFg : T.fg });
    cell.appendChild(t);
    row.appendChild(cell);
  }
  return row;
}

async function makeCheckItem(label, checked = false) {
  const row = makeFrame("CheckItem", { fills: [{ type:"SOLID", color:{r:0,g:0,b:0}, opacity: 0 }] });
  setAutoLayout(row, { direction: "HORIZONTAL", gap: 10, paddingH: 0, paddingV: 4, crossAlign: "CENTER" });
  // Checkbox box
  const box = makeRect("Checkbox", {
    bg: checked ? T.primary : { r:0,g:0,b:0,a:0 },
    fills: checked ? solidFill(T.primary) : [{ type:"SOLID", color:{r:0,g:0,b:0}, opacity: 0 }],
    cornerRadius: 3,
    w: 14,
    h: 14,
    strokes: [rgb(T.border)],
    strokeWeight: 1,
  });
  row.appendChild(box);
  const t = await makeText(label, { size: 13, color: T.fg });
  row.appendChild(t);
  return row;
}

async function makeInput(placeholder, w = 300) {
  const f = makeFrame("Input", { bg: { r:0,g:0,b:0,a:0 }, fills: [{ type:"SOLID", color:{r:0,g:0,b:0}, opacity: 0 }], cornerRadius: 6 });
  f.strokes = [rgb(T.border)];
  f.strokeWeight = 1;
  f.strokeAlign = "INSIDE";
  setAutoLayout(f, { paddingH: 12, paddingV: 8 });
  f.primaryAxisSizingMode = "FIXED";
  f.resize(w, 36);
  const t = await makeText(placeholder, { size: 13, color: T.mutedFg });
  f.appendChild(t);
  return f;
}

async function makeTextarea(placeholder, w = 600, minH = 80) {
  const f = makeFrame("Textarea", { bg: { r:0,g:0,b:0,a:0 }, fills: [{ type:"SOLID", color:{r:0,g:0,b:0}, opacity:0 }], cornerRadius: 6 });
  f.strokes = [rgb(T.border)];
  f.strokeWeight = 1;
  f.strokeAlign = "INSIDE";
  setAutoLayout(f, { paddingH: 12, paddingV: 8 });
  f.primaryAxisSizingMode = "FIXED";
  f.resize(w, minH);
  const t = await makeText(placeholder, { size: 12, color: T.mutedFg });
  f.appendChild(t);
  return f;
}

async function makeNavDrawer(activePath = "/smc-viewer") {
  const drawer = makeFrame("NavDrawer", { bg: T.navBg, w: NAV_W, h: SCREEN_H });
  drawer.strokes = [{ type:"SOLID", color: T.navBorder }];
  drawer.strokeWeight = 1;
  drawer.strokeAlign = "INSIDE";
  drawer.strokeTopWeight = 0; drawer.strokeBottomWeight = 0; drawer.strokeLeftWeight = 0;
  setAutoLayout(drawer, { direction: "VERTICAL", gap: 0, counterFix: true, primaryFix: true });

  // Close row
  const closeRow = makeFrame("CloseRow", { fills: [{ type:"SOLID", color:{r:0,g:0,b:0}, opacity:0 }] });
  closeRow.strokes = [{ type:"SOLID", color: T.navBorder, opacity: 0.3 }];
  closeRow.strokeWeight = 1;
  closeRow.strokeAlign = "INSIDE";
  closeRow.strokeTopWeight = 0; closeRow.strokeLeftWeight = 0; closeRow.strokeRightWeight = 0;
  setAutoLayout(closeRow, { direction: "HORIZONTAL", align: "END", crossAlign: "CENTER", paddingH: 8, paddingV: 8, counterFix: true });
  closeRow.primaryAxisSizingMode = "FIXED";
  closeRow.resize(NAV_W, 44);
  const xBtn = makeFrame("CloseBtn", { bg: { r:0,g:0,b:0,a:0 }, fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}], cornerRadius: 6, w:32, h:32 });
  setAutoLayout(xBtn, { align:"CENTER", crossAlign:"CENTER" });
  const xT = await makeText("✕", { size: 14, color: T.navActiveText });
  xBtn.appendChild(xT);
  closeRow.appendChild(xBtn);
  drawer.appendChild(closeRow);

  // Nav sections
  const sections = [
    { label: "Main", links: [
      { label: "Chart", desc: "SMC animation viewer", href: "/smc-viewer" },
      { label: "Multi-TF analysis", desc: "Open bottom drawer for all timeframes", href: "/smc-viewer?open=all-timeframes" },
    ]},
    { label: "Engine 2", links: [
      { label: "Reference", desc: "Logic reference", href: "/engine2?tab=reference" },
      { label: "Diagnostics", desc: "Run diagnostics", href: "/engine2?tab=diagnostics" },
      { label: "Evaluate", desc: "Evaluate runs", href: "/engine2?tab=evaluate" },
      { label: "Tune", desc: "Calibration", href: "/engine2?tab=tune" },
    ]},
    { label: "Settings", links: [
      { label: "Indicators", desc: "Show/hide chart indicators", href: "#" },
      { label: "Square chart", desc: "Set Y-axis swing range", href: "#" },
    ]},
  ];

  for (const section of sections) {
    // Section header
    const secHeader = makeFrame("SectionHeader/" + section.label, { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
    secHeader.primaryAxisSizingMode = "FIXED";
    secHeader.resize(NAV_W, 40);
    setAutoLayout(secHeader, { direction:"HORIZONTAL", paddingH:8, paddingV:8, crossAlign:"CENTER", gap:4, counterFix:true });
    const secT = await makeText(section.label, { size:13, weight:"Medium", color: T.navActiveText });
    secHeader.appendChild(secT);
    drawer.appendChild(secHeader);

    // Links
    for (const link of section.links) {
      const isActive = activePath === link.href || activePath.startsWith(link.href.split("?")[0]);
      const linkFrame = makeFrame("NavLink/" + link.label, {
        fills: isActive ? solidFill(T.navActiveBg, 0.5) : [{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}],
        cornerRadius: 6,
      });
      if (isActive) {
        linkFrame.strokes = [{ type:"SOLID", color: T.navActiveBrd }];
        linkFrame.strokeWeight = 2;
        linkFrame.strokeAlign = "INSIDE";
        linkFrame.strokeTopWeight = 0; linkFrame.strokeBottomWeight = 0; linkFrame.strokeRightWeight = 0;
      }
      linkFrame.primaryAxisSizingMode = "FIXED";
      linkFrame.resize(NAV_W - 16, 48);
      setAutoLayout(linkFrame, { direction:"VERTICAL", gap:2, paddingH:8, paddingV:6, counterFix:true });
      const labelT = await makeText(link.label, { size:13, weight:"Medium", color: isActive ? T.navActiveText : T.fg });
      const descT = await makeText(link.desc, { size:11, color: isActive ? T.navActiveText : T.mutedFg, opacity: isActive ? 0.85 : 0.7 });
      linkFrame.appendChild(labelT);
      linkFrame.appendChild(descT);

      const wrapper = makeFrame("NavLinkWrapper", { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
      wrapper.primaryAxisSizingMode = "FIXED";
      wrapper.resize(NAV_W, 52);
      setAutoLayout(wrapper, { paddingH:8, paddingV:2, counterFix:true });
      wrapper.appendChild(linkFrame);
      drawer.appendChild(wrapper);
    }
  }

  return drawer;
}

async function makePageShell(name, activeNav, contentBuilder) {
  const screen = makeFrame(name, { bg: T.bg, w: SCREEN_W, h: SCREEN_H });
  screen.clipsContent = true;
  setAutoLayout(screen, { direction: "HORIZONTAL", gap: 0, counterFix: true, primaryFix: true });

  const nav = await makeNavDrawer(activeNav);
  nav.primaryAxisSizingMode = "FIXED";
  nav.resize(NAV_W, SCREEN_H);
  screen.appendChild(nav);

  const content = await contentBuilder(SCREEN_W - NAV_W);
  content.primaryAxisSizingMode = "FIXED";
  content.counterAxisSizingMode = "FIXED";
  content.resize(SCREEN_W - NAV_W, SCREEN_H);
  screen.appendChild(content);

  return screen;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Home Page ────────────────────────────────────────────────────────────
async function buildHome(contentW) {
  const content = makeFrame("HomeContent", { bg: T.bg });
  setAutoLayout(content, { direction: "VERTICAL", align: "CENTER", crossAlign: "CENTER", gap: 24, paddingH: 32, paddingV: 32, counterFix: true });

  const title = await makeText("SMC Viewer", { size: 28, weight: "SemiBold", color: T.fg });
  const sub = await makeText("Chart animation and Engine 2 diagnostics. Use the nav on the left to open the chart or any Engine 2 page.", { size: 14, color: T.mutedFg, width: 420 });

  const btnRow = makeFrame("ButtonRow", { fills: [{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
  setAutoLayout(btnRow, { direction:"HORIZONTAL", gap:12, align:"CENTER", crossAlign:"CENTER" });
  const btn1 = await makeButton("Open chart", "outline");
  const btn2 = await makeButton("Engine 2 diagnostic flow", "outline");
  btnRow.appendChild(btn1);
  btnRow.appendChild(btn2);

  content.appendChild(title);
  content.appendChild(sub);
  content.appendChild(btnRow);
  return content;
}

// ─── 2. SMC Viewer / Chart Page ─────────────────────────────────────────────
async function buildSmcViewer(contentW) {
  const content = makeFrame("ChartContent", { bg: T.bg });
  setAutoLayout(content, { direction: "VERTICAL", gap: 0, counterFix: true });

  // Top toolbar ribbon (collapsed state - just the π tab)
  const topRibbon = makeFrame("TopRibbon", { bg: { r: 0.1, g: 0.07, b: 0.2 }, w: contentW, h: 32 });
  const piBtn = makeFrame("PiButton", { bg: { r: 0.15, g: 0.08, b: 0.28 }, cornerRadius: 6, w: 32, h: 32 });
  setAutoLayout(piBtn, { align: "CENTER", crossAlign: "CENTER" });
  const piT = await makeText("π", { size: 16, weight: "Medium", color: { r: 0.85, g: 0.6, b: 1.0 } });
  piBtn.appendChild(piT);
  topRibbon.appendChild(piBtn);
  piBtn.x = (contentW - 32) / 2;
  content.appendChild(topRibbon);

  // Main chart area
  const chartArea = makeFrame("ChartArea", { bg: T.bg, cornerRadius: 0 });
  chartArea.primaryAxisSizingMode = "FIXED";
  chartArea.counterAxisSizingMode = "FIXED";
  chartArea.resize(contentW, SCREEN_H - 32 - 80);
  setAutoLayout(chartArea, { direction: "VERTICAL", gap: 16, paddingH: 16, paddingV: 16, counterFix: true, primaryFix: true });

  // Chart placeholder card
  const chartCard = makeFrame("ChartCard", { bg: T.card, cornerRadius: RADIUS });
  chartCard.strokes = [rgb(T.border)];
  chartCard.strokeWeight = 2;
  chartCard.strokeAlign = "INSIDE";
  chartCard.primaryAxisSizingMode = "FIXED";
  chartCard.counterAxisSizingMode = "FIXED";
  chartCard.resize(contentW - 32, SCREEN_H - 32 - 80 - 32);
  setAutoLayout(chartCard, { direction:"VERTICAL", align:"CENTER", crossAlign:"CENTER", gap:8 });

  const chartLabel = await makeText("SMC Candlestick Chart", { size: 16, weight: "Medium", color: T.mutedFg });
  const chartSub = await makeText("Plotly chart with CHoCH, BOS, order blocks, FVG, and wave state overlays", { size: 12, color: T.mutedFg });
  chartCard.appendChild(chartLabel);
  chartCard.appendChild(chartSub);

  // Left alignment panel preview (small floating card)
  const alignCard = makeFrame("AlignmentPanel", { bg: T.card, cornerRadius: RADIUS });
  alignCard.strokes = [rgb(T.border)];
  alignCard.strokeWeight = 1;
  alignCard.strokeAlign = "INSIDE";
  alignCard.resize(255, 142);
  setAutoLayout(alignCard, { direction:"VERTICAL", gap:8, paddingH:8, paddingV:8, counterFix:true, primaryFix:true });
  const alignTitle = await makeText("Alignment", { size:11, weight:"SemiBold", color: T.mutedFg });
  const alignRows = [
    ["Stack aligned", T.emerald],
    ["Trend: BULLISH", T.fg],
    ["Confidence: MEDIUM", T.amber],
    ["Bias: CONTINUATION", T.fg],
  ];
  for (const [label, color] of alignRows) {
    const row = makeFrame("AlignRow", { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
    setAutoLayout(row, { direction:"HORIZONTAL", gap:6, crossAlign:"CENTER" });
    const dot = makeRect("Dot", { bg: color, cornerRadius: 9999, w:6, h:6 });
    const rt = await makeText(label, { size:11, color: T.fg });
    row.appendChild(dot);
    row.appendChild(rt);
    alignCard.appendChild(row);
  }
  chartCard.appendChild(alignTitle);
  chartCard.appendChild(alignCard);

  chartArea.appendChild(chartCard);
  content.appendChild(chartArea);

  // Playback bar
  const playbar = makeFrame("PlaybackBar", { bg: T.card, w: contentW, h: 80 });
  playbar.strokes = [rgb(T.border)];
  playbar.strokeWeight = 1;
  playbar.strokeAlign = "INSIDE";
  playbar.strokeBottomWeight = 0; playbar.strokeLeftWeight = 0; playbar.strokeRightWeight = 0;
  setAutoLayout(playbar, { direction:"HORIZONTAL", gap:12, paddingH:16, paddingV:0, align:"CENTER", crossAlign:"CENTER", counterFix:true });
  playbar.primaryAxisSizingMode = "FIXED";
  playbar.resize(contentW, 80);

  const controls = ["⏮", "⏪", "▶", "⏩", "⏭"];
  for (const c of controls) {
    const btn = makeFrame("Ctrl", { bg:{r:0,g:0,b:0,a:0}, fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}], cornerRadius:6, w:36, h:36 });
    setAutoLayout(btn, { align:"CENTER", crossAlign:"CENTER" });
    const ct = await makeText(c, { size:16, color: T.fg });
    btn.appendChild(ct);
    playbar.appendChild(btn);
  }
  const speedLabel = await makeText("1×", { size:13, color: T.mutedFg });
  playbar.appendChild(speedLabel);

  // Progress bar
  const track = makeRect("TrackBg", { bg: T.muted, cornerRadius: 3, w: contentW - 250, h: 4 });
  const fill = makeRect("TrackFill", { bg: T.primary, cornerRadius: 3, w: (contentW - 250) * 0.35, h: 4 });
  const trackF = makeFrame("Track", { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}], w: contentW - 250, h:20 });
  setAutoLayout(trackF, { direction:"VERTICAL", align:"CENTER", crossAlign:"CENTER" });
  trackF.appendChild(track);
  trackF.appendChild(fill);
  fill.x = 0; fill.y = 0;
  playbar.appendChild(trackF);

  // Bottom bee tab
  const beeBtn = makeFrame("BeeTab", { bg: {r:0.12,g:0.1,b:0.04}, cornerRadius: 6, w:32, h:32 });
  setAutoLayout(beeBtn, { align:"CENTER", crossAlign:"CENTER" });
  const beeT = await makeText("⬡", { size:18, color: { r:0.85,g:0.72,b:0.2 } });
  beeBtn.appendChild(beeT);
  playbar.appendChild(beeBtn);

  content.appendChild(playbar);
  return content;
}

// ─── 3. Engine 2 Hub ─────────────────────────────────────────────────────────
async function buildEngine2Hub(contentW, activeTab = "reference") {
  const content = makeFrame("Engine2HubContent", { bg: T.bg });
  setAutoLayout(content, { direction: "VERTICAL", gap: 0, counterFix: true });

  // Sticky header
  const header = makeFrame("Header", { bg: T.bg, w: contentW, h: 100 });
  header.strokes = [rgb(T.border)];
  header.strokeWeight = 1;
  header.strokeAlign = "INSIDE";
  header.strokeTopWeight = 0; header.strokeLeftWeight = 0; header.strokeRightWeight = 0;
  setAutoLayout(header, { direction: "VERTICAL", gap: 12, paddingH: 16, paddingV: 16, counterFix: true });
  const h1 = await makeText("Engine 2", { size: 18, weight: "SemiBold", color: T.fg });
  const h1sub = await makeText("Engine → Interpretation → Diagnostics → Calibration. Reference, run diagnostics, evaluate, and tune.", { size: 13, color: T.mutedFg, width: contentW - 32 });
  header.appendChild(h1);
  header.appendChild(h1sub);

  // Tab bar
  const tabs = ["Reference", "Diagnostics", "Evaluate", "Tune"];
  const activeIdx = tabs.findIndex(t => t.toLowerCase() === activeTab);
  const tabBar = await makeTabBar(tabs, activeIdx >= 0 ? activeIdx : 0);
  tabBar.primaryAxisSizingMode = "FIXED";
  tabBar.resize(contentW, 44);
  header.appendChild(tabBar);
  content.appendChild(header);

  // Tab content area
  const tabContent = makeFrame("TabContent", { bg: T.bg });
  tabContent.primaryAxisSizingMode = "FIXED";
  tabContent.counterAxisSizingMode = "FIXED";
  tabContent.resize(contentW, SCREEN_H - 100);
  setAutoLayout(tabContent, { direction: "VERTICAL", gap: 20, paddingH: 16, paddingV: 20, counterFix: true, primaryFix: true });
  tabContent.clipsContent = true;

  if (activeTab === "reference") {
    const s1 = await makeSectionCard(
      "Engine 2 decision flow (order of evaluation)",
      ["Compute alignment_score", "Classify STRONG / MODERATE / WEAK / DISALIGNED", "Evaluate stack", "Assign confidence (HIGH / MEDIUM / LOW)", "Evaluate wave + momentum for bias", "Evaluate divergence for warnings"]
    );
    s1.primaryAxisSizingMode = "FIXED"; s1.resize(contentW - 32, 180);
    tabContent.appendChild(s1);

    const s2 = await makeSectionCard("alignment_score formula", "weighted sum of wave_direction consistency across timeframes");
    const code = await makeCodeBlock("alignment_score = Σ(weight_i × direction_match_i)
upper_tf_weight: 0.4  |  mid_tf_weight: 0.35  |  lower_tf_weight: 0.25");
    s2.appendChild(code);
    s2.primaryAxisSizingMode = "FIXED"; s2.resize(contentW - 32, 160);
    tabContent.appendChild(s2);

    const s3 = await makeSectionCard("Step 1 — Alignment classification",
      ["alignment_score ≥ 0.75 → STRONG", "alignment_score ≥ 0.55 → MODERATE", "alignment_score ≥ 0.30 → WEAK", "else → DISALIGNED"]);
    s3.primaryAxisSizingMode = "FIXED"; s3.resize(contentW - 32, 160);
    tabContent.appendChild(s3);

  } else if (activeTab === "diagnostics") {
    const note = await makeText("Select a symbol and timeframe to run diagnostics. Results appear as a distribution grid.", { size: 13, color: T.mutedFg, width: contentW - 32 });
    tabContent.appendChild(note);

    // Diagnostics grid placeholder
    const grid = makeFrame("DiagnosticsGrid", { bg: T.card, cornerRadius: RADIUS });
    grid.strokes = [rgb(T.border)];
    grid.strokeWeight = 1;
    grid.strokeAlign = "INSIDE";
    grid.primaryAxisSizingMode = "FIXED";
    grid.resize(contentW - 32, 320);
    setAutoLayout(grid, { direction:"VERTICAL", gap:0, counterFix:true, primaryFix:true });

    const headerRow = await makeTableRow([["TF", 80], ["STRONG", 120], ["MODERATE", 120], ["WEAK", 120], ["DISALIGNED", 120], ["HIGH conf", 120], ["LOW conf", 120]], true);
    grid.appendChild(headerRow);
    const tfs = ["1M", "1W", "1D", "360", "90", "23"];
    for (const tf of tfs) {
      const dataRow = await makeTableRow([[tf, 80], ["0%", 120], ["8%", 120], ["74%", 120], ["18%", 120], ["0%", 120], ["100%", 120]]);
      grid.appendChild(dataRow);
    }
    tabContent.appendChild(grid);

    const btnRow = makeFrame("ActionRow", { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
    setAutoLayout(btnRow, { direction:"HORIZONTAL", gap:8 });
    btnRow.appendChild(await makeButton("Run diagnostics", "default", true));
    btnRow.appendChild(await makeButton("Export grid as Markdown", "outline", true));
    tabContent.appendChild(btnRow);

  } else if (activeTab === "evaluate") {
    const versionRow = makeFrame("VersionRow", { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
    setAutoLayout(versionRow, { direction:"HORIZONTAL", gap:12, crossAlign:"CENTER" });
    const verLabel = await makeText("Logic in use: Default · Tune", { size:13, color: T.mutedFg });
    versionRow.appendChild(verLabel);
    versionRow.appendChild(await makeButton("Load first analysis (KCEX_ETHUSDT.P)", "secondary", true));
    tabContent.appendChild(versionRow);

    // Diagnostic markdown textarea
    const textAreaLabel = await makeText("Engine 2 diagnostic markdown", { size:14, weight:"Medium", color:T.fg });
    tabContent.appendChild(textAreaLabel);
    const ta = await makeTextarea("Paste diagnostic markdown here…", contentW - 32, 100);
    tabContent.appendChild(ta);

    // Section 1
    const s1 = makeFrame("Section1Card", { bg:T.card, cornerRadius:RADIUS });
    s1.strokes = [rgb(T.border)]; s1.strokeWeight = 1; s1.strokeAlign = "INSIDE";
    s1.primaryAxisSizingMode = "FIXED"; s1.resize(contentW - 32, 200);
    setAutoLayout(s1, { direction:"VERTICAL", gap:10, paddingH:20, paddingV:20, counterFix:true, primaryFix:true });

    const s1title = await makeText("1. Alignment state coverage check", { size:15, weight:"SemiBold", color:T.fg });
    const s1sub = await makeText("Ensure STRONG / MODERATE / WEAK / DISALIGNED states are reachable and meaningful.", { size:12, color:T.mutedFg, width:contentW - 72 });
    s1.appendChild(s1title);
    s1.appendChild(s1sub);
    s1.appendChild(await makeCheckItem("Does STRONG alignment appear at least 5–10% on any timeframe?", false));
    s1.appendChild(await makeCheckItem("Is STRONG 0% across all timeframes?", true));
    s1.appendChild(await makeCheckItem("Is WEAK >60% on 4+ timeframes?", true));
    tabContent.appendChild(s1);

  } else if (activeTab === "tune") {
    const note = await makeText("Adjust thresholds below. Changes persist in local version store and apply to interpretation + diagnostics.", { size:13, color:T.mutedFg, width: contentW - 32 });
    tabContent.appendChild(note);

    const thresholds = [
      ["alignment_strong", "0.75", "Minimum alignment_score for STRONG"],
      ["alignment_moderate", "0.55", "Minimum alignment_score for MODERATE"],
      ["alignment_weak", "0.30", "Minimum alignment_score for WEAK"],
      ["conf_high_stack", "0.70", "multi_tf_stack_score required for HIGH confidence"],
      ["conf_medium_stack", "0.40", "multi_tf_stack_score required for MEDIUM confidence"],
      ["bias_cont_wave3", "0.60", "wave3_probability gate for CONTINUATION"],
    ];

    for (const [key, defaultVal, description] of thresholds) {
      const row = makeFrame("ThresholdRow/" + key, { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
      setAutoLayout(row, { direction:"VERTICAL", gap:4, paddingV:8 });
      const label = await makeText(key, { size:13, weight:"Medium", mono:true, color:T.fg });
      const desc = await makeText(description, { size:11, color:T.mutedFg });
      const inputRow = makeFrame("InputRow", { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
      setAutoLayout(inputRow, { direction:"HORIZONTAL", gap:12, crossAlign:"CENTER" });
      const inp = await makeInput(defaultVal, 80);
      inputRow.appendChild(inp);
      row.appendChild(label);
      row.appendChild(desc);
      row.appendChild(inputRow);
      tabContent.appendChild(row);
    }

    const btnRow = makeFrame("TuneBtns", { fills:[{type:"SOLID",color:{r:0,g:0,b:0},opacity:0}] });
    setAutoLayout(btnRow, { direction:"HORIZONTAL", gap:8, paddingV:12 });
    btnRow.appendChild(await makeButton("Save as new version", "default", true));
    btnRow.appendChild(await makeButton("Reset to defaults", "outline", true));
    tabContent.appendChild(btnRow);
  }

  content.appendChild(tabContent);
  return content;
}

// ─── 4. Engine 2 Scorecard ──────────────────────────────────────────────────
async function buildScorecard(contentW) {
  const content = makeFrame("ScorecardContent", { bg: T.bg });
  setAutoLayout(content, { direction: "VERTICAL", gap: 20, paddingH: 16, paddingV: 20, counterFix: true });
  content.primaryAxisSizingMode = "FIXED";
  content.resize(contentW, SCREEN_H);
  content.clipsContent = true;

  const h1 = await makeText("Engine 2 Scorecard", { size:18, weight:"SemiBold", color: T.fg });
  content.appendChild(h1);

  // Coverage scorecard
  const cov = makeFrame("CoverageCard", { bg:T.card, cornerRadius:RADIUS });
  cov.strokes = [rgb(T.border)]; cov.strokeWeight = 1; cov.strokeAlign = "INSIDE";
  cov.primaryAxisSizingMode = "FIXED"; cov.resize(contentW - 32, 220);
  setAutoLayout(cov, { direction:"VERTICAL", gap:0, paddingH:20, paddingV:16, counterFix:true, primaryFix:true });
  const covTitle = await makeText("1. Coverage scorecard", { size:15, weight:"SemiBold", color:T.fg });
  const covSub = await makeText("Are the expected states reachable?", { size:13, color:T.mutedFg });
  cov.appendChild(covTitle); cov.appendChild(covSub);
  cov.appendChild(await makeTableRow([["Dimension",180],["Metric",140],["Status",120],["Interpretation",220]], true));
  const coverageRows = [
    ["Alignment coverage", "STRONG reachable?", "❌ Unreachable", "alignment_score < 0.75 always"],
    ["Confidence coverage", "HIGH reachable?", "❌ Unreachable", "stack_score never ≥ 0.70"],
    ["Bias coverage", "CONTINUATION reachable?", "✅ Rare", "Valid but gated"],
    ["Bias coverage", "EXHAUSTION reachable?", "⚠️ Very rare", "Requires wave5 + divergence"],
  ];
  for (const row of coverageRows) {
    cov.appendChild(await makeTableRow(row.map((c,i)=>([c,[180,140,120,220][i]])), false));
  }
  content.appendChild(cov);

  // Gating scorecard
  const gat = makeFrame("GatingCard", { bg:T.card, cornerRadius:RADIUS });
  gat.strokes = [rgb(T.border)]; gat.strokeWeight = 1; gat.strokeAlign = "INSIDE";
  gat.primaryAxisSizingMode = "FIXED"; gat.resize(contentW - 32, 200);
  setAutoLayout(gat, { direction:"VERTICAL", gap:0, paddingH:20, paddingV:16, counterFix:true, primaryFix:true });
  const gatTitle = await makeText("3. Gating pressure scorecard", { size:15, weight:"SemiBold", color:T.fg });
  const gatSub = await makeText("What rules exert the most force?", { size:13, color:T.mutedFg });
  gat.appendChild(gatTitle); gat.appendChild(gatSub);
  gat.appendChild(await makeTableRow([["Gate",320],["Blocking %",120],["Severity",180]], true));
  const gatingRows = [
    ["alignment_score < 0.75", "~100%", "🔴 Hard lock"],
    ["multi_tf_stack_score < 0.70", "~100%", "🔴 Hard lock"],
    ["wave3_probability < 0.60", "18–40%", "🟠 Soft gate"],
    ["momentum_strength_score < 0.55", "14–27%", "🟠 Soft gate"],
  ];
  for (const row of gatingRows) {
    gat.appendChild(await makeTableRow(row.map((c,i)=>([c,[320,120,180][i]])), false));
  }
  content.appendChild(gat);

  return content;
}

// ─── 5. Home (standalone, no nav shell for this one) ────────────────────────
// (included as part of makePageShell above)

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
figma.showUI(__html__, { width: 360, height: 180 });

figma.ui.onmessage = async function(msg) {
  if (msg.type !== "build") return;

  try {
    // Load all fonts we'll need
    progress("Loading fonts…", 2);
    await figma.loadFontAsync({ family: FONT_SANS, style: "Regular" });
    await figma.loadFontAsync({ family: FONT_SANS, style: "Medium" });
    await figma.loadFontAsync({ family: FONT_SANS, style: "SemiBold" });
    try {
      await figma.loadFontAsync({ family: FONT_MONO, style: "Regular" });
    } catch(e) {
      // Roboto Mono might not be available — fall back silently
    }

    // Create page
    const page = figma.createPage();
    page.name = "SMC Viewer Designs";
    figma.currentPage = page;

    const screens = [
      { name: "1. Home", pct: 15, builder: async () => makePageShell("Home", "/", buildHome) },
      { name: "2. SMC Viewer — Chart", pct: 30, builder: async () => makePageShell("SMC Viewer", "/smc-viewer", buildSmcViewer) },
      { name: "3. Engine 2 — Reference", pct: 45, builder: async () => makePageShell("Engine 2 — Reference", "/engine2?tab=reference", (w) => buildEngine2Hub(w, "reference")) },
      { name: "4. Engine 2 — Diagnostics", pct: 60, builder: async () => makePageShell("Engine 2 — Diagnostics", "/engine2?tab=diagnostics", (w) => buildEngine2Hub(w, "diagnostics")) },
      { name: "5. Engine 2 — Evaluate", pct: 75, builder: async () => makePageShell("Engine 2 — Evaluate", "/engine2?tab=evaluate", (w) => buildEngine2Hub(w, "evaluate")) },
      { name: "6. Engine 2 — Scorecard", pct: 90, builder: async () => makePageShell("Scorecard", "/engine2-scorecard", buildScorecard) },
    ];

    for (let i = 0; i < screens.length; i++) {
      const s = screens[i];
      progress("Building " + s.name + "…", s.pct);
      const frame = await s.builder();
      frame.x = i * (SCREEN_W + SCREEN_GAP);
      frame.y = 0;
      page.appendChild(frame);
      await new Promise(r => setTimeout(r, 20));
    }

    figma.viewport.scrollAndZoomIntoView(page.children);
    figma.ui.postMessage({ type: "done" });

  } catch(err) {
    figma.ui.postMessage({ type: "error", message: err.message || String(err) });
    console.error(err);
  }
};
