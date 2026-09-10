import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const roadmapModules = import.meta.glob("../data/roadmaps/*.json", {
  eager: true,
  import: "default",
});

const ROADMAPS_API = "/api/roadmaps";
const ACTIVE_ROADMAP_STORAGE_KEY = "readmap-active-roadmap";
const EMPTY_ROADMAP_ID = "__empty__";
const NODE_WIDTH = 340;
const COLUMN_GAP = 72;
const VERTICAL_GAP = 24;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roadmapValidationError(value) {
  if (!value || !value.meta || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return "缺少 meta、nodes 或 edges。";
  if (typeof value.meta.id !== "string" || !value.meta.id.trim() || typeof value.meta.title !== "string" || !value.meta.title.trim()) return "meta.id 和 meta.title 必须是非空文本。";
  const nodeIds = new Set();
  const resourceIds = new Set();
  const usesResourceRegistry = Array.isArray(value.resources);

  if (usesResourceRegistry) {
    for (const resource of value.resources) {
      if (!resource || typeof resource.id !== "string" || !resource.id.trim() || typeof resource.title !== "string" || !resource.title.trim()) return "resources 中含有不完整的资料信息。";
      if (resourceIds.has(resource.id)) return "资料 id 重复：" + resource.id;
      resourceIds.add(resource.id);
    }
  }

  for (const node of value.nodes) {
    if (!node || typeof node.id !== "string" || !node.id.trim() || typeof node.title !== "string" || !Array.isArray(node.resources)) return "每个节点都需要 id、title 与 resources 列表。";
    if (nodeIds.has(node.id)) return "节点 id 重复：" + node.id;
    nodeIds.add(node.id);
    for (const resource of node.resources) {
      if (usesResourceRegistry) {
        if (typeof resource !== "string" || !resourceIds.has(resource)) return "节点“" + node.title + "”引用了不存在的资料：" + resource;
      } else {
        if (!resource || typeof resource.id !== "string" || !resource.id.trim() || typeof resource.title !== "string" || !resource.title.trim()) return "节点“" + node.title + "”含有不完整的资料信息。";
        if (resourceIds.has(resource.id)) return "资料 id 重复：" + resource.id;
        resourceIds.add(resource.id);
      }
    }
  }
  const verifyEdges = (edges, name) => {
    if (!Array.isArray(edges)) return name + " 必须是数组。";
    for (const edge of edges) {
      if (!edge || !nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) return name + " 含有无效节点引用。";
    }
    return "";
  };
  const hardEdgeError = verifyEdges(value.edges, "edges");
  if (hardEdgeError) return hardEdgeError;

  const indegree = new Map(value.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(value.nodes.map((node) => [node.id, []]));
  value.edges.forEach((edge) => {
    indegree.set(edge.to, indegree.get(edge.to) + 1);
    outgoing.get(edge.from).push(edge.to);
  });
  const queue = value.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited += 1;
    outgoing.get(id).forEach((nextId) => {
      indegree.set(nextId, indegree.get(nextId) - 1);
      if (indegree.get(nextId) === 0) queue.push(nextId);
    });
  }
  return visited === value.nodes.length ? "" : "edges 中存在循环依赖，无法进行拓扑排序。";
}

function isRoadmap(value) {
  return !roadmapValidationError(value);
}

function normalizeRoadmap(value) {
  const normalizeResource = (resource) => ({
    id: resource.id.trim(),
    title: resource.title.trim(),
    url: typeof resource.url === "string" ? resource.url.trim() : "",
    read: Boolean(resource.read),
  });
  const resourceRegistry = new Map((Array.isArray(value.resources) ? value.resources : []).map((resource) => [resource.id, normalizeResource(resource)]));

  return {
    meta: { id: value.meta.id.trim(), title: value.meta.title.trim() },
    nodes: value.nodes.map((node) => ({
      id: node.id.trim(),
      title: node.title.trim(),
      resources: node.resources.map((resource) => clone(typeof resource === "string" ? resourceRegistry.get(resource) : normalizeResource(resource))),
    })),
    edges: value.edges.map((edge) => ({ from: edge.from, to: edge.to })),
  };
}

function roadmapSummary(roadmap) {
  return {
    id: roadmap.meta.id,
    title: roadmap.meta.title,
  };
}

const bundledRoadmaps = Object.entries(roadmapModules)
  .map(([filePath, value]) => {
    const fileId = filePath.split("/").pop()?.replace(/\.json$/i, "");
    if (roadmapValidationError(value) || value.meta.id !== fileId) return null;
    return normalizeRoadmap(value);
  })
  .filter(Boolean)
  .sort((a, b) => a.meta.title.localeCompare(b.meta.title, "zh-CN"));

const emptyRoadmap = {
  meta: { id: EMPTY_ROADMAP_ID, title: "暂无 Roadmap" },
  nodes: [],
  edges: [],
};

function readSavedRoadmap() {
  const savedId = window.localStorage.getItem(ACTIVE_ROADMAP_STORAGE_KEY);
  const savedRoadmap = bundledRoadmaps.find((item) => item.meta.id === savedId);
  return clone(savedRoadmap || bundledRoadmaps[0] || emptyRoadmap);
}

function allResources(roadmap) {
  const uniqueResources = new Map();
  roadmap.nodes.forEach((node) => node.resources.forEach((resource) => {
    if (!uniqueResources.has(resource.id)) uniqueResources.set(resource.id, { ...resource, nodeId: node.id });
  }));
  return Array.from(uniqueResources.values());
}

function defaultProgress(roadmap) {
  return Object.fromEntries(allResources(roadmap).map((resource) => [resource.id, Boolean(resource.read)]));
}

function readSavedProgress(roadmap) {
  return defaultProgress(roadmap);
}

function roadmapWithProgress(roadmap, progress) {
  const resources = allResources(roadmap).map(({ nodeId: _nodeId, ...resource }) => ({
    ...resource,
    read: Boolean(progress[resource.id]),
  }));
  return {
    meta: roadmap.meta,
    resources,
    nodes: roadmap.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      resources: node.resources.map((resource) => resource.id),
    })),
    edges: roadmap.edges,
  };
}

