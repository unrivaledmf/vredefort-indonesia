import React, { useRef, useEffect, useState } from 'react';
import {
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  ArrowRight,
  BookOpen,
  Lock,
  Eye
} from 'lucide-react';
import { api } from '../services/api.ts';
import { GraphData } from '../types.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Button } from '../components/ui/Button.tsx';

interface NodePosition {
  id: string;
  label: string;
  type: 'project' | 'note' | 'file' | 'task' | 'reference';
  color: string;
  radius: number;
  targetId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface KnowledgeGraphViewProps {
  onNavigate: (view: string, targetId?: string) => void;
  onPreviewFile?: (fileId: string) => void;
  onOpenNote?: (noteId: string) => void;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  onNavigate,
  onPreviewFile,
  onOpenNote
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isGuest = user?.role === 'guest';

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [selectedNode, setSelectedNode] = useState<NodePosition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleTypes, setVisibleTypes] = useState({
    project: true,
    note: true,
    file: true,
    task: true,
    reference: true
  });

  // Logical dimension ref
  const logicalSizeRef = useRef({ width: 800, height: 600 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const nodesRef = useRef<NodePosition[]>([]);
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<NodePosition | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Handle ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCanvasSize = (w: number, h: number) => {
      const width = Math.max(200, Math.floor(w));
      const height = Math.max(200, Math.floor(h));
      logicalSizeRef.current = { width, height };

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvasRef.current) {
        canvasRef.current.width = Math.round(width * dpr);
        canvasRef.current.height = Math.round(height * dpr);
      }
    };

    const rect = container.getBoundingClientRect();
    updateCanvasSize(rect.width, rect.height);

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          updateCanvasSize(width, height);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Fetch graph data
  useEffect(() => {
    api.getGraph()
      .then(data => {
        setGraphData(data);
        setNodeCount(data.nodes.length);
        const { width, height } = logicalSizeRef.current;
        const cx = width / 2;
        const cy = height / 2;

        const nodes: NodePosition[] = data.nodes.map((n, i) => {
          const angle = (i / Math.max(1, data.nodes.length)) * 2 * Math.PI;
          const dist = 60 + Math.random() * 120;
          return {
            ...n,
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2
          };
        });
        nodesRef.current = nodes;
      })
      .catch(err => console.error('Error fetching graph:', err));
  }, []);

  // Simulation & rendering loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const simulateAndDraw = () => {
      const nodes = nodesRef.current;
      const links = graphData?.links || [];
      const { width, height } = logicalSizeRef.current;
      const cx = width / 2;
      const cy = height / 2;

      // (g) Map id -> node per frame
      const nodeMap = new Map<string, NodePosition>();
      for (const node of nodes) {
        nodeMap.set(node.id, node);
      }

      // (c) Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);

          // Handle distance ~0 with random jitter
          if (dist < 0.1) {
            dx = (Math.random() - 0.5) * 0.5;
            dy = (Math.random() - 0.5) * 0.5;
            dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          }

          if (dist < 220) {
            // Normalized and bounded (max strength 0.9)
            const rawForce = ((220 - dist) / 220) * 0.9;
            const force = Math.min(rawForce, 0.9);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (draggedNodeRef.current?.id !== a.id) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (draggedNodeRef.current?.id !== b.id) {
              b.vx += fx;
              b.vy += fy;
            }
          }
        }
      }

      // (d) Spring force along links: target length 110, k = 0.004
      for (const link of links) {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        if (sourceNode && targetNode) {
          let dx = targetNode.x - sourceNode.x;
          let dy = targetNode.y - sourceNode.y;
          let dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 0.1) {
            dx = (Math.random() - 0.5) * 0.5;
            dy = (Math.random() - 0.5) * 0.5;
            dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          }

          const displacement = dist - 110;
          const force = displacement * 0.004;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (draggedNodeRef.current?.id !== sourceNode.id) {
            sourceNode.vx += fx;
            sourceNode.vy += fy;
          }
          if (draggedNodeRef.current?.id !== targetNode.id) {
            targetNode.vx -= fx;
            targetNode.vy -= fy;
          }
        }
      }

      // (e) Center gravity 0.0015, speed limit 12, damping 0.82
      for (const node of nodes) {
        // (f) Reset NaN / non-finite coordinates to near center
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
          node.x = cx + (Math.random() - 0.5) * 60;
          node.y = cy + (Math.random() - 0.5) * 60;
          node.vx = 0;
          node.vy = 0;
        }
        if (!Number.isFinite(node.vx)) node.vx = 0;
        if (!Number.isFinite(node.vy)) node.vy = 0;

        if (draggedNodeRef.current?.id === node.id) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        node.vx += (cx - node.x) * 0.0015;
        node.vy += (cy - node.y) * 0.0015;

        // Speed limit 12
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > 12) {
          node.vx = (node.vx / speed) * 12;
          node.vy = (node.vy / speed) * 12;
        }

        node.x += node.vx;
        node.y += node.vy;

        // Damping 0.82
        node.vx *= 0.82;
        node.vy *= 0.82;
      }

      // Clear & Draw
      const isDark = theme === 'dark';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = isDark ? '#070A10' : '#F8FAFC';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply DPI scale + user Pan/Zoom
      ctx.scale(dpr, dpr);
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.scale, transformRef.current.scale);

      // Draw Links
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)';
      ctx.lineWidth = 1.2;
      for (const link of links) {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        if (
          sourceNode &&
          targetNode &&
          visibleTypes[sourceNode.type] &&
          visibleTypes[targetNode.type]
        ) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
        }
      }

      // Draw Nodes
      for (const node of nodes) {
        if (!visibleTypes[node.type]) continue;
        const isMatch =
          searchQuery &&
          node.label.toLowerCase().includes(searchQuery.toLowerCase());
        const isSelected = selectedNode?.id === node.id;

        // Node Halo for selected or matched
        if (isSelected || isMatch) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected
            ? 'rgba(245, 158, 11, 0.3)'
            : 'rgba(6, 182, 212, 0.3)';
          ctx.fill();
        }

        // Main Node Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.stroke();

        // Node Label
        ctx.fillStyle = isDark
          ? (isSelected ? '#ffffff' : '#cbd5e1')
          : (isSelected ? '#0f172a' : '#334155');
        ctx.font = isSelected
          ? '600 11px sans-serif'
          : '500 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          node.label.length > 20 ? `${node.label.substring(0, 18)}...` : node.label,
          node.x,
          node.y + node.radius + 14
        );
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(simulateAndDraw);
    };

    animationFrameId = requestAnimationFrame(simulateAndDraw);
    return () => cancelAnimationFrame(animationFrameId);
  }, [graphData, visibleTypes, selectedNode, searchQuery, theme]);

  // (h) Mouse events using logical coordinates
  const getLogicalMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { mouseX: 0, mouseY: 0 };
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.scale;
    const mouseY = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.scale;
    return { mouseX, mouseY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { mouseX, mouseY } = getLogicalMouseCoords(e);

    const clickedNode = nodesRef.current.find(n => {
      if (!visibleTypes[n.type]) return false;
      const dx = n.x - mouseX;
      const dy = n.y - mouseY;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      const { mouseX, mouseY } = getLogicalMouseCoords(e);
      draggedNodeRef.current.x = mouseX;
      draggedNodeRef.current.y = mouseY;
    } else if (isDraggingCanvasRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
    isDraggingCanvasRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(transformRef.current.scale * zoomFactor, 0.4), 3.0);
    transformRef.current.scale = newScale;
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 1.2 : 0.8;
    const newScale = Math.min(Math.max(transformRef.current.scale * factor, 0.4), 3.0);
    transformRef.current.scale = newScale;
  };

  const handleResetZoom = () => {
    transformRef.current = { x: 0, y: 0, scale: 1 };
  };

  const handleOpenItem = (node: NodePosition) => {
    if (isGuest) return;
    if (node.type === 'project') {
      onNavigate('projects', node.targetId);
    } else if (node.type === 'note') {
      if (onOpenNote) onOpenNote(node.targetId);
      else onNavigate('notes', node.targetId);
    } else if (node.type === 'file') {
      if (onPreviewFile) onPreviewFile(node.targetId);
      else onNavigate('files', node.targetId);
    } else if (node.type === 'task') {
      onNavigate('kanban', node.targetId);
    } else if (node.type === 'reference') {
      onNavigate('references', node.targetId);
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-3.5rem)] w-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-neutral-900 dark:text-slate-100 relative transition-colors"
    >
      {/* Top Floating Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Title & Stats - (j) Node count from state */}
        <div className="pointer-events-auto bg-white/90 dark:bg-slate-900/90 border border-neutral-200 dark:border-slate-800 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-md dark:shadow-xl flex items-center gap-3">
          <Share2 className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                Peta Hubungan Kerja
              </h2>
              {isGuest && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                  Mode Tamu
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-slate-400 ">
              {nodeCount} Entitas · {graphData?.links.length || 0} Relasi
            </p>
          </div>
        </div>

        {/* Filter Badges & Search */}
        <div className="pointer-events-auto flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 border border-neutral-200 dark:border-slate-800 backdrop-blur-md p-1.5 rounded-xl shadow-md dark:shadow-xl">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari node..."
              className="pl-8 pr-2.5 py-1 text-xs rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-slate-400 focus:outline-none w-28 sm:w-44 focus-visible:ring-2 focus-visible:ring-amber-500"
            />
          </div>

          {/* Toggle Type Visibility */}
          <button
            type="button"
            onClick={() => setVisibleTypes(p => ({ ...p, project: !p.project }))}
            className={`px-2 py-1 text-[11px] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
              visibleTypes.project
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 font-semibold'
                : 'bg-neutral-100 dark:bg-slate-800 text-neutral-400 dark:text-slate-400 opacity-60'
            }`}
          >
            Project
          </button>
          <button
            type="button"
            onClick={() => setVisibleTypes(p => ({ ...p, note: !p.note }))}
            className={`px-2 py-1 text-[11px] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
              visibleTypes.note
                ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/40 font-semibold'
                : 'bg-neutral-100 dark:bg-slate-800 text-neutral-400 dark:text-slate-400 opacity-60'
            }`}
          >
            Note
          </button>
          <button
            type="button"
            onClick={() => setVisibleTypes(p => ({ ...p, file: !p.file }))}
            className={`px-2 py-1 text-[11px] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
              visibleTypes.file
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 font-semibold'
                : 'bg-neutral-100 dark:bg-slate-800 text-neutral-400 dark:text-slate-400 opacity-60'
            }`}
          >
            File
          </button>
          <button
            type="button"
            onClick={() => setVisibleTypes(p => ({ ...p, task: !p.task }))}
            className={`px-2 py-1 text-[11px] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
              visibleTypes.task
                ? 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/40 font-semibold'
                : 'bg-neutral-100 dark:bg-slate-800 text-neutral-400 dark:text-slate-400 opacity-60'
            }`}
          >
            Task
          </button>
          {/* (i) Referensi filter button in toolbar */}
          <button
            type="button"
            onClick={() => setVisibleTypes(p => ({ ...p, reference: !p.reference }))}
            className={`px-2 py-1 text-[11px] rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 ${
              visibleTypes.reference
                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/40 font-semibold'
                : 'bg-neutral-100 dark:bg-slate-800 text-neutral-400 dark:text-slate-400 opacity-60'
            }`}
          >
            Referensi
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="pointer-events-auto flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 border border-neutral-200 dark:border-slate-800 backdrop-blur-md p-1.5 rounded-xl shadow-md dark:shadow-xl">
          <button
            type="button"
            onClick={() => handleZoom('in')}
            className="p-1.5 text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Perbesar"
            aria-label="Perbesar tampilan graf"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom('out')}
            className="p-1.5 text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Perkecil"
            aria-label="Perkecil tampilan graf"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Reset View"
            aria-label="Reset zoom tampilan graf"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
        aria-label="Kanvas interaktif knowledge graph pertambangan"
      />

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="absolute bottom-6 right-6 z-20 w-80 bg-white/95 dark:bg-slate-900/95 border border-neutral-200 dark:border-slate-800 backdrop-blur-md p-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-150">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span
              className="px-2 py-0.5 text-[11px] font-bold uppercase rounded "
              style={{
                backgroundColor: `${selectedNode.color}25`,
                color: selectedNode.color,
                border: `1px solid ${selectedNode.color}50`
              }}
            >
              {selectedNode.type}
            </span>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white text-xs p-1"
              aria-label="Tutup detail node"
            >
              Tutup
            </button>
          </div>

          <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2 leading-snug">
            {selectedNode.label}
          </h3>

          <p className="text-xs text-neutral-600 dark:text-slate-400 mb-4 leading-relaxed">
            {isGuest
              ? 'Node ini menampilkan relasi kerja dalam perencanaan tambang. Akses membuka file atau catatan langsung dibatasi dalam mode tamu.'
              : 'Node ini terhubung dalam jejaring data perencanaan tambang. Klik tombol di bawah untuk membuka item secara langsung.'}
          </p>

          {isGuest ? (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-100 dark:bg-slate-800 text-neutral-500 dark:text-slate-400 text-xs font-medium">
              <Lock className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>Akses membuka dibatasi (hanya pratinjau visual).</span>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenItem(selectedNode)}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              className="w-full"
            >
              Buka Item Ini
            </Button>
          )}
        </div>
      )}

      {/* Legend at bottom left */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 bg-white/90 dark:bg-slate-900/80 border border-neutral-200 dark:border-slate-800/80 px-3 py-1.5 rounded-xl text-[11px] text-neutral-600 dark:text-slate-400 shadow-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Project
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Note
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> File
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Task
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Referensi
        </span>
      </div>
    </div>
  );
};
