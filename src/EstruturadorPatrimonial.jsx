import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Users,
  Building2,
  Landmark,
  Home,
  TrendingUp,
  Briefcase,
  Plus,
  Link2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  X,
  ArrowLeftRight,
  ShieldCheck,
  Sparkles,
  Crown,
  Pencil,
  Info,
} from 'lucide-react'

/* ==========================================================================
   Patrimo · Estruturador Patrimonial
   --------------------------------------------------------------------------
   Mockup navegável de uma tela única com toggle AS-IS / Otimizado.
   - Canvas SVG-over-HTML com pan / zoom / pinch e drag de nós (pointer events,
     funciona em mouse e em toque/iPad).
   - Cadastro funcional 100% em memória (useState). Sem localStorage.
   - Painel Otimizado é derivado da estrutura AS-IS por um "motor" simplificado
     que insere a Holding no topo e calcula badges de economia tributária.
   - Paleta: azul-marinho (base) + dourado (acento, a Holding é a "estrela").
   ========================================================================== */

/* ----------------------------- Constantes -------------------------------- */

const NODE_W = 198
const NODE_H = 76

// Parâmetros tributários simplificados (mockup) -----------------------------
const IR_PF_ALUGUEL = 0.275 // IRPF sobre aluguel (faixa marginal alta)
const IR_PJ_ALUGUEL = 0.1133 // Lucro presumido p/ locação (PIS+COFINS+IRPJ+CSLL)
const ITBI_RATE = 0.03 // ITBI municipal típico (imune na integralização)
const ITCMD_RATE = 0.04 // ITCMD estadual típico
const INVENTARIO_RATE = 0.06 // custas + honorários de inventário evitados (holding)

const TYPES = {
  PF: {
    label: 'Pessoa Física',
    short: 'PF',
    icon: Users,
    dot: 'bg-sky-500',
    box: 'bg-white border-sky-300',
    head: 'text-sky-700',
    accentBar: 'bg-sky-500',
  },
  PJ: {
    label: 'PJ Operacional',
    short: 'PJ',
    icon: Building2,
    dot: 'bg-slate-500',
    box: 'bg-white border-slate-300',
    head: 'text-slate-700',
    accentBar: 'bg-slate-500',
  },
  Holding: {
    label: 'Holding',
    short: 'Holding',
    icon: Crown,
    dot: 'bg-amber-500',
    box: 'bg-amber-50 border-amber-400',
    head: 'text-amber-800',
    accentBar: 'bg-amber-500',
  },
  Imovel: {
    label: 'Imóvel',
    short: 'Imóvel',
    icon: Home,
    dot: 'bg-teal-500',
    box: 'bg-white border-teal-300',
    head: 'text-teal-700',
    accentBar: 'bg-teal-500',
  },
  Investimento: {
    label: 'Investimento',
    short: 'Invest.',
    icon: TrendingUp,
    dot: 'bg-indigo-500',
    box: 'bg-white border-indigo-300',
    head: 'text-indigo-700',
    accentBar: 'bg-indigo-500',
  },
  Participacao: {
    label: 'Participação',
    short: 'Particip.',
    icon: Briefcase,
    dot: 'bg-violet-500',
    box: 'bg-white border-violet-300',
    head: 'text-violet-700',
    accentBar: 'bg-violet-500',
  },
}

const ENTITY_TYPE_OPTIONS = ['PF', 'PJ', 'Imovel', 'Investimento', 'Participacao']

/* ----------------------------- Helpers ----------------------------------- */

const brl = (v) =>
  (v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })

const brlK = (v) => {
  const n = Math.round(Math.abs(v) / 100) / 10 // 1 casa em milhares
  return `R$ ${n.toLocaleString('pt-BR')}k`
}

let _id = 1000
const nextId = (prefix = 'n') => `${prefix}-${_id++}`

/* -------------------- Família de exemplo (RF4) --------------------------- */

