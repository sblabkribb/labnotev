import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mockVscode } from './setup';
import { openFileInOsDefaultApp } from '../lib/openInOs';

vi.mock('../lib/openInOs', () => ({
  openFileInOsDefaultApp: vi.fn(),
}));

function makeContext() {
  return { subscriptions: [], extensionUri: { fsPath: '/test' }, extensionPath: '/test' } as any;
}

/** Creates a temp experiment folder mirroring `labnote/{###_Name}/README.labnote.md` layout. */
function makeExperiment() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'labnotev-exp-'));
  const dir = path.join(root, 'labnote', '001_Test');
  fs.mkdirSync(dir, { recursive: true });

  const readmePath = path.join(dir, 'README.labnote.md');
  fs.writeFileSync(
    readmePath,
    `---
title: pmid_39169056
author: Sebin Heo
experiment_type: labnote
sample_tracking: no
created_date: 2026-08-04
last_updated_date: 2026-08-10
---

## Objective

Readme body.

## Related Workflows

[x] [001 WL050 Transcriptome Analysis](./001_WL050_Transcriptome_Analysis.labnote.md)
`,
    'utf8'
  );

  const workflowPath = path.join(dir, '001_WL050_Transcriptome_Analysis.labnote.md');
  fs.writeFileSync(
    workflowPath,
    `---
title: WL050 Transcriptome Analysis
experimenter: Sebin Heo
created_date: 2026-08-04
last_updated_date: 2026-08-18
end_date: ''
---

## [WL050 Transcriptome Analysis]

| contrast | total | up | down |
|---|---|---|---|
| 1h_vs_0h | 1436 | 530 | 906 |
`,
    'utf8'
  );

  return { root, dir, readmePath, workflowPath };
}

