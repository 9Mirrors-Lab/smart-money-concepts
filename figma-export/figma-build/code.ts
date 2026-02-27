// SMC Viewer — Build Components
// Creates actual editable Figma nodes (Auto Layout, text, fills, etc.)
// for each page of the smc-viewer Next.js app.

// ─── Design Tokens (dark mode, converted from OKLCH in globals.css) ──────────
const T = {
  bg:           { r: 0.098, g: 0.098, b: 0.098 },
  fg:           { r: 0.973, g: 0.973, b: 0.973 },
  card:         { r: 0.149, g: 0.149, b: 0.149 },
  border:       { r: 1,     g: 1,     b: 1     },
  borderA:      0.10,
  muted:        { r: 0.196, g: 0.196, b: 0.196 },
  mutedFg:      { r: 0.612, g: 0.612, b: 0.612 },
  primary:      { r: 0.894, g: 0.894, b: 0.894 },
  primaryFg:    { r: 0.149, g: 0.149, b: 0.149 },
  transparent:  { r: 0,     g: 0,     b: 0     },
  amber:        { r: 0.910, g: 0.647, b: 0.082 },
  emerald:      { r: 0.204, g: 0.839, b: 0.580 },
  red:          { r: 0.937, g: 0.267, b: 0.267 },
  navBg:        { r: 0.055, g: 0.055, b: 0.137 },
  navBorder:    { r: 0.176, g: 0.761, b: 0.855 },
  navActiveBg:  { r: 0.043, g: 0.200, b: 0.133 },
  navActiveBrd: { r: 0.176, g: 0.906, b: 0.565 },
  navActiveText:{ r: 0.431, g: 0.949, b: 0.733 },
};

const RADIUS = 10;
const SCREEN_W = 1440;
const SCREEN_H = 900;
const SCREEN_GAP = 120;
const NAV_W = 240;
const FONT = "Inter";



// ─── Fill Helpers ────────────────────────────────────────────────────────────

function solidPaint(color: RGB, opacity = 1): SolidPaint {
  return { type: "SOLID", color, opacity };
}

function transparentFill(): SolidPaint[] {
  return [{ type: "SOLID", color: T.transparent, opacity: 0 }];
}

function borderStroke(weight = 1, opacity = T.borderA): SolidPaint[] {
  return [solidPaint(T.border, opacity)];
}

// ─── Auto-layout helper ──────────────────────────────────────────────────────

interface ALOpts {
  dir?: "HORIZONTAL" | "VERTICAL";
  gap?: number;
  ph?: number;  // padding horizontal
  pv?: number;  // padding vertical
  pl?: number; pr?: number; pt?: number; pb?: number;
  align?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  cross?: "MIN" | "CENTER" | "MAX";
  fixW?: boolean;
  fixH?: boolean;
  wrap?: boolean;
}

function al(node: FrameNode, o: ALOpts = {}) {
  node.layoutMode = o.dir ?? "VERTICAL";
  node.primaryAxisSizingMode   = o.fixH ? "FIXED" : "AUTO";
  node.counterAxisSizingMode   = o.fixW ? "FIXED" : "AUTO";
  if (o.gap !== undefined) node.itemSpacing = o.gap;
  if (o.ph !== undefined) { node.paddingLeft = o.ph; node.paddingRight = o.ph; }
  if (o.pv !== undefined) { node.paddingTop = o.pv; node.paddingBottom = o.pv; }
  if (o.pl !== undefined) node.paddingLeft = o.pl;
  if (o.pr !== undefined) node.paddingRight = o.pr;
  if (o.pt !== undefined) node.paddingTop = o.pt;
  if (o.pb !== undefined) node.paddingBottom = o.pb;
  if (o.align) node.primaryAxisAlignItems = o.align;
  if (o.cross) node.counterAxisAlignItems = o.cross;
  if (o.wrap) node.layoutWrap = "WRAP";
}

// ─── Node factories ──────────────────────────────────────────────────────────

function frame(name: string, bg?: RGB, opacity = 1): FrameNode {
  const f = figma.createFrame();
  f.name = name;
  f.fills = bg ? [solidPaint(bg, opacity)] : transparentFill();
  f.clipsContent = false;
  return f;
}