function seedData() {
  // Posições pensadas como um organograma AS-IS "espalhado" (PF no topo).
  const nodes = [
    // Pessoas físicas
    { id: 'pf-roberto', type: 'PF', name: 'Roberto Andrade', value: 0, rendaAnual: 720000, x: 120, y: 40 },
    { id: 'pf-helena', type: 'PF', name: 'Helena Andrade', value: 0, rendaAnual: 480000, x: 380, y: 40 },
    { id: 'pf-lucas', type: 'PF', name: 'Lucas Andrade', value: 0, rendaAnual: 60000, x: 700, y: 40 },
    { id: 'pf-marina', type: 'PF', name: 'Marina Andrade', value: 0, rendaAnual: 48000, x: 940, y: 40 },
    // PJ operacional
    {
      id: 'pj-comercio',
      type: 'PJ',
      name: 'Andrade Comércio Ltda',
      value: 3000000,
      faturamento: 8400000,
      regime: 'Lucro Real',
      x: 250,
      y: 300,
    },
    // Imóveis
    { id: 'im-casa', type: 'Imovel', name: 'Residência (Casa)', value: 2500000, valorVenal: 1900000, aluguelMensal: 0, alugado: false, x: 470, y: 300 },
    { id: 'im-apto', type: 'Imovel', name: 'Apto Centro (alugado)', value: 1200000, valorVenal: 850000, aluguelMensal: 6500, alugado: true, x: 690, y: 300 },
    { id: 'im-sala', type: 'Imovel', name: 'Sala Comercial (alugada)', value: 900000, valorVenal: 700000, aluguelMensal: 5000, alugado: true, x: 910, y: 300 },
    // Investimentos
    { id: 'inv-carteira', type: 'Investimento', name: 'Carteira de Investimentos', value: 1800000, x: 60, y: 300 },
  ]

  const edges = [
    // Casal detém a PJ operacional
    { id: nextId('e'), from: 'pf-roberto', to: 'pj-comercio', pct: 70 },
    { id: nextId('e'), from: 'pf-helena', to: 'pj-comercio', pct: 30 },
    // Imóveis em nome do casal (PF direto)
    { id: nextId('e'), from: 'pf-roberto', to: 'im-casa', pct: 50 },
    { id: nextId('e'), from: 'pf-helena', to: 'im-casa', pct: 50 },
    { id: nextId('e'), from: 'pf-roberto', to: 'im-apto', pct: 100 },
    { id: nextId('e'), from: 'pf-helena', to: 'im-sala', pct: 100 },
    // Investimentos na PF
    { id: nextId('e'), from: 'pf-roberto', to: 'inv-carteira', pct: 60 },
    { id: nextId('e'), from: 'pf-helena', to: 'inv-carteira', pct: 40 },
  ]

  return { nodes, edges }
}

/* ----------------- Cálculos tributários (AS-IS e Otimizado) -------------- */

function computeTax(nodes) {
  const imoveis = nodes.filter((n) => n.type === 'Imovel')
  const aluguelAnual = imoveis.reduce((s, n) => s + (n.alugado ? (n.aluguelMensal || 0) * 12 : 0), 0)
  const patrimonioTransmissivel = nodes
    .filter((n) => ['Imovel', 'PJ', 'Investimento', 'Participacao'].includes(n.type))
    .reduce((s, n) => s + (n.value || 0), 0)
  const baseImoveis = imoveis.reduce((s, n) => s + (n.value || 0), 0)

  const irAsIs = aluguelAnual * IR_PF_ALUGUEL
  const irOpt = aluguelAnual * IR_PJ_ALUGUEL

  const itbiEvitado = baseImoveis * ITBI_RATE // imune na integralização
  const itcmdEvitado = patrimonioTransmissivel * ITCMD_RATE * 0.5 // planejamento c/ usufruto (~50%)
  const inventarioEvitado = patrimonioTransmissivel * INVENTARIO_RATE

  return {
    aluguelAnual,
    patrimonioTransmissivel,
    baseImoveis,
    irAsIs,
    irOpt,
    irEconomiaAnual: irAsIs - irOpt,
    itbiEvitado,
    itcmdEvitado,
    inventarioEvitado,
    economiaUnica: itbiEvitado + itcmdEvitado + inventarioEvitado,
  }
}

/* --------------- Motor de otimização (estrutura proposta) ---------------- */
/* Insere a Holding no topo, realoca ativos sob ela e gera as badges.        */