function nodeStats(node, progress) {
  const total = node.resources.length;
  const read = node.resources.filter((resource) => progress[resource.id]).length;
  return { total, read, percent: total ? Math.round((read / total) * 100) : 0 };
}

function fallbackNodeHeight(node, editable, isExpanded) {
  const lines = (value, charactersPerLine) => Math.max(1, Math.ceil(Array.from(String(value || "")).length / charactersPerLine));
  if (!isExpanded) return 36 + lines(node.title, 16) * 25;
  const titleExtra = Math.max(0, lines(node.title, 20) - 2) * 21;
  const resourceExtra = node.resources.reduce((total, resource) => total + Math.max(0, lines(resource.title, editable ? 25 : 30) - 1) * 21, 0);
  return 136 + node.resources.length * (editable ? 90 : 70) + (editable ? 62 : 0) + titleExtra + resourceExtra;
}

function calculateTopology(roadmap, viewportWidth, editable, expandedNodeIds, measuredHeights = {}) {
  const nodeMap = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const sourceIndex = new Map(roadmap.nodes.map((node, index) => [node.id, index]));
  const compareNodes = (a, b) => sourceIndex.get(a.id) - sourceIndex.get(b.id);
  const outgoing = new Map(roadmap.nodes.map((node) => [node.id, []]));
  const indegree = new Map(roadmap.nodes.map((node) => [node.id, 0]));

  roadmap.edges.forEach((edge) => {
    if (!outgoing.has(edge.from) || !indegree.has(edge.to)) return;
    outgoing.get(edge.from).push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to) + 1);
  });

  const queue = roadmap.nodes
    .filter((node) => indegree.get(node.id) === 0)
    .sort(compareNodes);
  const levels = new Map(queue.map((node) => [node.id, 0]));

  // Kahn's algorithm gives every node its dependency depth.
  while (queue.length) {
    const current = queue.shift();
    const nextLevel = (levels.get(current.id) || 0) + 1;
    outgoing.get(current.id).forEach((nextId) => {
      levels.set(nextId, Math.max(levels.get(nextId) || 0, nextLevel));
      indegree.set(nextId, indegree.get(nextId) - 1);
      if (indegree.get(nextId) === 0) queue.push(nodeMap.get(nextId));
    });
    queue.sort(compareNodes);
  }

  // Keep a cycle visible at the end so an agent can repair the edge data.
  const maxLevel = Math.max(-1, ...levels.values());
  roadmap.nodes.forEach((node) => {
    if (!levels.has(node.id)) levels.set(node.id, maxLevel + 1);
  });

  const columns = new Map();
  roadmap.nodes.forEach((node) => {
    const level = levels.get(node.id);
    if (!columns.has(level)) columns.set(level, []);
    columns.get(level).push(node);
  });
  columns.forEach((column) => column.sort(compareNodes));

  const isExpanded = (node) => expandedNodeIds.has(node.id);
  const nodeHeight = (node) => {
    const measurement = measuredHeights[node.id];
    return measurement?.expanded === isExpanded(node)
      ? measurement.height
      : fallbackNodeHeight(node, editable, isExpanded(node));
  };
  const columnHeight = (column) => column.reduce((sum, node) => sum + nodeHeight(node), 0) + VERTICAL_GAP * Math.max(0, column.length - 1);
  const stageHeight = Math.max(600, Math.max(0, ...Array.from(columns.values()).map(columnHeight)) + 86);
  const lastLevel = Math.max(0, ...columns.keys());
  const stageWidth = Math.max(viewportWidth - 84, (lastLevel + 1) * NODE_WIDTH + lastLevel * COLUMN_GAP + 96);
  const positions = new Map();

  columns.forEach((column, level) => {
    let y = Math.max(38, (stageHeight - columnHeight(column)) / 2);
    column.forEach((node) => {
      positions.set(node.id, { x: 48 + level * (NODE_WIDTH + COLUMN_GAP), y, width: NODE_WIDTH, height: nodeHeight(node), level });
      y += nodeHeight(node) + VERTICAL_GAP;
    });
  });

  return { columns, positions, stageHeight, stageWidth, columnGap: COLUMN_GAP };
}