function card(name: string): FrameNode {
  const f = frame(name, T.card);
  f.cornerRadius = RADIUS;
  f.strokes = borderStroke();
  f.strokeWeight = 1;
  f.strokeAlign = "INSIDE";
  return f;
}

function rect(name: string, color: RGB, w: number, h: number, r = 0): RectangleNode {
  const n = figma.createRectangle();
  n.name = name;
  n.fills = [solidPaint(color)];
  n.cornerRadius = r;
  n.resize(w, h);
  return n;
}

async function txt(content: string, opts: {
  size?: number;
  weight?: string;
  color?: RGB;
  opacity?: number;
  mono?: boolean;
  width?: number;
} = {}): Promise<TextNode> {
  const family = opts.mono ? "Roboto Mono" : FONT;
  const style = opts.weight ?? "Regular";
  await figma.loadFontAsync({ family, style });
  const t = figma.createText();
  t.fontName = { family, style };
  t.fontSize = opts.size ?? 14;
  t.fills = [solidPaint(opts.color ?? T.fg, opts.opacity ?? 1)];
  t.characters = content;
  if (opts.width) {
    t.textAutoResize = "HEIGHT";
    t.resize(opts.width, 20);
  } else {
    t.textAutoResize = "WIDTH_AND_HEIGHT";
  }
  return t;
}

// ─── Reusable Components ─────────────────────────────────────────────────────

async function makeButton(label: string, variant: "default" | "outline" | "secondary" | "ghost" = "default", small = false): Promise<FrameNode> {
  const bg = variant === "default" ? T.primary : variant === "secondary" ? T.muted : T.transparent;
  const textColor = variant === "default" ? T.primaryFg : T.fg;
  const f = frame("Button/" + variant, bg, variant === "outline" || variant === "ghost" ? 0 : 1);
  f.cornerRadius = RADIUS;
  if (variant === "outline") { f.strokes = borderStroke(1, 0.4); f.strokeWeight = 1; f.strokeAlign = "INSIDE"; }
  al(f, { dir: "HORIZONTAL", gap: 6, ph: small ? 12 : 16, pv: small ? 6 : 9, align: "CENTER", cross: "CENTER" });
  f.appendChild(await txt(label, { size: small ? 12 : 14, weight: "Medium", color: textColor }));
  return f;
}

async function makeTabBar(tabs: string[], activeIdx = 0): Promise<FrameNode> {
  const bar = frame("TabBar");
  bar.strokes = borderStroke(1, 0.15);
  bar.strokeWeight = 1;
  bar.strokeAlign = "INSIDE";
  bar.strokeTopWeight = 0;
  bar.strokeLeftWeight = 0;
  bar.strokeRightWeight = 0;
  al(bar, { dir: "HORIZONTAL", gap: 0 });
  for (let i = 0; i < tabs.length; i++) {
    const isActive = i === activeIdx;
    const tab = frame("Tab/" + tabs[i]);
    al(tab, { dir: "HORIZONTAL", ph: 16, pv: 12, align: "CENTER", cross: "CENTER" });
    if (isActive) {
      tab.strokes = [solidPaint(T.primary)];
      tab.strokeWeight = 2;
      tab.strokeAlign = "INSIDE";
      tab.strokeTopWeight = 0;
      tab.strokeLeftWeight = 0;
      tab.strokeRightWeight = 0;
    }
    tab.appendChild(await txt(tabs[i], { size: 14, weight: isActive ? "Medium" : "Regular", color: isActive ? T.fg : T.mutedFg }));
    bar.appendChild(tab);
  }
  return bar;
}

async function makeSectionCard(title: string, bullets: string[], width: number): Promise<FrameNode> {
  const f = card("SectionCard");
  al(f, { gap: 10, ph: 20, pv: 20 });
  f.appendChild(await txt(title, { size: 15, weight: "SemiBold" }));
  for (const b of bullets) {
    f.appendChild(await txt("• " + b, { size: 13, color: T.mutedFg, width: width - 48 }));
  }
  return f;
}