function buildOptimized(nodes, edges) {
  const pfs = nodes.filter((n) => n.type === 'PF')
  const assets = nodes.filter((n) => ['PJ', 'Imovel', 'Investimento', 'Participacao'].includes(n.type))
  const tax = computeTax(nodes)

  const optNodes = []
  const optEdges = []
  const badges = [] // { edgeId | nodeId, anchor:'edge'|'node', text, kind }

  // --- Layout em camadas, centralizado --------------------------------------
  const GAP_X = 226
  const topRowW = Math.max(pfs.length, 1) * GAP_X
  const bottomRowW = Math.max(assets.length, 1) * GAP_X
  const worldW = Math.max(topRowW, bottomRowW, 4 * GAP_X)
  const centerX = worldW / 2

  // Camada 0 — Pessoas físicas (sócios da Holding)
  const pfStart = centerX - ((pfs.length - 1) * GAP_X) / 2
  pfs.forEach((p, i) => {
    optNodes.push({ ...p, x: pfStart + i * GAP_X - NODE_W / 2, y: 40 })
  })

  // Camada 1 — Holding (a estrela)
  const holding = {
    id: 'holding-opt',
    type: 'Holding',
    name: 'Holding Familiar Andrade',
    value: tax.patrimonioTransmissivel,
    regime: 'Lucro Presumido',
    x: centerX - NODE_W / 2,
    y: 250,
  }
  optNodes.push(holding)

  // Camada 2 — Ativos sob a Holding
  const assetStart = centerX - ((assets.length - 1) * GAP_X) / 2
  assets.forEach((a, i) => {
    optNodes.push({ ...a, x: assetStart + i * GAP_X - NODE_W / 2, y: 480 })
  })

  // --- Arestas: PF -> Holding ----------------------------------------------
  // Pais (2 primeiros) = usufrutuários; filhos = nua-propriedade via doação.
  const pais = pfs.slice(0, 2)
  const filhos = pfs.slice(2)
  pfs.forEach((p, i) => {
    const isPai = i < 2
    const pct = isPai ? Math.round(50 / Math.max(pais.length, 1)) : null
    const e = { id: nextId('oe'), from: p.id, to: holding.id, pct: pct ?? Math.round(50 / Math.max(filhos.length, 1)) }
    optEdges.push(e)
    if (!isPai) {
      badges.push({
        anchor: 'edge',
        edgeId: e.id,
        kind: 'itcmd',
        text: 'Doação c/ usufruto',
      })
    }
  })

  // ITCMD / inventário evitado: badge no nó Holding
  if (tax.patrimonioTransmissivel > 0) {
    badges.push({
      anchor: 'node',
      nodeId: holding.id,
      kind: 'itcmd',
      text: `ITCMD + inventário evitados: −${brlK(tax.itcmdEvitado + tax.inventarioEvitado)}`,
    })
    badges.push({
      anchor: 'node',
      nodeId: holding.id,
      kind: 'reforma',
      text: 'IRPFM: dividendos planejados',
    })
  }

  // --- Arestas: Holding -> Ativos ------------------------------------------
  assets.forEach((a) => {
    const e = { id: nextId('oe'), from: holding.id, to: a.id, pct: 100 }
    optEdges.push(e)

    if (a.type === 'Imovel') {
      badges.push({ anchor: 'edge', edgeId: e.id, kind: 'itbi', text: 'ITBI: imune' })
      if (a.alugado && a.aluguelMensal > 0) {
        const economiaMes = a.aluguelMensal * (IR_PF_ALUGUEL - IR_PJ_ALUGUEL)
        badges.push({
          anchor: 'edge',
          edgeId: e.id,
          kind: 'ir',
          text: `IR aluguel: −${brlK(economiaMes)}/mês`,
        })
        badges.push({ anchor: 'edge', edgeId: e.id, kind: 'reforma', text: 'IBS/CBS: redutor locação' })
      }
    }
    if (a.type === 'Investimento') {
      badges.push({ anchor: 'edge', edgeId: e.id, kind: 'reforma', text: 'Rendimentos centralizados' })
    }
  })

  return { optNodes, optEdges, badges, holdingId: holding.id, tax }
}

/* --------------------------- Geometria de aresta ------------------------- */

function elbowPath(a, b) {
  // a -> b, do centro-base de A ao centro-topo de B, com cotovelos ortogonais
  const x1 = a.x + NODE_W / 2
  const y1 = a.y + NODE_H
  const x2 = b.x + NODE_W / 2
  const y2 = b.y
  const my = y1 + (y2 - y1) / 2
  return `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`
}

function edgeMid(a, b) {
  const x1 = a.x + NODE_W / 2
  const y1 = a.y + NODE_H
  const x2 = b.x + NODE_W / 2
  const y2 = b.y
  return { x: (x1 + x2) / 2, y: y1 + (y2 - y1) / 2 }
}

/* ============================ Componente raiz ============================ */

