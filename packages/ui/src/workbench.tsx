import React, { useState } from 'react';
import type { OntologyModel } from '@om/ontology';

export interface WorkbenchProps {
  model: OntologyModel;
  onModelChange: (model: OntologyModel) => void;
  onExport: (format: string) => void;
  onImport: (files: File[]) => void;
  onAgentMessage: (message: string) => void;
  agentMessages: Array<{ role: string; content: string; timestamp: number }>;
  agentRunning?: boolean;
}

export function Workbench(props: WorkbenchProps) {
  const [activePanel, setActivePanel] = useState<'import' | 'graph' | 'agent' | 'export'>('import');

  return React.createElement('div', { className: 'om-workbench', style: workbenchStyle },
    // Sidebar
    React.createElement('nav', { className: 'om-sidebar', style: sidebarStyle },
      React.createElement('div', { style: logoStyle }, '\u{1F9E0} ', React.createElement('strong', null, '本体建模大师')),
      ...([
        ['import', '\u{1F4C2} 数据导入'],
        ['graph', '\u{1F310} 本体图谱'],
        ['agent', '\u{1F916} AI 助手'],
        ['export', '\u{1F4E4} 导出 OWL'],
      ] as const).map(([key, label]) =>
        React.createElement('button', {
          key,
          style: { ...navButtonStyle, ...(activePanel === key ? navButtonActiveStyle : {}) },
          onClick: () => setActivePanel(key),
        }, label)
      ),
      // Stats
      React.createElement('div', { style: statsStyle },
        React.createElement('div', null, `类: ${props.model.classes.length}`),
        React.createElement('div', null, `属性: ${props.model.objectProperties.length + props.model.dataProperties.length}`),
        React.createElement('div', null, `实例: ${props.model.individuals.length}`),
      ),
    ),

    // Main content
    React.createElement('main', { className: 'om-main', style: mainStyle },
      activePanel === 'import' && React.createElement(ImportPanel, { onImport: props.onImport }),
      activePanel === 'graph' && React.createElement(OntologyTree, { model: props.model }),
      activePanel === 'agent' && React.createElement(AgentPanel, {
        messages: props.agentMessages,
        onSend: props.onAgentMessage,
        running: props.agentRunning,
      }),
      activePanel === 'export' && React.createElement(ExportPanel, { model: props.model, onExport: props.onExport }),
    ),
  );
}

// ─── Import Panel ───

function ImportPanel({ onImport }: { onImport: (files: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false);

  return React.createElement('div', { className: 'om-panel', style: panelStyle },
    React.createElement('h2', null, '\u{1F4C2} 数据导入'),
    React.createElement('p', { style: { color: '#888' } },
      '支持结构化（CSV, Excel, SQLite, PostgreSQL, MySQL）、半结构化（JSON, XML, YAML）、非结构化（PDF, DOCX, Markdown）数据'),
    React.createElement('div', {
      style: { ...dropZoneStyle, ...(dragOver ? dropZoneActiveStyle : {}) },
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
      onDragLeave: () => setDragOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onImport(files);
      },
    },
      React.createElement('p', null, '\u{1F4C1} 拖拽文件到这里，或'),
      React.createElement('input', {
        type: 'file',
        multiple: true,
        accept: '.csv,.xlsx,.xls,.json,.xml,.yaml,.yml,.pdf,.docx,.md,.txt,.sqlite,.db',
        style: { marginTop: 8 },
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onImport(files);
        },
      }),
    ),
  );
}

// ─── Ontology Tree ───

function OntologyTree({ model }: { model: OntologyModel }) {
  return React.createElement('div', { className: 'om-panel', style: panelStyle },
    React.createElement('h2', null, '\u{1F310} 本体结构'),
    React.createElement('h3', null, `类 (${model.classes.length})`),
    React.createElement('ul', null,
      model.classes.map((cls) =>
        React.createElement('li', { key: cls.iri.full, style: treeItemStyle },
          React.createElement('strong', null, cls.label || cls.iri.local),
          cls.description && React.createElement('span', { style: { color: '#888', marginLeft: 8 } }, cls.description),
        )
      )
    ),
    React.createElement('h3', null, `对象属性 (${model.objectProperties.length})`),
    React.createElement('ul', null,
      model.objectProperties.map((prop) =>
        React.createElement('li', { key: prop.iri.full, style: treeItemStyle },
          React.createElement('strong', null, prop.label || prop.iri.local),
          React.createElement('span', { style: { color: '#666', marginLeft: 8 } },
            prop.domain.map((d) => d.kind === 'iri' ? d.iri.local : '?').join(', '),
            ' → ',
            prop.range.map((r) => r.kind === 'iri' ? r.iri.local : '?').join(', '),
          ),
        )
      )
    ),
    React.createElement('h3', null, `数据属性 (${model.dataProperties.length})`),
    React.createElement('ul', null,
      model.dataProperties.map((prop) =>
        React.createElement('li', { key: prop.iri.full, style: treeItemStyle },
          React.createElement('strong', null, prop.label || prop.iri.local),
          React.createElement('span', { style: { color: '#666', marginLeft: 8 } },
            prop.range.join(', '),
          ),
        )
      )
    ),
    React.createElement('h3', null, `实例 (${model.individuals.length})`),
    React.createElement('ul', null,
      model.individuals.map((ind) =>
        React.createElement('li', { key: ind.iri.full, style: treeItemStyle },
          React.createElement('strong', null, ind.label || ind.iri.local),
          React.createElement('span', { style: { color: '#666', marginLeft: 8 } },
            ind.classIRIs.map((c) => c.local).join(', '),
          ),
        )
      )
    ),
  );
}