async function makeTableRow(cells: Array<[string, number]>, isHeader = false): Promise<FrameNode> {
  const row = frame("TableRow/" + (isHeader ? "Header" : "Data"), isHeader ? T.muted : T.transparent, isHeader ? 0.3 : 0);
  row.strokes = borderStroke(1, 0.12);
  row.strokeWeight = 1;
  row.strokeAlign = "INSIDE";
  row.strokeTopWeight = 0;
  row.strokeLeftWeight = 0;
  row.strokeRightWeight = 0;
  al(row, { dir: "HORIZONTAL", gap: 0 });
  for (const [text, w] of cells) {
    const cell = frame("Cell");
    al(cell, { ph: 14, pv: 10, fixW: true });
    cell.primaryAxisSizingMode = "FIXED";
    cell.resize(w, 40);
    cell.appendChild(await txt(text, { size: 13, weight: isHeader ? "Medium" : "Regular", color: isHeader ? T.mutedFg : T.fg }));
    row.appendChild(cell);
  }
  return row;
}

async function makeCheckRow(label: string, checked = false, width: number): Promise<FrameNode> {
  const row = frame("CheckRow");
  al(row, { dir: "HORIZONTAL", gap: 10, cross: "CENTER" });
  const box = rect("Checkbox", checked ? T.primary : T.transparent, 14, 14, 3);
  if (!checked) { box.strokes = borderStroke(1, 0.4); box.strokeWeight = 1; box.strokeAlign = "INSIDE"; }
  row.appendChild(box);
  row.appendChild(await txt(label, { size: 13, width: width - 36 }));
  return row;
}

async function makeInput(placeholder: string, w = 300): Promise<FrameNode> {
  const f = frame("Input");
  f.cornerRadius = 6;
  f.strokes = borderStroke(1, 0.3);
  f.strokeWeight = 1;
  f.strokeAlign = "INSIDE";
  al(f, { ph: 12, pv: 8, fixW: true });
  f.primaryAxisSizingMode = "FIXED";
  f.resize(w, 36);
  f.appendChild(await txt(placeholder, { size: 13, color: T.mutedFg }));
  return f;
}

async function makeTextarea(placeholder: string, w = 600, h = 100): Promise<FrameNode> {
  const f = frame("Textarea");
  f.cornerRadius = 6;
  f.strokes = borderStroke(1, 0.3);
  f.strokeWeight = 1;
  f.strokeAlign = "INSIDE";
  f.clipsContent = true;
  al(f, { ph: 12, pv: 8, fixW: true });
  f.primaryAxisSizingMode = "FIXED";
  f.resize(w, h);
  f.appendChild(await txt(placeholder, { size: 12, color: T.mutedFg, mono: true }));
  return f;
}

// ─── Nav Drawer ───────────────────────────────────────────────────────────────