function nodeStatus(node, roadmap, progress, stats) {
  if (stats.read === stats.total && stats.total > 0) return "complete";
  if (stats.read > 0) return "in-progress";
  const prerequisitesDone = roadmap.edges
    .filter((edge) => edge.to === node.id)
    .every((edge) => {
      const prerequisite = roadmap.nodes.find((candidate) => candidate.id === edge.from);
      if (!prerequisite) return false;
      const prerequisiteStats = nodeStats(prerequisite, progress);
      return prerequisiteStats.total > 0 && prerequisiteStats.read === prerequisiteStats.total;
    });
  return prerequisitesDone ? "ready" : "blocked";
}

function statusLabel(status) {
  return { complete: "已完成", "in-progress": "进行中", ready: "可开始", blocked: "等待前置节点" }[status] || "等待前置节点";
}

function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "item";
}

function uniqueId(base, usedIds) {
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

function NodeCard({ node, stats, status, position, selected, muted, editable, expanded, progress, onSelect, onToggleDetails, onToggleResource, onEdit, onDelete, onAddResource, onEditResource, onDeleteResource }) {
  return (
    <article
      className={`roadmap-node is-${status}${expanded ? " is-expanded" : " is-compact"}${selected ? " is-selected" : ""}${muted ? " is-muted" : ""}`}
      data-node-id={node.id}
      data-node-expanded={expanded ? "true" : "false"}
      style={{ left: position.x, top: position.y }}
    >
      {expanded && editable && (
        <div className="node-edit-actions">
          <button type="button" className="inline-action" onClick={() => onEdit(node)}>Edit node</button>
          <button type="button" className="inline-action is-danger" onClick={() => onDelete(node)}>Delete</button>
        </div>
      )}
      <button
        className={`node-head${expanded ? "" : " is-compact"}`}
        type="button"
        aria-expanded={expanded}
        aria-label={`${expanded ? "收起" : "展开"}节点“${node.title}”`}
        onClick={() => { onToggleDetails(node.id); onSelect(node.id); }}
      >
        {expanded && <span className="node-topline">
          <span className="node-kicker">NODE {node.id.toUpperCase()}</span>
          <span className="node-status">{statusLabel(status)}</span>
        </span>}
        {expanded ? <h3>{node.title}</h3> : <div className="compact-node-row">
          <h3>{node.title}</h3>
          <span className="node-status" title={status === "blocked" ? "前置节点尚未全部完成" : undefined}>{statusLabel(status)}</span>
        </div>}
        {expanded && <span className="node-progress-line">
          <span className="node-progress-track"><span className="node-progress-fill" style={{ width: `${stats.percent}%` }} /></span>
          <span className="node-progress-label">{stats.read}/{stats.total}</span>
        </span>}
      </button>
      {expanded && <div className="resource-list">
        {node.resources.map((resource) => {
          const isRead = Boolean(progress[resource.id]);
          return (
            <div className={`resource-item${isRead ? " is-read" : ""}`} key={resource.id}>
              <label className="resource-check" aria-label={`Mark “${resource.title}” as ${isRead ? "unread" : "read"}`}>
                <input type="checkbox" checked={isRead} onChange={(event) => onToggleResource(resource.id, event.target.checked)} />
                <span className="check-icon" aria-hidden="true">✓</span>
              </label>
             <div className="resource-copy">
                {resource.url ? (
                  <a className="resource-title" href={resource.url} target="_blank" rel="noopener noreferrer">
                    {resource.title} <span className="external-icon" aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span className="resource-title is-unlinked">{resource.title}</span>
                )}
              </div>
              {editable && (
                <div className="resource-actions">
                  <button type="button" className="resource-action" onClick={() => onEditResource(node.id, resource)}>Edit</button>
                  <button type="button" className="resource-action is-danger" aria-label={`Delete ${resource.title}`} onClick={() => onDeleteResource(node.id, resource)}>×</button>
                </div>
              )}
            </div>
          );
       })}
        {!node.resources.length && <p className="empty-resource-list">暂无直接可读的代表资料；可在编辑模式补充。</p>}
       {editable && <button type="button" className="add-resource-button" onClick={() => onAddResource(node.id)}>+ Add resource</button>}
      </div>}
    </article>
  );
}

function EdgeLayer({ roadmap, layout, selectedNodeId }) {
  return (
    <svg className="edge-layer" width={layout.stageWidth} height={layout.stageHeight} viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`} aria-label="Roadmap prerequisite connections" role="img">
      <defs>
       <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
         <path d="M0,0 L0,6 L6,3 z" />
       </marker>
     </defs>
      {roadmap.edges.map((edge) => {
        const from = layout.positions.get(edge.from);
        const to = layout.positions.get(edge.to);
        if (!from || !to) return null;
        const startX = from.x + from.width;
        const startY = from.y + from.height / 2;
        const endX = to.x;
        const endY = to.y + to.height / 2;
        const bend = Math.max(36, (endX - startX) * 0.45);
        const active = selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId);
        const muted = selectedNodeId && !active;
        return (
          <path
            className={`edge-path${active ? " is-active" : ""}${muted ? " is-muted" : ""}`}
            d={`M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`}
            data-from={edge.from}
            data-to={edge.to}
            key={`${edge.from}-${edge.to}`}
            markerEnd="url(#arrowhead)"
          />
        );
     })}
   </svg>
  );
}

function RoadmapMap({ roadmap, progress, selectedNodeId, editable, expandedNodeIds, onSelect, onToggleNodeDetails, onToggleResource, onEditNode, onDeleteNode, onAddResource, onEditResource, onDeleteResource, viewportWidth }) {
  const [measuredHeights, setMeasuredHeights] = useState({});
  const layout = useMemo(() => calculateTopology(roadmap, viewportWidth, editable, expandedNodeIds, measuredHeights), [roadmap, viewportWidth, editable, expandedNodeIds, measuredHeights]);
  const stats = useMemo(() => new Map(roadmap.nodes.map((node) => [node.id, nodeStats(node, progress)])), [roadmap, progress]);
  const [scale, setScale] = useState(1);
  const viewportRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    setMeasuredHeights({});
  }, [roadmap, editable, expandedNodeIds]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => {
      const next = {};
      stage.querySelectorAll("[data-node-id]").forEach((element) => {
        next[element.dataset.nodeId] = {
          height: Math.ceil(element.offsetHeight),
          expanded: element.dataset.nodeExpanded === "true",
        };
      });
      setMeasuredHeights((current) => {
        const currentIds = Object.keys(current);
        const nextIds = Object.keys(next);
        const changed = currentIds.length !== nextIds.length || nextIds.some((id) => {
          const previous = current[id];
          const measurement = next[id];
          return !previous || previous.expanded !== measurement.expanded || Math.abs(previous.height - measurement.height) > 1;
        });
        return changed ? next : current;
      });
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    stage.querySelectorAll("[data-node-id]").forEach((element) => observer?.observe(element));
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [roadmap, editable]);
  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return new Set();
    const ids = new Set([selectedNodeId]);
    roadmap.edges.forEach((edge) => {
     if (edge.from === selectedNodeId) ids.add(edge.to);
     if (edge.to === selectedNodeId) ids.add(edge.from);
   });
   return ids;
  }, [roadmap.edges, selectedNodeId]);

  const handleWheel = useCallback((event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    setScale((current) => {
      const next = current + (event.deltaY < 0 ? 0.1 : -0.1);
      return Math.min(1.7, Math.max(0.6, Number(next.toFixed(2))));
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  return (
    <>
      <div className="zoom-readout" aria-live="polite">
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => setScale(1)} disabled={scale === 1}>Reset</button>
      </div>
      <div className="roadmap-viewport" ref={viewportRef}>
        <div className="roadmap-canvas" style={{ width: layout.stageWidth * scale, height: layout.stageHeight * scale }}>
          <div className="roadmap-zoom-layer" style={{ width: layout.stageWidth, height: layout.stageHeight, transform: `scale(${scale})` }}>
            <div className="layer-labels" aria-hidden="true">
              {Array.from(layout.columns.keys()).map((level) => (
                <span className="layer-label" style={{ marginRight: layout.columnGap }} key={level}>LAYER {String(level + 1).padStart(2, "0")}</span>
              ))}
            </div>
            <div className="roadmap-stage" ref={stageRef} style={{ width: layout.stageWidth, height: layout.stageHeight }}>
              <div className="node-layer">
                {roadmap.nodes.map((node) => {
                  const currentStats = stats.get(node.id);
                  return (
                    <NodeCard
                      key={node.id}
                      node={node}
                      stats={currentStats}
                      status={nodeStatus(node, roadmap, progress, currentStats)}
                      position={layout.positions.get(node.id)}
                      selected={selectedNodeId === node.id}
                      muted={Boolean(selectedNodeId) && !connectedIds.has(node.id)}
                      editable={editable}
                      expanded={expandedNodeIds.has(node.id)}
                      progress={progress}
                      onSelect={onSelect}
                      onToggleDetails={onToggleNodeDetails}
                      onToggleResource={onToggleResource}
                      onEdit={onEditNode}
                      onDelete={onDeleteNode}
                      onAddResource={onAddResource}
                      onEditResource={onEditResource}
                      onDeleteResource={onDeleteResource}
                    />
                  );
                })}
              </div>
              <EdgeLayer roadmap={roadmap} layout={layout} selectedNodeId={selectedNodeId} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange, multiline = false, type = "text", required = false, placeholder }) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} rows={4} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} />
      )}
    </label>
  );
}

function EditorDialog({ editor, roadmap, onChange, onClose, onSave }) {
  const { type, mode, draft } = editor;
  const isNew = mode === "new";
  const title = type === "roadmap" ? "Edit roadmap details" : type === "node" ? `${isNew ? "Add" : "Edit"} node` : `${isNew ? "Add" : "Edit"} resource`;
  const setField = (field, value) => onChange({ ...draft, [field]: value });

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby="editorTitle">
        <div className="editor-header">
          <div><p className="eyebrow">EDITOR</p><h2 id="editorTitle">{title}</h2></div>
          <button type="button" className="modal-close" aria-label="Close editor" onClick={onClose}>×</button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
          {type === "roadmap" && (
            <div className="editor-form">
              <Field label="Title" value={draft.title} onChange={(value) => setField("title", value)} required />
            </div>
          )}
          {type === "node" && (
            <div className="editor-form">
              <Field label="Title" value={draft.title} onChange={(value) => setField("title", value)} required />
              <div className="dependency-field">
                <span>Prerequisites</span>
                <div className="dependency-options">
                  {roadmap.nodes.filter((node) => node.id !== draft.id).map((node) => (
                    <label className="dependency-option" key={node.id}>
                      <input
                        type="checkbox"
                        checked={draft.prerequisites.includes(node.id)}
                        onChange={(event) => setField("prerequisites", event.target.checked ? [...draft.prerequisites, node.id] : draft.prerequisites.filter((id) => id !== node.id))}
                      />
                      <span>{node.title}</span>
                    </label>
                  ))}
                  {!roadmap.nodes.filter((node) => node.id !== draft.id).length && <span className="field-note">No other nodes yet.</span>}
                </div>
              </div>
            </div>
          )}
          {type === "resource" && (
            <div className="editor-form">
              <Field label="Resource title" value={draft.title} onChange={(value) => setField("title", value)} required />
              <Field label="URL（可选）" value={draft.url} onChange={(value) => setField("url", value)} type="url" />
              <label className="editor-check"><input type="checkbox" checked={Boolean(draft.read)} onChange={(event) => setField("read", event.target.checked)} /><span>Mark as read</span></label>
            </div>
          )}
          <div className="editor-footer">
            <button type="button" className="modal-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-primary">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function App() {
  const initialRoadmapRef = useRef(readSavedRoadmap());
  const [roadmap, setRoadmap] = useState(() => initialRoadmapRef.current);
  const [progress, setProgress] = useState(() => readSavedProgress(initialRoadmapRef.current));
  const [roadmapLibrary, setRoadmapLibrary] = useState(() => bundledRoadmaps.map(roadmapSummary));
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState(() => new Set());
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState("正在读取 JSON…");
  const [syncReady, setSyncReady] = useState(false);
  const [editable, setEditable] = useState(false);
  const [editor, setEditor] = useState(null);
  const importInputRef = useRef(null);
  const initialRoadmapIdRef = useRef(window.localStorage.getItem(ACTIVE_ROADMAP_STORAGE_KEY) || initialRoadmapRef.current.meta.id);
  const lastSyncedRoadmapRef = useRef("");

  useEffect(() => {
    if (roadmap.meta.id !== EMPTY_ROADMAP_ID) {
      window.localStorage.setItem(ACTIVE_ROADMAP_STORAGE_KEY, roadmap.meta.id);
      setRoadmapLibrary((current) => {
        const entry = roadmapSummary(roadmap);
        return [entry, ...current.filter((candidate) => candidate.id !== entry.id)];
      });
    }
    setProgress((current) => {
      const defaults = defaultProgress(roadmap);
      const next = Object.fromEntries(Object.keys(defaults).map((id) => [id, current[id] ?? defaults[id]]));
      const unchanged = Object.keys(next).length === Object.keys(current).length && Object.keys(next).every((id) => next[id] === current[id]);
      return unchanged ? current : next;
    });
  }, [roadmap]);

  useEffect(() => {
    const controller = new AbortController();
    const loadRoadmaps = async () => {
      let loadedRoadmap = initialRoadmapRef.current;
      let loadedProgress = readSavedProgress(loadedRoadmap);
      let jsonServiceAvailable = false;
      try {
        const libraryResponse = await fetch(ROADMAPS_API, { signal: controller.signal });
        if (!libraryResponse.ok) throw new Error("本地 JSON 服务不可用");
        const entries = await libraryResponse.json();
        if (!Array.isArray(entries)) throw new Error("Roadmap 列表格式无效");
        jsonServiceAvailable = true;
        setRoadmapLibrary(entries);

        if (!entries.length) {
          loadedRoadmap = clone(emptyRoadmap);
          loadedProgress = {};
          setRoadmap(loadedRoadmap);
          setProgress(loadedProgress);
          setSyncStatus("data/roadmaps 中暂无 JSON，请加载一份 roadmap");
          return;
        }

        const activeId = entries.some((entry) => entry.id === initialRoadmapIdRef.current)
          ? initialRoadmapIdRef.current
          : entries[0].id;
        const roadmapResponse = await fetch(ROADMAPS_API + "/" + encodeURIComponent(activeId), { signal: controller.signal });
        if (!roadmapResponse.ok) throw new Error("无法读取选中的 roadmap");
        const next = await roadmapResponse.json();
        if (!roadmapValidationError(next)) {
          loadedRoadmap = normalizeRoadmap(next);
          loadedProgress = defaultProgress(loadedRoadmap);
          setRoadmap(loadedRoadmap);
          setProgress(loadedProgress);
          setSyncStatus("JSON 已同步");
        }
      } catch (error) {
        if (error?.name !== "AbortError") setSyncStatus("只读模式：请使用“启动应用.bat”以启用 JSON 同步");
      } finally {
        if (!controller.signal.aborted) {
          lastSyncedRoadmapRef.current = JSON.stringify(roadmapWithProgress(loadedRoadmap, loadedProgress));
          setSyncReady(jsonServiceAvailable);
        }
      }
    };
    loadRoadmaps();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!syncReady) return undefined;
    if (roadmap.meta.id === EMPTY_ROADMAP_ID) return undefined;
    const serializableRoadmap = roadmapWithProgress(roadmap, progress);
    const validationError = roadmapValidationError(serializableRoadmap);
    if (validationError) {
      setSyncStatus("无法同步：" + validationError);
      return undefined;
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(serializableRoadmap.meta.id)) {
      setSyncStatus("无法同步：meta.id 只能包含字母、数字、- 或 _。");
      return undefined;
    }
    const serializedRoadmap = JSON.stringify(serializableRoadmap);
    if (serializedRoadmap === lastSyncedRoadmapRef.current) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSyncStatus("正在保存 JSON…");
        const response = await fetch(ROADMAPS_API + "/" + encodeURIComponent(serializableRoadmap.meta.id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: serializedRoadmap,
          signal: controller.signal,
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || "服务器拒绝保存。");
        }
        lastSyncedRoadmapRef.current = serializedRoadmap;
        setSyncStatus("JSON 已同步");
      } catch (error) {
        if (error?.name !== "AbortError") setSyncStatus("无法同步 JSON");
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [roadmap, progress, syncReady]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!editor) return undefined;
    const handleKeyDown = (event) => { if (event.key === "Escape") setEditor(null); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const resources = useMemo(() => allResources(roadmap), [roadmap]);
  const readCount = resources.filter((resource) => progress[resource.id]).length;
  const allNodesExpanded = roadmap.nodes.length > 0 && roadmap.nodes.every((node) => expandedNodeIds.has(node.id));

  const toggleNodeDetails = useCallback((nodeId) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const toggleAllNodeDetails = useCallback(() => {
    setExpandedNodeIds((current) => {
      const allExpanded = roadmap.nodes.length > 0 && roadmap.nodes.every((node) => current.has(node.id));
      return allExpanded ? new Set() : new Set(roadmap.nodes.map((node) => node.id));
    });
  }, [roadmap.nodes]);

  const selectRoadmap = async (id) => {
    try {
      let parsed;
      const bundled = bundledRoadmaps.find((item) => item.meta.id === id);
      try {
        const response = await fetch(ROADMAPS_API + "/" + encodeURIComponent(id));
        if (!response.ok) throw new Error("找不到这份 roadmap 的 JSON 文件。");
        parsed = await response.json();
      } catch (error) {
        if (!bundled) throw error;
        parsed = bundled;
      }
      const validationError = roadmapValidationError(parsed);
      if (validationError) throw new Error(validationError);
      const next = normalizeRoadmap(parsed);
      const nextProgress = defaultProgress(next);
      lastSyncedRoadmapRef.current = JSON.stringify(roadmapWithProgress(next, nextProgress));
      setRoadmap(next);
      setProgress(nextProgress);
      setSelectedNodeId(null);
      setExpandedNodeIds(new Set());
      setEditable(false);
      setToast("已切换到“" + next.meta.title + "”。");
    } catch (error) {
      setToast("无法切换 roadmap：" + (error instanceof Error ? error.message : "服务不可用。"));
    }
  };

  const importRoadmap = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validationError = roadmapValidationError(parsed);
      if (validationError) throw new Error(validationError);
      if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(parsed.meta.id)) throw new Error("meta.id 只能包含字母、数字、- 或 _。");
      const next = normalizeRoadmap(parsed);
      setRoadmap(next);
      setProgress(defaultProgress(next));
      setRoadmapLibrary((current) => [roadmapSummary(next), ...current.filter((entry) => entry.id !== next.meta.id)]);
      setSelectedNodeId(null);
      setExpandedNodeIds(new Set());
      setEditable(false);
      setToast("已加载“" + next.meta.title + "”。");
    } catch (error) {
      setToast("无法加载 JSON：" + (error instanceof Error ? error.message : "文件格式无效。"));
    }
  };

  const toggleResource = useCallback((resourceId, checked) => {
    setProgress((current) => ({ ...current, [resourceId]: checked }));
    if (checked) {
      const resource = resources.find((candidate) => candidate.id === resourceId);
      if (resource) setToast(`Marked “${resource.title}” as read.`);
    }
  }, [resources]);

  const openRoadmapEditor = () => setEditor({ type: "roadmap", mode: "edit", draft: clone(roadmap.meta) });

  const openNodeEditor = (node) => setEditor({
    type: "node",
    mode: "edit",
    nodeId: node.id,
    draft: {
      id: node.id,
      title: node.title,
      prerequisites: roadmap.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from),
    },
  });

  const openNewNodeEditor = () => setEditor({
    type: "node",
    mode: "new",
    draft: { id: uniqueId("node-new", new Set(roadmap.nodes.map((node) => node.id))), title: "", prerequisites: [] },
  });

  const openResourceEditor = (nodeId, resource) => setEditor({ type: "resource", mode: "edit", nodeId, resourceId: resource.id, draft: clone(resource) });

  const openNewResourceEditor = (nodeId) => setEditor({
    type: "resource",
    mode: "new",
    nodeId,
    draft: { id: "", title: "", url: "", read: false },
  });

  const saveEditor = () => {
    if (!editor) return;
    const { type, mode, nodeId, resourceId, draft } = editor;
    if (type === "roadmap") {
      if (!draft.title.trim()) return;
      setRoadmap((current) => ({ ...current, meta: { ...current.meta, title: draft.title.trim() } }));
      setToast("Roadmap details saved locally.");
    }
    if (type === "node") {
      if (!draft.title.trim()) return;
      const node = { id: draft.id, title: draft.title.trim(), resources: mode === "new" ? [] : roadmap.nodes.find((candidate) => candidate.id === nodeId)?.resources || [] };
      setRoadmap((current) => {
        const nodes = mode === "new" ? [...current.nodes, node] : current.nodes.map((candidate) => candidate.id === nodeId ? node : candidate);
        const withoutIncoming = current.edges.filter((edge) => edge.to !== node.id);
        const newIncoming = [...new Set(draft.prerequisites.filter((id) => id !== node.id))].filter((id) => nodes.some((candidate) => candidate.id === id)).map((from) => ({ from, to: node.id }));
        return { ...current, nodes, edges: [...withoutIncoming, ...newIncoming] };
      });
      setToast(mode === "new" ? "Node added." : "Node updated.");
    }
    if (type === "resource") {
      if (!draft.title.trim()) return;
      const usedIds = new Set(allResources(roadmap).map((resource) => resource.id));
      const id = mode === "new" ? uniqueId(slugify(draft.title), usedIds) : resourceId;
      const resource = { id, title: draft.title.trim(), url: draft.url.trim(), read: Boolean(draft.read) };
      setRoadmap((current) => ({ ...current, nodes: current.nodes.map((node) => {
        if (mode === "new") return node.id === nodeId ? { ...node, resources: [...node.resources, resource] } : node;
        const containsResource = node.resources.some((candidate) => candidate.id === resourceId);
        return containsResource ? { ...node, resources: node.resources.map((candidate) => candidate.id === resourceId ? resource : candidate) } : node;
      }) }));
      setProgress((current) => ({ ...current, [id]: resource.read }));
      setToast(mode === "new" ? "Resource added." : "Resource updated.");
    }
    setEditor(null);
  };

  const deleteNode = (node) => {
    if (!window.confirm(`Delete node “${node.title}” and its resources?`)) return;
    setRoadmap((current) => ({
      ...current,
      nodes: current.nodes.filter((candidate) => candidate.id !== node.id),
      edges: current.edges.filter((edge) => edge.from !== node.id && edge.to !== node.id),
    }));
    setProgress((current) => {
      const next = { ...current };
      const referencedElsewhere = new Set(roadmap.nodes.filter((candidate) => candidate.id !== node.id).flatMap((candidate) => candidate.resources.map((resource) => resource.id)));
      node.resources.forEach((resource) => {
        if (!referencedElsewhere.has(resource.id)) delete next[resource.id];
      });
      return next;
    });
    if (selectedNodeId === node.id) setSelectedNodeId(null);
    setToast("Node deleted.");
  };

  const deleteResource = (nodeId, resource) => {
    if (!window.confirm(`Delete resource “${resource.title}”?`)) return;
    setRoadmap((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, resources: node.resources.filter((candidate) => candidate.id !== resource.id) } : node) }));
    const referencedElsewhere = roadmap.nodes.some((node) => node.id !== nodeId && node.resources.some((candidate) => candidate.id === resource.id));
    if (!referencedElsewhere) setProgress((current) => { const next = { ...current }; delete next[resource.id]; return next; });
    setToast("Resource deleted.");
  };

  const resetProgress = () => {
    if (!window.confirm("Reset all resource progress to the defaults in roadmap.json?")) return;
    setProgress(defaultProgress(roadmap));
    setToast("Progress reset to roadmap.json defaults.");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Research Roadmap home"><span className="brand-mark" aria-hidden="true">↗</span><span className="brand-copy"><span className="brand-name">READMAP</span></span></a>
      <h1 className="header-roadmap-title">{roadmap.meta.title}</h1>
      <div className="topbar-actions">
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importRoadmap} hidden />
          <select className="header-action roadmap-selector" value={roadmap.meta.id} onChange={(event) => selectRoadmap(event.target.value)} aria-label="选择已加载的 roadmap">
            {!roadmapLibrary.length && <option value={EMPTY_ROADMAP_ID}>暂无 roadmap</option>}
            {roadmapLibrary.map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}
        </select>
        <button className="header-action" type="button" onClick={() => importInputRef.current?.click()}>加载 JSON</button>
        <span className="compact-progress"><strong>{readCount}/{resources.length}</strong><span>resources read</span></span>
        <span className="source-chip">{syncStatus}</span>
        {editable && <button className="header-action" type="button" onClick={openRoadmapEditor}>Edit details</button>}
          <button className={`edit-toggle${editable ? " is-active" : ""}`} type="button" onClick={() => { setEditable((current) => !current); if (editable) setEditor(null); }}>{editable ? "Done" : "Edit"}</button>
          <button className="ghost-button" id="resetProgress" type="button" onClick={resetProgress}>Reset</button>
        </div>
      </header>

      <main>
        <section className="roadmap-section" aria-labelledby="mapTitle">
          <div className="section-heading">
            <div><p className="eyebrow">DEPENDENCY MAP</p><h2 id="mapTitle">Read in topology order</h2></div>
            <div className="section-actions">
              <div className="legend" aria-label="节点状态说明"><span><i className="legend-dot is-complete" aria-hidden="true" />已完成</span><span><i className="legend-dot is-progress" aria-hidden="true" />进行中</span><span><i className="legend-dot is-ready" aria-hidden="true" />可开始</span><span><i className="legend-line" aria-hidden="true" />前置关系</span></div>
              <button type="button" className="node-mode-button" aria-pressed={allNodesExpanded} onClick={toggleAllNodeDetails}>{allNodesExpanded ? "收起全部" : "展开全部"}</button>
              {editable && <button type="button" className="add-node-button" onClick={openNewNodeEditor}>+ Add node</button>}
            </div>
          </div>
          <div className="map-frame"><RoadmapMap roadmap={roadmap} progress={progress} selectedNodeId={selectedNodeId} editable={editable} expandedNodeIds={expandedNodeIds} onSelect={(id) => setSelectedNodeId((current) => current === id ? null : id)} onToggleNodeDetails={toggleNodeDetails} onToggleResource={toggleResource} onEditNode={openNodeEditor} onDeleteNode={deleteNode} onAddResource={openNewResourceEditor} onEditResource={openResourceEditor} onDeleteResource={deleteResource} viewportWidth={viewportWidth} /></div>
          <p className="map-hint"><span aria-hidden="true">↔</span> 点击节点标题切换简略 / 详细 <span className="hint-separator">·</span> Ctrl + 鼠标滚轮缩放 <span className="hint-separator">·</span> 点击标题也会显示关联路径</p>
        </section>
      </main>

      {editor && <EditorDialog editor={editor} roadmap={roadmap} onChange={(draft) => setEditor((current) => ({ ...current, draft }))} onClose={() => setEditor(null)} onSave={saveEditor} />}
      <div className={`toast${toast ? " is-visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

export default App;
