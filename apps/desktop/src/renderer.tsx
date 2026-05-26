import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from '@om/ui';
import type { OntologyModel, IngestedSchema } from '@om/ontology';
import { createOntology } from '@om/ontology';

declare global {
  interface Window {
    om: {
      project: {
        create: (name: string) => Promise<unknown>;
        list: () => Promise<unknown[]>;
        open: (id: string) => Promise<unknown>;
      };
      import: {
        files: (paths: string[]) => Promise<IngestedSchema[]>;
        dialog: () => Promise<string[]>;
      };
      export: {
        ontology: (format: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      };
      agent: {
        send: (message: string) => Promise<{ events: unknown[]; model: OntologyModel }>;
        onStream: (callback: (event: { type: string; content?: string }) => void) => void;
      };
      state: {
        get: () => Promise<{ projectId: string | null; model: OntologyModel; schemas: IngestedSchema[] }>;
      };
    };
  }
}

function App() {
  const [model, setModel] = useState<OntologyModel>(createOntology('http://example.org/ontology', 'om'));
  const [messages, setMessages] = useState<Array<{ role: string; content: string; timestamp: number }>>([]);
  const [agentRunning, setAgentRunning] = useState(false);

  useEffect(() => {
    // Load initial state
    window.om.state.get().then((state) => {
      if (state.model) setModel(state.model);
    });

    // Listen for agent streaming
    window.om.agent.onStream((event) => {
      if (event.type === 'text_delta' && event.content) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + event.content }];
          }
          return [...prev, { role: 'assistant', content: event.content ?? '', timestamp: Date.now() }];
        });
      }
    });
  }, []);

  const handleImport = useCallback(async (files: File[]) => {
    // In Electron, files come from drag-drop; we need to use the dialog approach
    // For now, we'll show a file dialog
    const paths = await window.om.import.dialog();
    if (paths.length > 0) {
      const schemas = await window.om.import.files(paths);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `已导入 ${schemas.length} 个数据源: ${schemas.map((s) => s.source).join(', ')}`, timestamp: Date.now() },
      ]);
    }
  }, []);

  const handleAgentMessage = useCallback(async (message: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: message, timestamp: Date.now() }]);
    setAgentRunning(true);

    try {
      const result = await window.om.agent.send(message);
      if (result.model) setModel(result.model);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'system', content: `错误: ${error}`, timestamp: Date.now() }]);
    } finally {
      setAgentRunning(false);
    }
  }, []);

  const handleExport = useCallback(async (format: string) => {
    const result = await window.om.export.ontology(format);
    if (result.success) {
      setMessages((prev) => [...prev, { role: 'system', content: `已导出到: ${result.path}`, timestamp: Date.now() }]);
    } else if (result.error !== 'Cancelled') {
      setMessages((prev) => [...prev, { role: 'system', content: `导出失败: ${result.error}`, timestamp: Date.now() }]);
    }
  }, []);

  return React.createElement(Workbench, {
    model,
    onModelChange: setModel,
    onExport: handleExport,
    onImport: handleImport,
    onAgentMessage: handleAgentMessage,
    agentMessages: messages,
    agentRunning,
  });
}

const root = createRoot(document.getElementById('root')!);
root.render(React.createElement(App));