async function makeNavDrawer(activePath: string): Promise<FrameNode> {
  const drawer = frame("NavDrawer", T.navBg);
  drawer.clipsContent = true;
  drawer.strokes = [solidPaint(T.navBorder, 0.4)];
  drawer.strokeWeight = 1;
  drawer.strokeAlign = "INSIDE";
  drawer.strokeTopWeight = 0;
  drawer.strokeBottomWeight = 0;
  drawer.strokeLeftWeight = 0;
  al(drawer, { gap: 0, fixW: true, fixH: true });
  drawer.resize(NAV_W, SCREEN_H);
  drawer.primaryAxisSizingMode = "FIXED";
  drawer.counterAxisSizingMode = "FIXED";

  // Header close row
  const closeRow = frame("Header");
  closeRow.strokes = [solidPaint(T.navBorder, 0.15)];
  closeRow.strokeWeight = 1;
  closeRow.strokeAlign = "INSIDE";
  closeRow.strokeTopWeight = 0;
  closeRow.strokeLeftWeight = 0;
  closeRow.strokeRightWeight = 0;
  al(closeRow, { dir: "HORIZONTAL", align: "MAX", cross: "CENTER", ph: 8, pv: 8, fixW: true });
  closeRow.primaryAxisSizingMode = "FIXED";
  closeRow.resize(NAV_W, 44);
  const xBtn = frame("CloseBtn");
  xBtn.cornerRadius = 6;
  al(xBtn, { align: "CENTER", cross: "CENTER" });
  xBtn.resize(32, 32);
  xBtn.primaryAxisSizingMode = "FIXED";
  xBtn.counterAxisSizingMode = "FIXED";
  xBtn.appendChild(await txt("✕", { size: 13, color: T.navActiveText }));
  closeRow.appendChild(xBtn);
  drawer.appendChild(closeRow);

  const sections: Array<{ label: string; links: Array<{ label: string; desc: string; href: string }> }> = [
    { label: "Main", links: [
      { label: "Chart", desc: "SMC animation viewer", href: "/smc-viewer" },
      { label: "Multi-TF analysis", desc: "Open bottom drawer", href: "/smc-viewer?open=all-timeframes" },
    ]},
    { label: "Engine 2", links: [
      { label: "Reference", desc: "Logic reference", href: "/engine2?tab=reference" },
      { label: "Diagnostics", desc: "Run diagnostics", href: "/engine2?tab=diagnostics" },
      { label: "Evaluate", desc: "Evaluate runs", href: "/engine2?tab=evaluate" },
      { label: "Tune", desc: "Calibration", href: "/engine2?tab=tune" },
    ]},
    { label: "Settings", links: [
      { label: "Indicators", desc: "Toggle chart overlays", href: "#settings" },
      { label: "Square chart", desc: "Set Y-axis swing range", href: "#settings" },
    ]},
  ];

  for (const section of sections) {
    const secHeader = frame("Section/" + section.label);
    al(secHeader, { dir: "HORIZONTAL", ph: 10, pv: 10, cross: "CENTER", fixW: true });
    secHeader.primaryAxisSizingMode = "FIXED";
    secHeader.resize(NAV_W, 38);
    secHeader.appendChild(await txt(section.label, { size: 12, weight: "Medium", color: T.navActiveText, opacity: 0.7 }));
    drawer.appendChild(secHeader);

    for (const link of section.links) {
      const isActive = activePath === link.href ||
        (link.href !== "/" && activePath.startsWith(link.href.split("?")[0]));
      const wrapper = frame("NavLinkWrapper");
      al(wrapper, { ph: 8, pv: 2, fixW: true });
      wrapper.primaryAxisSizingMode = "FIXED";
      wrapper.resize(NAV_W, 52);

      const linkFrame = frame("NavLink/" + link.label,
        isActive ? T.navActiveBg : T.transparent,
        isActive ? 0.5 : 0
      );
      linkFrame.cornerRadius = 6;
      if (isActive) {
        linkFrame.strokes = [solidPaint(T.navActiveBrd, 0.9)];
        linkFrame.strokeWeight = 2;
        linkFrame.strokeAlign = "INSIDE";
        linkFrame.strokeTopWeight = 0;
        linkFrame.strokeBottomWeight = 0;
        linkFrame.strokeRightWeight = 0;
      }
      al(linkFrame, { gap: 2, ph: 8, pv: 6, fixW: true });
      linkFrame.primaryAxisSizingMode = "FIXED";
      linkFrame.resize(NAV_W - 16, 48);
      linkFrame.appendChild(await txt(link.label, { size: 13, weight: "Medium", color: isActive ? T.navActiveText : T.fg }));
      linkFrame.appendChild(await txt(link.desc, { size: 11, color: isActive ? T.navActiveText : T.mutedFg, opacity: 0.75 }));
      wrapper.appendChild(linkFrame);
      drawer.appendChild(wrapper);
    }
  }

  return drawer;
}

// ─── Page shells ─────────────────────────────────────────────────────────────

async function makeScreen(name: string, activePath: string,
  contentFn: (w: number) => Promise<FrameNode>
): Promise<FrameNode> {
  const screen = frame(name, T.bg);
  screen.clipsContent = true;
  al(screen, { dir: "HORIZONTAL", gap: 0, fixW: true, fixH: true });
  screen.primaryAxisSizingMode = "FIXED";
  screen.counterAxisSizingMode = "FIXED";
  screen.resize(SCREEN_W, SCREEN_H);

  const nav = await makeNavDrawer(activePath);
  screen.appendChild(nav);

  const cw = SCREEN_W - NAV_W;
  const content = await contentFn(cw);
  content.primaryAxisSizingMode = "FIXED";
  content.counterAxisSizingMode = "FIXED";
  content.resize(cw, SCREEN_H);
  content.clipsContent = true;
  screen.appendChild(content);

  return screen;
}

