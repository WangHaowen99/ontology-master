import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join } from 'node:path';
import { openDatabase, ProjectRepository, DataSourceRepository, SessionRepository } from '@om/store';
import { IngestionPipeline, detectSourceType } from '@om/ingestion';
import { ModelingPipeline } from '@om/modeler';
import { createOntology } from '@om/ontology';
import type { OntologyModel, IngestedSchema } from '@om/ontology';

let mainWindow: BrowserWindow | null = null;
let db: ReturnType<typeof openDatabase>;
let projects: ProjectRepository;
let dataSources: DataSourceRepository;
let sessions: SessionRepository;
const pipeline = new IngestionPipeline();

// Current state
let currentProjectId: string | null = null;
let currentModel: OntologyModel = createOntology('http://example.org/ontology', 'om');
let currentSchemas: IngestedSchema[] = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: '本体建模大师 Desktop',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// ─── IPC Handlers ───

function registerIPC() {
  // Project management
  ipcMain.handle('project:create', async (_e, name: string) => {
    const project = projects.create(name);
    currentProjectId = project.id;
    currentModel = project.model;
    currentSchemas = [];
    return project;
  });

  ipcMain.handle('project:list', async () => {
    return projects.list();
  });

  ipcMain.handle('project:open', async (_e, id: string) => {
    const project = projects.get(id);
    if (project) {
      currentProjectId = project.id;
      currentModel = project.model;
      currentSchemas = [];
    }
    return project;
  });

  // File import
  ipcMain.handle('import:files', async (_e, filePaths: string[]) => {
    const results: IngestedSchema[] = [];
    for (const filePath of filePaths) {
      const type = detectSourceType(filePath);
      const name = filePath.split('/').pop() ?? filePath;
      const schema = await pipeline.ingest({ type, path: filePath, name });
      results.push(schema);

      if (currentProjectId) {
        dataSources.create(currentProjectId, {
          name,
          type,
          path: filePath,
          schemaJson: JSON.stringify(schema),
        });
      }
    }
    currentSchemas.push(...results);
    return results;
  });

  ipcMain.handle('import:dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '所有支持格式', extensions: ['csv', 'xlsx', 'xls', 'json', 'xml', 'yaml', 'yml', 'pdf', 'docx', 'md', 'txt', 'sqlite', 'db'] },
        { name: '结构化', extensions: ['csv', 'xlsx', 'xls', 'sqlite', 'db'] },
        { name: '半结构化', extensions: ['json', 'xml', 'yaml', 'yml'] },
        { name: '非结构化', extensions: ['pdf', 'docx', 'md', 'txt'] },
      ],
    });
    return result.filePaths;
  });

  // Export
  ipcMain.handle('export:ontology', async (_e, format: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `${currentModel.metadata.title || 'ontology'}.${format === 'turtle' ? 'ttl' : format === 'jsonld' ? 'jsonld' : 'owl'}`,
    });

    if (result.filePath) {
      try {
        const response = await fetch('http://localhost:8765/api/export/ontology', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: currentModel, format }),
        });
        const content = await response.text();

        const { writeFileSync } = await import('node:fs');
        writeFileSync(result.filePath, content, 'utf-8');
        return { success: true, path: result.filePath };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
    return { success: false, error: 'Cancelled' };
  });

  // Agent
  ipcMain.handle('agent:send', async (_e, message: string) => {
    if (!currentProjectId) return { error: 'No project open' };

    const modelerPipeline = new ModelingPipeline({
      provider: 'deepseek',
      providerConfig: {
        apiKey: process.env.DEEPSEEK_API_KEY || '',
      },
    });

    const events: Array<{ type: string; content?: string }> = [];
    for await (const event of modelerPipeline.runPhase('extract', currentModel, currentSchemas, message)) {
      events.push(event);
      if (event.type === 'text_delta') {
        mainWindow?.webContents.send('agent:stream', event);
      }
    }

    // Save updated model
    projects.updateModel(currentProjectId, currentModel);

    return { events, model: currentModel };
  });

  // Get current state
  ipcMain.handle('state:get', async () => {
    return {
      projectId: currentProjectId,
      model: currentModel,
      schemas: currentSchemas,
    };
  });
}

// ─── App Lifecycle ───

app.whenReady().then(() => {
  db = openDatabase();
  projects = new ProjectRepository(db);
  dataSources = new DataSourceRepository(db);
  sessions = new SessionRepository(db);

  registerIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db?.close();
    app.quit();
  }
});