export default function EstruturadorPatrimonial() {
  const seed = useMemo(seedData, [])
  const [nodes, setNodes] = useState(seed.nodes)
  const [edges, setEdges] = useState(seed.edges)

  const [view, setView] = useState('asis') // 'asis' | 'opt'
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)

  const [connectMode, setConnectMode] = useState(false)
  const [pendingFrom, setPendingFrom] = useState(null)

  const [panel, setPanel] = useState(null) // null | 'add' | 'edit'

  // Viewport independente por painel (preserva pan/zoom ao alternar)
  const [vp, setVp] = useState({
    asis: { tx: 40, ty: 24, scale: 0.82 },
    opt: { tx: 0, ty: 24, scale: 0.78 },
  })

  const canvasRef = useRef(null)
  const pointers = useRef(new Map()) // pointerId -> {x,y}
  const dragState = useRef(null) // { mode:'pan'|'node'|'pinch', ... }

  const optimized = useMemo(() => buildOptimized(nodes, edges), [nodes, edges])
  const tax = optimized.tax

  const isOpt = view === 'opt'
  const activeNodes = isOpt ? optimized.optNodes : nodes
  const activeEdges = isOpt ? optimized.optEdges : edges
  const nodeById = useMemo(() => {
    const m = {}
    activeNodes.forEach((n) => (m[n.id] = n))
    return m
  }, [activeNodes])

  const curVp = vp[view]
  const setCurVp = useCallback(
    (updater) => setVp((prev) => ({ ...prev, [view]: { ...prev[view], ...updater(prev[view]) } })),
    [view],
  )

  /* ----------------------- Pointer / pan / zoom / drag ------------------- */

  const screenToWorld = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current.getBoundingClientRect()
      const { tx, ty, scale } = vp[view]
      return {
        x: (clientX - rect.left - tx) / scale,
        y: (clientY - rect.top - ty) / scale,
      }
    },
    [vp, view],
  )

  const onPointerDownCanvas = (e) => {
    canvasRef.current.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      // inicia pinch
      const [p1, p2] = [...pointers.current.values()]
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      dragState.current = { mode: 'pinch', startDist: dist, startScale: vp[view].scale }
      return
    }

    // clique no fundo limpa seleção
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    dragState.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      startTx: vp[view].tx,
      startTy: vp[view].ty,
    }
  }

  const onPointerDownNode = (e, node) => {
    e.stopPropagation()
    canvasRef.current.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (connectMode && !isOpt) {
      if (!pendingFrom) {
        setPendingFrom(node.id)
      } else if (pendingFrom !== node.id) {
        const newEdge = { id: nextId('e'), from: pendingFrom, to: node.id, pct: 100 }
        setEdges((es) => [...es, newEdge])
        setPendingFrom(null)
        setConnectMode(false)
        setSelectedEdgeId(newEdge.id)
      }
      return
    }

    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setPanel('edit')

    if (isOpt) return // sem drag no painel otimizado (read-only)

    dragState.current = {
      mode: 'node',
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: node.x,
      nodeStartY: node.y,
    }
  }

  const onPointerMove = (e) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    const ds = dragState.current
    if (!ds) return

    if (ds.mode === 'pinch' && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()]
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      const ratio = dist / (ds.startDist || dist)
      const nextScale = Math.min(2, Math.max(0.35, ds.startScale * ratio))
      setCurVp(() => ({ scale: nextScale }))
      return
    }

    if (ds.mode === 'pan') {
      setCurVp(() => ({
        tx: ds.startTx + (e.clientX - ds.startX),
        ty: ds.startTy + (e.clientY - ds.startY),
      }))
      return
    }

    if (ds.mode === 'node') {
      const scale = vp[view].scale
      const dx = (e.clientX - ds.startX) / scale
      const dy = (e.clientY - ds.startY) / scale
      setNodes((ns) =>
        ns.map((n) => (n.id === ds.nodeId ? { ...n, x: ds.nodeStartX + dx, y: ds.nodeStartY + dy } : n)),
      )
    }
  }

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2 && dragState.current?.mode === 'pinch') {
      dragState.current = null
    }
    if (pointers.current.size === 0) {
      dragState.current = null
    }
  }

  const onWheel = (e) => {
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const { tx, ty, scale } = vp[view]
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const nextScale = Math.min(2, Math.max(0.35, scale * factor))
    const wx = (e.clientX - rect.left - tx) / scale
    const wy = (e.clientY - rect.top - ty) / scale
    setCurVp(() => ({
      scale: nextScale,
      tx: e.clientX - rect.left - wx * nextScale,
      ty: e.clientY - rect.top - wy * nextScale,
    }))
  }

  const zoomBy = (factor) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const { tx, ty, scale } = vp[view]
    const nextScale = Math.min(2, Math.max(0.35, scale * factor))
    const cx = rect.width / 2
    const cy = rect.height / 2
    const wx = (cx - tx) / scale
    const wy = (cy - ty) / scale
    setCurVp(() => ({ scale: nextScale, tx: cx - wx * nextScale, ty: cy - wy * nextScale }))
  }

  const resetView = () => {
    setVp((prev) => ({
      ...prev,
      [view]: view === 'opt' ? { tx: 0, ty: 24, scale: 0.78 } : { tx: 40, ty: 24, scale: 0.82 },
    }))
  }

  /* ----------------------------- CRUD ------------------------------------ */

  const addEntity = (form) => {
    const id = nextId(form.type.toLowerCase())
    const rect = canvasRef.current?.getBoundingClientRect()
    const center = rect ? screenToWorld(rect.left + rect.width / 2, rect.top + 160) : { x: 300, y: 160 }
    const node = {
      id,
      type: form.type,
      name: form.name?.trim() || TYPES[form.type].label,
      value: Number(form.value) || 0,
      x: center.x - NODE_W / 2,
      y: center.y,
    }
    if (form.type === 'PF') node.rendaAnual = Number(form.rendaAnual) || 0
    if (form.type === 'Imovel') {
      node.valorVenal = Number(form.valorVenal) || 0
      node.aluguelMensal = Number(form.aluguelMensal) || 0
      node.alugado = Number(form.aluguelMensal) > 0
    }
    if (form.type === 'PJ') {
      node.faturamento = Number(form.faturamento) || 0
      node.regime = form.regime || 'Lucro Presumido'
    }
    setNodes((ns) => [...ns, node])
    setSelectedNodeId(id)
    setPanel('edit')
  }

  const updateNode = (id, patch) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)))

  const deleteNode = (id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id))
    setSelectedNodeId(null)
    setPanel(null)
  }

  const updateEdgePct = (id, pct) =>
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, pct: Math.max(0, Math.min(100, Number(pct) || 0)) } : e)))

  const deleteEdge = (id) => {
    setEdges((es) => es.filter((e) => e.id !== id))
    setSelectedEdgeId(null)
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)

  /* =============================== Render =============================== */

  return (
    <div className="flex h-full w-full flex-col bg-slate-100 text-slate-800">
      {/* ----------------------------- Header ----------------------------- */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/40 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 font-bold text-slate-900 shadow">
            P
          </div>
          <div>
            <div className="flex items-center gap-2 text-base font-semibold leading-tight">
              <span>Patrimo</span>
              <span className="text-amber-400">·</span>
              <span className="font-normal text-slate-200">Estruturador Patrimonial</span>
            </div>
            <div className="text-xs text-slate-400">Família Andrade · Patrimônio consolidado {brl(seedTotal(nodes))}</div>
          </div>
        </div>

        {/* Toggle AS-IS / Otimizado */}
        <div className="flex items-center gap-1 rounded-full bg-slate-800 p-1 text-sm">
          <button
            onClick={() => setView('asis')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition ${
              view === 'asis' ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Estrutura Atual
          </button>
          <ArrowLeftRight size={15} className="mx-0.5 text-slate-500" />
          <button
            onClick={() => setView('opt')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition ${
              view === 'opt' ? 'bg-amber-500 text-slate-900 shadow' : 'text-amber-300 hover:text-amber-200'
            }`}
          >
            <Sparkles size={15} />
            Otimizada
          </button>
        </div>
      </header>

      {/* ----------------------------- Toolbar ---------------------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        {!isOpt ? (
          <>
            <button
              onClick={() => {
                setPanel('add')
                setSelectedNodeId(null)
              }}
              className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus size={16} /> Nova entidade
            </button>
            <button
              onClick={() => {
                setConnectMode((c) => !c)
                setPendingFrom(null)
              }}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                connectMode
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Link2 size={16} /> {connectMode ? 'Selecione 2 nós…' : 'Conectar'}
            </button>
            <div className="mx-1 h-5 w-px bg-slate-200" />
          </>
        ) : (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
            <ShieldCheck size={16} /> Estrutura proposta pelo motor de otimização — somente leitura
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <IconBtn onClick={() => zoomBy(1.15)} title="Aproximar">
            <ZoomIn size={16} />
          </IconBtn>
          <IconBtn onClick={() => zoomBy(0.87)} title="Afastar">
            <ZoomOut size={16} />
          </IconBtn>
          <IconBtn onClick={resetView} title="Reenquadrar">
            <Maximize2 size={16} />
          </IconBtn>
          <span className="ml-1 w-12 text-right text-xs tabular-nums text-slate-400">
            {Math.round(curVp.scale * 100)}%
          </span>
        </div>
      </div>

      {/* --------- Edição de aresta selecionada (faixa contextual) -------- */}
      {selectedEdge && !isOpt && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm">
          <span className="text-amber-900">
            Aresta <b>{nameOf(nodes, selectedEdge.from)}</b> → <b>{nameOf(nodes, selectedEdge.to)}</b>
          </span>
          <label className="flex items-center gap-1.5">
            Participação:
            <input
              type="number"
              min={0}
              max={100}
              value={selectedEdge.pct}
              onChange={(e) => updateEdgePct(selectedEdge.id, e.target.value)}
              className="w-20 rounded border border-amber-300 px-2 py-1 text-sm"
            />
            %
          </label>
          <button
            onClick={() => deleteEdge(selectedEdge.id)}
            className="flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-rose-700 hover:bg-rose-50"
          >
            <Trash2 size={14} /> Remover aresta
          </button>
        </div>
      )}

      {/* ------------------------- Área principal ------------------------- */}
      <div className="relative flex min-h-0 flex-1">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="patrimo-canvas relative min-h-0 flex-1 overflow-hidden"
          style={{
            backgroundColor: isOpt ? '#fbfaf6' : '#f1f5f9',
            backgroundImage:
              'radial-gradient(circle, rgba(15,23,42,0.10) 1px, transparent 1px)',
            backgroundSize: `${24 * curVp.scale}px ${24 * curVp.scale}px`,
            backgroundPosition: `${curVp.tx}px ${curVp.ty}px`,
            cursor: connectMode ? 'crosshair' : 'grab',
          }}
          onPointerDown={onPointerDownCanvas}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {/* mundo transformado */}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${curVp.tx}px, ${curVp.ty}px) scale(${curVp.scale})` }}
          >
            {/* Arestas (SVG) */}
            <svg
              className="pointer-events-none absolute left-0 top-0 overflow-visible"
              width={2400}
              height={1400}
            >
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
                </marker>
              </defs>
              {activeEdges.map((e) => {
                const a = nodeById[e.from]
                const b = nodeById[e.to]
                if (!a || !b) return null
                const mid = edgeMid(a, b)
                const isSel = e.id === selectedEdgeId
                return (
                  <g key={e.id}>
                    <path
                      d={elbowPath(a, b)}
                      fill="none"
                      stroke={isSel ? '#d97706' : isOpt ? '#b08d57' : '#94a3b8'}
                      strokeWidth={isSel ? 2.5 : 1.6}
                      markerEnd="url(#arrow)"
                      className={!isOpt ? 'pointer-events-auto cursor-pointer' : ''}
                      onPointerDown={(ev) => {
                        if (isOpt) return
                        ev.stopPropagation()
                        setSelectedEdgeId(e.id)
                        setSelectedNodeId(null)
                      }}
                    />
                    {/* rótulo de % */}
                    <g
                      transform={`translate(${mid.x}, ${mid.y})`}
                      className={!isOpt ? 'pointer-events-auto cursor-pointer' : ''}
                      onPointerDown={(ev) => {
                        if (isOpt) return
                        ev.stopPropagation()
                        setSelectedEdgeId(e.id)
                        setSelectedNodeId(null)
                      }}
                    >
                      <rect x={-20} y={-11} width={40} height={22} rx={5} fill="white" stroke="#cbd5e1" />
                      <text x={0} y={4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#334155">
                        {e.pct}%
                      </text>
                    </g>
                  </g>
                )
              })}
            </svg>

            {/* Badges de economia tributária (painel otimizado) */}
            {isOpt &&
              optimized.badges
                .filter((b) => b.anchor === 'edge')
                .map((b, i) => {
                  const e = activeEdges.find((x) => x.id === b.edgeId)
                  if (!e) return null
                  const a = nodeById[e.from]
                  const c = nodeById[e.to]
                  if (!a || !c) return null
                  const mid = edgeMid(a, c)
                  const stack = optimized.badges
                    .filter((z) => z.anchor === 'edge' && z.edgeId === b.edgeId)
                    .indexOf(b)
                  return (
                    <Badge
                      key={`be-${i}`}
                      kind={b.kind}
                      text={b.text}
                      style={{ left: mid.x + 26, top: mid.y - 12 + stack * 26 }}
                    />
                  )
                })}

            {/* Nós */}
            {activeNodes.map((n) => {
              const nodeBadges = isOpt
                ? optimized.badges.filter((b) => b.anchor === 'node' && b.nodeId === n.id)
                : []
              return (
                <NodeBox
                  key={n.id}
                  node={n}
                  selected={n.id === selectedNodeId}
                  pending={pendingFrom === n.id}
                  connectMode={connectMode && !isOpt}
                  isHolding={n.type === 'Holding'}
                  badges={nodeBadges}
                  onPointerDown={(e) => onPointerDownNode(e, n)}
                />
              )
            })}
          </div>

          {/* Legenda flutuante */}
          <Legend />
        </div>

        {/* ----------------------- Painel lateral ------------------------ */}
        {panel && !isOpt && (
          <SidePanel
            mode={panel}
            node={selectedNode}
            onClose={() => setPanel(null)}
            onAdd={addEntity}
            onUpdate={updateNode}
            onDelete={deleteNode}
          />
        )}
      </div>

      {/* ----------------------- Rodapé comparativo (RF5) ----------------- */}
      <FooterCompare tax={tax} view={view} />
    </div>
  )
}

/* ============================ Subcomponentes ============================= */

function seedTotal(nodes) {
  return nodes.reduce((s, n) => s + (n.value || 0), 0)
}

function nameOf(nodes, id) {
  return nodes.find((n) => n.id === id)?.name || '—'
}

function IconBtn({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
    >
      {children}
    </button>
  )
}

function NodeBox({ node, selected, pending, connectMode, isHolding, badges, onPointerDown }) {
  const t = TYPES[node.type] || TYPES.PJ
  const Icon = t.icon
  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute select-none rounded-xl border-2 shadow-sm transition-shadow ${t.box} ${
        selected ? 'ring-2 ring-offset-2 ring-amber-500' : ''
      } ${pending ? 'ring-2 ring-sky-500' : ''} ${connectMode ? 'cursor-crosshair' : 'cursor-grab'} ${
        isHolding ? 'shadow-lg shadow-amber-200' : ''
      }`}
      style={{ left: node.x, top: node.y, width: NODE_W, minHeight: NODE_H }}
    >
      {/* barra de acento por tipo */}
      <div className={`h-1.5 w-full rounded-t-lg ${t.accentBar}`} />
      <div className="flex items-start gap-2 px-3 py-2">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${t.dot} text-white`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${t.head}`}>
            {t.label}
            {isHolding && <Crown size={11} className="ml-1 inline text-amber-500" />}
          </div>
          <div className="truncate text-sm font-semibold text-slate-800" title={node.name}>
            {node.name}
          </div>
          <div className="text-xs text-slate-500">
            {node.type === 'PF'
              ? node.rendaAnual
                ? `Renda ${brl(node.rendaAnual)}/ano`
                : 'Membro da família'
              : node.type === 'Imovel'
                ? node.alugado
                  ? `${brl(node.value)} · aluga ${brl(node.aluguelMensal)}/mês`
                  : `${brl(node.value)} · uso próprio`
                : brl(node.value)}
          </div>
        </div>
      </div>

      {/* badges ancoradas ao nó (ex.: Holding) */}
      {badges && badges.length > 0 && (
        <div className="absolute left-0 top-full mt-1 flex w-[230px] flex-col gap-1">
          {badges.map((b, i) => (
            <InlineBadge key={i} kind={b.kind} text={b.text} />
          ))}
        </div>
      )}
    </div>
  )
}

const BADGE_STYLE = {
  itbi: 'bg-emerald-600 text-white',
  ir: 'bg-emerald-500 text-white',
  itcmd: 'bg-teal-700 text-white',
  reforma: 'bg-slate-700 text-white',
}

function Badge({ kind, text, style }) {
  return (
    <div
      className={`absolute z-10 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow ${
        BADGE_STYLE[kind] || 'bg-emerald-600 text-white'
      }`}
      style={style}
    >
      {text}
    </div>
  )
}

function InlineBadge({ kind, text }) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold shadow-sm ${
        BADGE_STYLE[kind] || 'bg-emerald-600 text-white'
      }`}
    >
      <ShieldCheck size={12} /> {text}
    </div>
  )
}