// ─── Screen Builders ─────────────────────────────────────────────────────────

async function buildHome(cw: number): Promise<FrameNode> {
  const f = frame("Home/Content", T.bg);
  al(f, { gap: 24, ph: 32, pv: 0, align: "CENTER", cross: "CENTER", fixH: true });
  f.appendChild(await txt("SMC Viewer", { size: 28, weight: "SemiBold" }));
  f.appendChild(await txt("Chart animation and Engine 2 diagnostics.\nUse the nav on the left to open the chart or any Engine 2 page.", { size: 14, color: T.mutedFg, width: 420 }));
  const btnRow = frame("BtnRow");
  al(btnRow, { dir: "HORIZONTAL", gap: 12, align: "CENTER", cross: "CENTER" });
  btnRow.appendChild(await makeButton("Open chart", "outline"));
  btnRow.appendChild(await makeButton("Engine 2 diagnostic flow", "outline"));
  f.appendChild(btnRow);
  return f;
}

async function buildSmcViewer(cw: number): Promise<FrameNode> {
  const f = frame("SMCViewer/Content", T.bg);
  al(f, { gap: 0, fixH: true });

  // Top ribbon
  const ribbon = frame("TopRibbon", { r: 0.06, g: 0.04, b: 0.12 });
  ribbon.resize(cw, 32);
  ribbon.primaryAxisSizingMode = "FIXED";
  ribbon.counterAxisSizingMode = "FIXED";
  al(ribbon, { dir: "HORIZONTAL", align: "CENTER", cross: "CENTER", gap: 8, ph: 8, fixW: true, fixH: true });
  ribbon.appendChild(await txt("π  Playback Controls", { size: 12, weight: "Medium", color: { r: 0.85, g: 0.6, b: 1.0 } }));
  f.appendChild(ribbon);

  // Chart card
  const chartCard = card("ChartArea");
  chartCard.resize(cw - 32, SCREEN_H - 32 - 80 - 32);
  chartCard.primaryAxisSizingMode = "FIXED";
  chartCard.counterAxisSizingMode = "FIXED";
  al(chartCard, { align: "CENTER", cross: "CENTER", gap: 8 });

  const chartWrapper = frame("ChartWrapper", T.bg);
  al(chartWrapper, { gap: 12, ph: 16, pv: 16, fixW: true, fixH: true });
  chartWrapper.resize(cw - 32, SCREEN_H - 32 - 80 - 32);
  chartWrapper.appendChild(chartCard);

  // Chart label
  chartCard.appendChild(await txt("Plotly Candlestick Chart", { size: 18, weight: "Medium", color: T.mutedFg }));
  chartCard.appendChild(await txt("CHoCH / BOS / Order Blocks / FVG / Wave State overlays", { size: 13, color: T.mutedFg }));

  // Alignment mini-panel
  const alignPanel = card("AlignmentPanel");
  alignPanel.resize(240, 128);
  alignPanel.primaryAxisSizingMode = "FIXED";
  alignPanel.counterAxisSizingMode = "FIXED";
  al(alignPanel, { gap: 8, ph: 12, pv: 12 });
  alignPanel.appendChild(await txt("Alignment", { size: 11, weight: "SemiBold", color: T.mutedFg }));
  const rows: Array<[string, RGB]> = [
    ["Stack aligned", T.emerald],
    ["Trend: BULLISH", T.fg],
    ["Confidence: MEDIUM", T.amber],
  ];
  for (const [label, color] of rows) {
    const row = frame("AlignRow");
    al(row, { dir: "HORIZONTAL", gap: 6, cross: "CENTER" });
    row.appendChild(rect("Dot", color, 6, 6, 9999));
    row.appendChild(await txt(label, { size: 11, color }));
    alignPanel.appendChild(row);
  }
  chartCard.appendChild(alignPanel);

  f.appendChild(chartWrapper);

  // Playback bar
  const playbar = card("PlaybackBar");
  playbar.cornerRadius = 0;
  playbar.strokes = borderStroke(1, 0.12);
  playbar.strokeBottomWeight = 0;
  playbar.strokeLeftWeight = 0;
  playbar.strokeRightWeight = 0;
  playbar.resize(cw, 80);
  playbar.primaryAxisSizingMode = "FIXED";
  playbar.counterAxisSizingMode = "FIXED";
  al(playbar, { dir: "HORIZONTAL", gap: 12, ph: 16, align: "CENTER", cross: "CENTER", fixW: true, fixH: true });
  for (const c of ["⏮", "⏪", "▶", "⏩", "⏭"]) {
    const btn = frame("Ctrl");
    btn.cornerRadius = 6;
    btn.resize(36, 36);
    btn.primaryAxisSizingMode = "FIXED";
    btn.counterAxisSizingMode = "FIXED";
    al(btn, { align: "CENTER", cross: "CENTER" });
    btn.appendChild(await txt(c, { size: 14, color: T.fg }));
    playbar.appendChild(btn);
  }
  playbar.appendChild(await txt("1×  Speed", { size: 12, color: T.mutedFg }));

  // Track
  const trackWrapper = frame("Track");
  al(trackWrapper, { dir: "HORIZONTAL", cross: "CENTER", gap: 0 });
  const totalTrackW = cw - 250;
  const trackBg = rect("TrackBg", T.muted, totalTrackW, 4, 3);
  const trackFill = rect("TrackFill", T.primary, Math.floor(totalTrackW * 0.35), 4, 3);
  trackWrapper.appendChild(trackBg);
  trackWrapper.appendChild(trackFill);
  trackFill.x = 0;
  playbar.appendChild(trackWrapper);

  f.appendChild(playbar);
  return f;
}