// ─── Agent Panel ───

function AgentPanel({
  messages,
  onSend,
  running,
}: {
  messages: Array<{ role: string; content: string; timestamp: number }>;
  onSend: (message: string) => void;
  running?: boolean;
}) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !running) {
      onSend(input.trim());
      setInput('');
    }
  };

  return React.createElement('div', { className: 'om-panel', style: { ...panelStyle, display: 'flex', flexDirection: 'column' as const } },
    React.createElement('h2', null, '\u{1F916} AI 助手', running && React.createElement('span', { style: { color: '#4CAF50', marginLeft: 8 } }, '● 运行中')),
    React.createElement('div', { style: messageListStyle },
      messages.map((msg, i) =>
        React.createElement('div', {
          key: i,
          style: {
            padding: '8px 12px',
            marginBottom: 8,
            borderRadius: 8,
            background: msg.role === 'user' ? '#e3f2fd' : msg.role === 'assistant' ? '#f5f5f5' : '#fff3e0',
            borderLeft: `3px solid ${msg.role === 'user' ? '#1976D2' : msg.role === 'assistant' ? '#4CAF50' : '#FF9800'}`,
          },
        },
          React.createElement('strong', { style: { fontSize: 11, color: '#888' } }, msg.role.toUpperCase()),
          React.createElement('pre', { style: { margin: '4px 0 0', whiteSpace: 'pre-wrap' as const, fontFamily: 'inherit', fontSize: 13 } }, msg.content),
        )
      ),
    ),
    React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 'auto' } },
      React.createElement('input', {
        value: input,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value),
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSend(); },
        placeholder: '输入消息，如“帮我从这些数据创建本体”',
        style: { flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 },
        disabled: running,
      }),
      React.createElement('button', {
        onClick: handleSend,
        disabled: running || !input.trim(),
        style: { padding: '8px 16px', borderRadius: 6, border: 'none', background: '#1976D2', color: '#fff', cursor: 'pointer', fontSize: 14 },
      }, running ? '…' : '发送'),
    ),
  );
}

// ─── Export Panel ───

function ExportPanel({ model, onExport }: { model: OntologyModel; onExport: (format: string) => void }) {
  const formats = [
    { id: 'turtle', label: 'Turtle (.ttl)', desc: '最常用的 RDF 序列化格式，可读性好' },
    { id: 'rdfxml', label: 'RDF/XML (.owl)', desc: '标准 RDF/XML 格式，工具兼容性最广' },
    { id: 'owlxml', label: 'OWL/XML (.owl)', desc: 'OWL 专用 XML 格式' },
    { id: 'jsonld', label: 'JSON-LD (.jsonld)', desc: 'JSON 格式的关联数据，适合 Web 应用' },
  ];

  return React.createElement('div', { className: 'om-panel', style: panelStyle },
    React.createElement('h2', null, '\u{1F4E4} 导出 OWL 本体'),
    React.createElement('p', { style: { color: '#888' } },
      `当前本体: ${model.metadata.title} — ${model.classes.length} 类, ${model.objectProperties.length + model.dataProperties.length} 属性, ${model.individuals.length} 实例`),
    React.createElement('div', { style: { display: 'grid', gap: 12, marginTop: 16 } },
      formats.map((fmt) =>
        React.createElement('button', {
          key: fmt.id,
          onClick: () => onExport(fmt.id),
          style: exportButtonStyle,
        },
          React.createElement('strong', null, fmt.label),
          React.createElement('div', { style: { fontSize: 12, color: '#888', marginTop: 4 } }, fmt.desc),
        )
      )
    ),
  );
}

// ─── Styles ───

const workbenchStyle: React.CSSProperties = { display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#333', background: '#fafafa' };
const sidebarStyle: React.CSSProperties = { width: 200, background: '#1a1a2e', color: '#fff', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 };
const logoStyle: React.CSSProperties = { fontSize: 16, padding: '8px 4px', marginBottom: 16 };
const navButtonStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', background: 'transparent', color: '#ccc', border: 'none', borderRadius: 6, textAlign: 'left', cursor: 'pointer', fontSize: 13 };
const navButtonActiveStyle: React.CSSProperties = { background: '#16213e', color: '#fff' };
const statsStyle: React.CSSProperties = { marginTop: 'auto', padding: '12px 4px', fontSize: 12, color: '#888', borderTop: '1px solid #333' };
const mainStyle: React.CSSProperties = { flex: 1, overflow: 'auto', padding: 24 };
const panelStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const dropZoneStyle: React.CSSProperties = { border: '2px dashed #ddd', borderRadius: 12, padding: 40, textAlign: 'center', marginTop: 16, transition: 'all 0.2s' };
const dropZoneActiveStyle: React.CSSProperties = { borderColor: '#1976D2', background: '#e3f2fd' };
const treeItemStyle: React.CSSProperties = { padding: '4px 0', fontSize: 14 };
const messageListStyle: React.CSSProperties = { flex: 1, overflow: 'auto', padding: '8px 0', minHeight: 200 };
const exportButtonStyle: React.CSSProperties = { padding: '16px', background: '#fff', border: '1px solid #ddd', borderRadius: 8, textAlign: 'left', cursor: 'pointer', fontSize: 14 };