function Legend() {
  const items = [
    ['PF', 'Pessoa Física'],
    ['Holding', 'Holding'],
    ['PJ', 'PJ Operacional'],
    ['Imovel', 'Imóvel'],
    ['Investimento', 'Investimento'],
  ]
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
      {items.map(([k, label]) => (
        <div key={k} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${TYPES[k].dot}`} />
          <span className="text-slate-600">{label}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------- Painel lateral ----------------------------- */

function SidePanel({ mode, node, onClose, onAdd, onUpdate, onDelete }) {
  if (mode === 'edit' && node) {
    return (
      <EditPanel key={node.id} node={node} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />
    )
  }
  return <AddPanel onClose={onClose} onAdd={onAdd} />
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'

function AddPanel({ onClose, onAdd }) {
  const [form, setForm] = useState({
    type: 'Imovel',
    name: '',
    value: '',
    rendaAnual: '',
    valorVenal: '',
    aluguelMensal: '',
    faturamento: '',
    regime: 'Lucro Presumido',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <PanelShell title="Nova entidade" onClose={onClose}>
      <Field label="Tipo">
        <div className="grid grid-cols-2 gap-1.5">
          {ENTITY_TYPE_OPTIONS.map((t) => {
            const T = TYPES[t]
            const Icon = T.icon
            const active = form.type === t
            return (
              <button
                key={t}
                onClick={() => set('type', t)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                  active ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded ${T.dot} text-white`}>
                  <Icon size={12} />
                </span>
                {T.label}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Nome / descrição">
        <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Apartamento Jardins" />
      </Field>

      {form.type !== 'PF' && (
        <Field label="Valor estimado (R$)">
          <input className={inputCls} type="number" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder="0" />
        </Field>
      )}

      {form.type === 'PF' && (
        <Field label="Renda anual (R$)">
          <input className={inputCls} type="number" value={form.rendaAnual} onChange={(e) => set('rendaAnual', e.target.value)} placeholder="0" />
        </Field>
      )}

      {form.type === 'Imovel' && (
        <>
          <Field label="Valor venal (R$)">
            <input className={inputCls} type="number" value={form.valorVenal} onChange={(e) => set('valorVenal', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Aluguel mensal (R$) — 0 se uso próprio">
            <input className={inputCls} type="number" value={form.aluguelMensal} onChange={(e) => set('aluguelMensal', e.target.value)} placeholder="0" />
          </Field>
        </>
      )}

      {form.type === 'PJ' && (
        <>
          <Field label="Faturamento anual (R$)">
            <input className={inputCls} type="number" value={form.faturamento} onChange={(e) => set('faturamento', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Regime tributário">
            <select className={inputCls} value={form.regime} onChange={(e) => set('regime', e.target.value)}>
              <option>Lucro Presumido</option>
              <option>Lucro Real</option>
              <option>Simples Nacional</option>
            </select>
          </Field>
        </>
      )}

      <button
        onClick={() => onAdd(form)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        <Plus size={16} /> Adicionar ao canvas
      </button>
      <p className="text-xs text-slate-400">
        Dica: depois clique em <b>Conectar</b> e selecione dois nós para criar a aresta de participação.
      </p>
    </PanelShell>
  )
}

function EditPanel({ node, onClose, onUpdate, onDelete }) {
  const T = TYPES[node.type]
  return (
    <PanelShell title="Editar entidade" onClose={onClose} icon={<Pencil size={15} />}>
      <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
        <span className={`flex h-6 w-6 items-center justify-center rounded ${T.dot} text-white`}>
          <T.icon size={14} />
        </span>
        <span className="font-medium text-slate-700">{T.label}</span>
      </div>

      <Field label="Nome / descrição">
        <input className={inputCls} value={node.name} onChange={(e) => onUpdate(node.id, { name: e.target.value })} />
      </Field>

      {node.type !== 'PF' && (
        <Field label="Valor estimado (R$)">
          <input className={inputCls} type="number" value={node.value} onChange={(e) => onUpdate(node.id, { value: Number(e.target.value) || 0 })} />
        </Field>
      )}

      {node.type === 'PF' && (
        <Field label="Renda anual (R$)">
          <input className={inputCls} type="number" value={node.rendaAnual || 0} onChange={(e) => onUpdate(node.id, { rendaAnual: Number(e.target.value) || 0 })} />
        </Field>
      )}

      {node.type === 'Imovel' && (
        <>
          <Field label="Valor venal (R$)">
            <input className={inputCls} type="number" value={node.valorVenal || 0} onChange={(e) => onUpdate(node.id, { valorVenal: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Aluguel mensal (R$) — 0 se uso próprio">
            <input
              className={inputCls}
              type="number"
              value={node.aluguelMensal || 0}
              onChange={(e) => {
                const v = Number(e.target.value) || 0
                onUpdate(node.id, { aluguelMensal: v, alugado: v > 0 })
              }}
            />
          </Field>
        </>
      )}

      {node.type === 'PJ' && (
        <Field label="Faturamento anual (R$)">
          <input className={inputCls} type="number" value={node.faturamento || 0} onChange={(e) => onUpdate(node.id, { faturamento: Number(e.target.value) || 0 })} />
        </Field>
      )}

      <button
        onClick={() => onDelete(node.id)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
      >
        <Trash2 size={15} /> Excluir entidade
      </button>
    </PanelShell>
  )
}

function PanelShell({ title, children, onClose, icon }) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon} {title}
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">{children}</div>
    </aside>
  )
}

/* --------------------------- Rodapé comparativo -------------------------- */

function FooterCompare({ tax, view }) {
  const pct = tax.irAsIs > 0 ? Math.round((tax.irEconomiaAnual / tax.irAsIs) * 100) : 0
  return (
    <footer className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 text-sm md:grid-cols-4">
      <Metric
        label="Carga recorrente · Atual"
        value={brl(tax.irAsIs)}
        sub="IRPF sobre aluguéis (a.a.)"
        tone="neutral"
        active={view === 'asis'}
      />
      <Metric
        label="Carga recorrente · Otimizada"
        value={brl(tax.irOpt)}
        sub="Lucro presumido via Holding (a.a.)"
        tone="good"
        active={view === 'opt'}
      />
      <Metric
        label="Economia anual recorrente"
        value={brl(tax.irEconomiaAnual)}
        sub={`${pct}% sobre a carga atual`}
        tone="good"
        emphasize
      />
      <Metric
        label="Economia sucessória (one-time)"
        value={brl(tax.economiaUnica)}
        sub="ITBI imune + ITCMD/inventário"
        tone="gold"
        emphasize
      />
    </footer>
  )
}

function Metric({ label, value, sub, tone, emphasize, active }) {
  const toneCls =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'gold'
        ? 'text-amber-600'
        : 'text-slate-700'
  return (
    <div className={`bg-white px-4 py-3 ${active ? 'ring-1 ring-inset ring-amber-300' : ''}`}>
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {emphasize && <Info size={11} />}
        {label}
      </div>
      <div className={`mt-0.5 text-xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  )
}