async function buildEngine2(cw: number, activeTab: string): Promise<FrameNode> {
  const f = frame("Engine2/Content", T.bg);
  al(f, { gap: 0, fixH: true });

  // Sticky header
  const header = frame("Header", T.bg);
  header.strokes = borderStroke(1, 0.12);
  header.strokeWeight = 1;
  header.strokeAlign = "INSIDE";
  header.strokeTopWeight = 0;
  header.strokeLeftWeight = 0;
  header.strokeRightWeight = 0;
  al(header, { gap: 12, ph: 20, pv: 16 });
  header.appendChild(await txt("Engine 2", { size: 18, weight: "SemiBold" }));
  header.appendChild(await txt("Interpretation · Diagnostics · Calibration", { size: 13, color: T.mutedFg }));

  const tabs = ["Reference", "Diagnostics", "Evaluate", "Tune"];
  const activeIdx = tabs.findIndex(t => t.toLowerCase() === activeTab);
  const tabBar = await makeTabBar(tabs, activeIdx >= 0 ? activeIdx : 0);
  tabBar.resize(cw, 44);
  tabBar.primaryAxisSizingMode = "FIXED";
  header.appendChild(tabBar);
  f.appendChild(header);

  // Content scroll area
  const body = frame("Body", T.bg);
  body.clipsContent = true;
  al(body, { gap: 20, ph: 20, pv: 20, fixH: true });
  body.resize(cw, SCREEN_H - 180);
  body.primaryAxisSizingMode = "FIXED";
  body.counterAxisSizingMode = "FIXED";

  const w = cw - 40; // usable width inside padding

  if (activeTab === "reference") {
    body.appendChild(await makeSectionCard(
      "Engine 2 decision flow",
      ["Compute alignment_score", "Classify STRONG / MODERATE / WEAK / DISALIGNED", "Evaluate stack", "Assign confidence: HIGH / MEDIUM / LOW", "Evaluate wave + momentum for bias", "Evaluate divergence for warnings"],
      w
    ));
    body.appendChild(await makeSectionCard("alignment_score", [
      "Weighted sum across timeframes",
      "upper_tf_weight: 0.40  |  mid_tf_weight: 0.35  |  lower_tf_weight: 0.25",
    ], w));
    body.appendChild(await makeSectionCard("Step 1 — Alignment classification", [
      "≥ 0.75 → STRONG", "≥ 0.55 → MODERATE", "≥ 0.30 → WEAK", "else → DISALIGNED"
    ], w));

  } else if (activeTab === "diagnostics") {
    body.appendChild(await txt("Select symbol · timeframe · run to see distribution grid.", { size: 13, color: T.mutedFg }));
    const grid = card("DiagnosticsGrid");
    grid.resize(w, 260);
    grid.primaryAxisSizingMode = "FIXED";
    grid.counterAxisSizingMode = "FIXED";
    al(grid, { gap: 0 });
    grid.appendChild(await makeTableRow([["TF",60],["STRONG",110],["MODERATE",110],["WEAK",110],["DISALIGNED",110],["HIGH conf",110],["LOW conf",110]], true));
    for (const tf of ["1M","1W","1D","360","90","23"]) {
      grid.appendChild(await makeTableRow([[tf,60],["0%",110],["8%",110],["74%",110],["18%",110],["0%",110],["100%",110]]));
    }
    body.appendChild(grid);
    const btnRow = frame("ActionRow");
    al(btnRow, { dir: "HORIZONTAL", gap: 8 });
    btnRow.appendChild(await makeButton("Run diagnostics", "default", true));
    btnRow.appendChild(await makeButton("Export as Markdown", "outline", true));
    body.appendChild(btnRow);

  } else if (activeTab === "evaluate") {
    body.appendChild(await txt("Logic in use: Default · Tune v1", { size: 13, color: T.mutedFg }));
    body.appendChild(await txt("Engine 2 diagnostic markdown", { size: 14, weight: "Medium" }));
    body.appendChild(await makeTextarea("Paste diagnostic markdown here…", w, 100));

    const s1 = card("Section1");
    al(s1, { gap: 12, ph: 20, pv: 20 });
    s1.appendChild(await txt("1. Alignment state coverage check", { size: 15, weight: "SemiBold" }));
    s1.appendChild(await txt("Ensure STRONG / MODERATE / WEAK / DISALIGNED states are reachable.", { size: 13, color: T.mutedFg, width: w - 40 }));
    s1.appendChild(await makeCheckRow("Does STRONG alignment appear at least 5–10% on any timeframe?", false, w - 40));
    s1.appendChild(await makeCheckRow("Is STRONG 0% across all timeframes?", true, w - 40));
    s1.appendChild(await makeCheckRow("Is WEAK > 60% on 4+ timeframes?", true, w - 40));
    body.appendChild(s1);

  } else if (activeTab === "tune") {
    body.appendChild(await txt("Adjust thresholds. Changes persist in local version store.", { size: 13, color: T.mutedFg, width: w }));
    const thresholds: Array<[string, string, string]> = [
      ["alignment_strong", "0.75", "Minimum alignment_score for STRONG"],
      ["alignment_moderate", "0.55", "Minimum alignment_score for MODERATE"],
      ["alignment_weak", "0.30", "Minimum alignment_score for WEAK"],
      ["conf_high_stack", "0.70", "multi_tf_stack_score for HIGH confidence"],
      ["conf_medium_stack", "0.40", "multi_tf_stack_score for MEDIUM confidence"],
    ];
    for (const [key, val, desc] of thresholds) {
      const row = frame("ThreshRow/" + key);
      al(row, { gap: 4, pv: 6 });
      row.appendChild(await txt(key, { size: 13, weight: "Medium", mono: true }));
      row.appendChild(await txt(desc, { size: 11, color: T.mutedFg }));
      const inputRow = frame("InputRow");
      al(inputRow, { dir: "HORIZONTAL", gap: 12, cross: "CENTER" });
      inputRow.appendChild(await makeInput(val, 80));
      row.appendChild(inputRow);
      body.appendChild(row);
    }
    const btnRow = frame("TuneBtns");
    al(btnRow, { dir: "HORIZONTAL", gap: 8, pv: 8 });
    btnRow.appendChild(await makeButton("Save as new version", "default", true));
    btnRow.appendChild(await makeButton("Reset to defaults", "outline", true));
    body.appendChild(btnRow);
  }

  f.appendChild(body);
  return f;
}

