import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { mockVscode } from './setup';
import { openFileInOsDefaultApp } from '../lib/openInOs';

vi.mock('../lib/openInOs', () => ({
  openFileInOsDefaultApp: vi.fn(),
}));

describe('shouldOpenAttachmentWithExternalApp', () => {
  it('returns true for Office spreadsheet and document extensions', async () => {
    const { shouldOpenAttachmentWithExternalApp } = await import('../sectionEditorProvider');
    expect(shouldOpenAttachmentWithExternalApp('/lab/report.XLSX')).toBe(true);
    expect(shouldOpenAttachmentWithExternalApp('C:\\x\\a.xlsm')).toBe(true);
    expect(shouldOpenAttachmentWithExternalApp('/x/b.docx')).toBe(true);
    expect(shouldOpenAttachmentWithExternalApp('/x/c.pptx')).toBe(true);
  });

  it('returns false for pdf and other extensions', async () => {
    const { shouldOpenAttachmentWithExternalApp } = await import('../sectionEditorProvider');
    expect(shouldOpenAttachmentWithExternalApp('/x/a.pdf')).toBe(false);
    expect(shouldOpenAttachmentWithExternalApp('/x/a.txt')).toBe(false);
    expect(shouldOpenAttachmentWithExternalApp('/x/a.json')).toBe(false);
  });
});

describe('openAttachmentFile', () => {
  beforeEach(() => {
    vi.mocked(mockVscode.commands.executeCommand).mockResolvedValue(undefined as never);
    vi.mocked(openFileInOsDefaultApp).mockResolvedValue(true);
  });

  it('calls openFileInOsDefaultApp for xlsx and skips openWith when native succeeds', async () => {
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/report.xlsx' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(openFileInOsDefaultApp).toHaveBeenCalledWith('/tmp/report.xlsx');
    expect(mockVscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
  });

  it('calls openWith when openFileInOsDefaultApp returns false for office file', async () => {
    vi.mocked(openFileInOsDefaultApp).mockResolvedValue(false);
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/report.xlsx' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(openFileInOsDefaultApp).toHaveBeenCalledWith('/tmp/report.xlsx');
    expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openWith', uri, 'default');
    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
  });

  it('falls back to vscode.open when native fails and openWith throws for office file', async () => {
    vi.mocked(openFileInOsDefaultApp).mockResolvedValue(false);
    vi.mocked(mockVscode.commands.executeCommand)
      .mockRejectedValueOnce(new Error('openWith failed'))
      .mockResolvedValueOnce(undefined as never);
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/report.xlsx' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(openFileInOsDefaultApp).toHaveBeenCalledWith('/tmp/report.xlsx');
    expect(mockVscode.commands.executeCommand).toHaveBeenNthCalledWith(1, 'vscode.openWith', uri, 'default');
    expect(mockVscode.commands.executeCommand).toHaveBeenNthCalledWith(2, 'vscode.open', uri);
    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
  });

  it('calls openWith first for pdf without OS native opener', async () => {
    vi.mocked(openFileInOsDefaultApp).mockClear();
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/doc.pdf' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(openFileInOsDefaultApp).not.toHaveBeenCalled();
    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openWith', uri, 'default');
  });

  it('on openWith failure for non-office tries openFileInOsDefaultApp then vscode.open', async () => {
    vi.mocked(openFileInOsDefaultApp).mockResolvedValueOnce(false);
    vi.mocked(mockVscode.commands.executeCommand)
      .mockRejectedValueOnce(new Error('openWith failed'))
      .mockResolvedValueOnce(undefined as never);
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/doc.pdf' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(openFileInOsDefaultApp).toHaveBeenCalledWith('/tmp/doc.pdf');
    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    expect(mockVscode.commands.executeCommand).toHaveBeenNthCalledWith(1, 'vscode.openWith', uri, 'default');
    expect(mockVscode.commands.executeCommand).toHaveBeenNthCalledWith(2, 'vscode.open', uri);
  });

  it('shows error and revealFileInOS when all open methods fail', async () => {
    vi.mocked(openFileInOsDefaultApp).mockResolvedValue(false);
    vi.mocked(mockVscode.commands.executeCommand)
      .mockRejectedValueOnce(new Error('openWith fail'))
      .mockRejectedValueOnce(new Error('open fail'))
      .mockResolvedValueOnce(undefined as never);
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/z.pdf' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(mockVscode.window.showErrorMessage).toHaveBeenCalled();
    expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('revealFileInOS', uri);
  });
});