describe('registerExportCommands', () => {
  let exp: ReturnType<typeof makeExperiment>;

  beforeEach(() => {
    exp = makeExperiment();
    mockVscode.window.activeTextEditor = {
      document: { uri: { fsPath: exp.readmePath } },
    } as any;
  });

  afterEach(() => {
    fs.rmSync(exp.root, { recursive: true, force: true });
    mockVscode.window.activeTextEditor = undefined;
  });

  it('registers labnotev.exportPdf and labnotev.exportTablesCsv', async () => {
    const { registerExportCommands } = await import('../commands/exportCommands');
    registerExportCommands(makeContext());

    const registered = mockVscode.commands.registerCommand.mock.calls.map((c) => c[0]);
    expect(registered).toContain('labnotev.exportPdf');
    expect(registered).toContain('labnotev.exportTablesCsv');
  });

  describe('labnotev.exportPdf', () => {
    async function getHandler() {
      const { registerExportCommands } = await import('../commands/exportCommands');
      registerExportCommands(makeContext());
      const call = mockVscode.commands.registerCommand.mock.calls.find((c) => c[0] === 'labnotev.exportPdf');
      return call?.[1] as () => Promise<void>;
    }

    it('renders selected sources, writes an HTML report, and opens it', async () => {
      mockVscode.window.showQuickPick.mockImplementationOnce((items: any) => Promise.resolve(items));
      mockVscode.commands.executeCommand.mockImplementation((...args: unknown[]) => {
        const [cmd, arg] = args as [string, string];
        if (cmd === 'markdown.api.render') return Promise.resolve(`<p>${arg.trim()}</p>`);
        return Promise.resolve(undefined);
      });
      vi.mocked(openFileInOsDefaultApp).mockResolvedValue(true);

      const handler = await getHandler();
      await handler();

      expect(openFileInOsDefaultApp).toHaveBeenCalledTimes(1);
      const htmlPath = vi.mocked(openFileInOsDefaultApp).mock.calls[0][0];
      expect(htmlPath.startsWith(os.tmpdir())).toBe(true);
      expect(htmlPath.endsWith('.html')).toBe(true);

      const html = fs.readFileSync(htmlPath, 'utf8');
      expect(html).toContain('pmid_39169056');
      expect(html).toContain('2026-08-04');
      expect(html).toContain('2026-08-10');
      expect(html).toContain('WL050 Transcriptome Analysis');
      expect(html).toContain('2026-08-18');

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Print')
      );
    });

    it('falls back to the minimal renderer when markdown.api.render is unavailable', async () => {
      mockVscode.window.showQuickPick.mockImplementationOnce((items: any) => Promise.resolve(items));
      mockVscode.commands.executeCommand.mockImplementation((...args: unknown[]) => {
        const [cmd] = args as [string];
        if (cmd === 'markdown.api.render') return Promise.reject(new Error('unavailable'));
        return Promise.resolve(undefined);
      });
      vi.mocked(openFileInOsDefaultApp).mockResolvedValue(true);

      const handler = await getHandler();
      await handler();

      const htmlPath = vi.mocked(openFileInOsDefaultApp).mock.calls[0][0];
      const html = fs.readFileSync(htmlPath, 'utf8');
      expect(html).toContain('<h2>Objective</h2>');
    });

    it('reveals the file and warns when the OS cannot open the report', async () => {
      mockVscode.window.showQuickPick.mockImplementationOnce((items: any) => Promise.resolve(items));
      mockVscode.commands.executeCommand.mockResolvedValue(undefined);
      vi.mocked(openFileInOsDefaultApp).mockResolvedValue(false);

      const handler = await getHandler();
      await handler();

      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
        'revealFileInOS',
        expect.anything()
      );
      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('.html')
      );
    });

    it('does nothing when the user cancels the QuickPick', async () => {
      mockVscode.window.showQuickPick.mockResolvedValueOnce(undefined);

      const handler = await getHandler();
      await handler();

      expect(openFileInOsDefaultApp).not.toHaveBeenCalled();
    });

    it('warns and does not open anything when no experiment folder is found', async () => {
      mockVscode.window.activeTextEditor = undefined;
      mockVscode.workspace.findFiles.mockResolvedValueOnce([]);

      const handler = await getHandler();
      await handler();

      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('experiment folder')
      );
      expect(openFileInOsDefaultApp).not.toHaveBeenCalled();
    });
  });

  describe('labnotev.exportTablesCsv', () => {
    async function getHandler() {
      const { registerExportCommands } = await import('../commands/exportCommands');
      registerExportCommands(makeContext());
      const call = mockVscode.commands.registerCommand.mock.calls.find((c) => c[0] === 'labnotev.exportTablesCsv');
      return call?.[1] as () => Promise<void>;
    }

    it('writes one CSV per Markdown table into the chosen folder', async () => {
      mockVscode.window.showQuickPick.mockImplementationOnce((items: any) => Promise.resolve(items));
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labnotev-csv-out-'));
      mockVscode.window.showOpenDialog.mockResolvedValueOnce([{ fsPath: outDir }]);

      const handler = await getHandler();
      await handler();

      const written = fs.readdirSync(outDir);
      expect(written).toContain('001_WL050_Transcriptome_Analysis.csv');

      const csv = fs.readFileSync(path.join(outDir, '001_WL050_Transcriptome_Analysis.csv'), 'utf8');
      expect(csv).toBe('contrast,total,up,down\n1h_vs_0h,1436,530,906\n');

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('1')
      );

      fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('warns and skips the folder dialog when no tables are found', async () => {
      // Select only the README, which has no tables.
      mockVscode.window.showQuickPick.mockImplementationOnce((items: any) =>
        Promise.resolve(items.filter((i: any) => i.description === 'README.labnote.md'))
      );

      const handler = await getHandler();
      await handler();

      expect(mockVscode.window.showOpenDialog).not.toHaveBeenCalled();
      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('table')
      );
    });

    it('does nothing when the user cancels the folder dialog', async () => {
      mockVscode.window.showQuickPick.mockImplementationOnce((items: any) => Promise.resolve(items));
      mockVscode.window.showOpenDialog.mockResolvedValueOnce(undefined);

      const handler = await getHandler();
      await handler();

      expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });
});