async function buildScorecard(cw: number): Promise<FrameNode> {
  const f = frame("Scorecard/Content", T.bg);
  al(f, { gap: 20, ph: 20, pv: 20, fixH: true });
  f.clipsContent = true;
  const w = cw - 40;

  f.appendChild(await txt("Engine 2 Scorecard", { size: 18, weight: "SemiBold" }));

  const cov = card("CoverageCard");
  al(cov, { gap: 0, ph: 20, pv: 16 });
  cov.appendChild(await txt("1. Coverage scorecard", { size: 15, weight: "SemiBold" }));
  cov.appendChild(await txt("Are the expected states reachable?", { size: 13, color: T.mutedFg }));
  cov.appendChild(await makeTableRow([["Dimension",180],["Metric",140],["Status",120],["Interpretation",w-460]], true));
  for (const row of [
    ["Alignment coverage", "STRONG reachable?", "❌ Unreachable", "alignment_score < 0.75 always"],
    ["Confidence coverage", "HIGH reachable?", "❌ Unreachable", "stack_score never ≥ 0.70"],
    ["Bias coverage", "CONTINUATION reachable?", "✅ Rare", "Valid but tightly gated"],
    ["Bias coverage", "EXHAUSTION reachable?", "⚠️ Very rare", "Requires wave5 + divergence"],
  ] as string[][]) {
    cov.appendChild(await makeTableRow([[row[0],180],[row[1],140],[row[2],120],[row[3],w-460]]));
  }
  f.appendChild(cov);

  const gat = card("GatingCard");
  al(gat, { gap: 0, ph: 20, pv: 16 });
  gat.appendChild(await txt("3. Gating pressure scorecard", { size: 15, weight: "SemiBold" }));
  gat.appendChild(await txt("What rules exert the most force?", { size: 13, color: T.mutedFg }));
  gat.appendChild(await makeTableRow([["Gate",360],["Blocking %",120],["Severity",w-500]], true));
  for (const row of [
    ["alignment_score < 0.75", "~100%", "🔴 Hard lock"],
    ["multi_tf_stack_score < 0.70", "~100%", "🔴 Hard lock"],
    ["wave3_probability < 0.60", "18–40%", "🟠 Soft gate"],
    ["momentum_strength_score < 0.55", "14–27%", "🟠 Soft gate"],
  ] as string[][]) {
    gat.appendChild(await makeTableRow([[row[0],360],[row[1],120],[row[2],w-500]]));
  }
  f.appendChild(gat);
  return f;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

figma.showUI(__html__, { width: 360, height: 190 });

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type !== "build") return;

  try {
    const send = (text: string, pct: number) =>
      figma.ui.postMessage({ type: "progress", text, pct });

    send("Loading fonts…", 5);
    await figma.loadFontAsync({ family: FONT, style: "Regular" });
    await figma.loadFontAsync({ family: FONT, style: "Medium" });
    await figma.loadFontAsync({ family: FONT, style: "SemiBold" });
    try { await figma.loadFontAsync({ family: "Roboto Mono", style: "Regular" }); } catch (_) { /* skip */ }

    const page = figma.createPage();
    page.name = "SMC Viewer Designs";
    figma.currentPage = page;

    const screens: Array<{ name: string; path: string; pct: number; fn: (cw: number) => Promise<FrameNode> }> = [
      { name: "1. Home",                  path: "/",                       pct: 15, fn: buildHome },
      { name: "2. SMC Viewer",            path: "/smc-viewer",             pct: 30, fn: buildSmcViewer },
      { name: "3. Engine 2 — Reference",  path: "/engine2?tab=reference",  pct: 45, fn: (cw) => buildEngine2(cw, "reference") },
      { name: "4. Engine 2 — Diagnostics",path: "/engine2?tab=diagnostics",pct: 60, fn: (cw) => buildEngine2(cw, "diagnostics") },
      { name: "5. Engine 2 — Evaluate",   path: "/engine2?tab=evaluate",   pct: 75, fn: (cw) => buildEngine2(cw, "evaluate") },
      { name: "6. Engine 2 — Scorecard",  path: "/engine2-scorecard",      pct: 88, fn: buildScorecard },
    ];

    for (let i = 0; i < screens.length; i++) {
      const s = screens[i];
      send("Building " + s.name + "…", s.pct);
      const screen = await makeScreen(s.name, s.path, s.fn);
      screen.x = i * (SCREEN_W + SCREEN_GAP);
      screen.y = 0;
      page.appendChild(screen);
    }

    figma.viewport.scrollAndZoomIntoView(page.children);
    figma.ui.postMessage({ type: "done" });

  } catch (err) {
    const e = err as Error;
    figma.ui.postMessage({ type: "error", message: e.message ?? String(err) });
  }
};
