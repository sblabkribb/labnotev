import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { mockVscode } from './setup';

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
    mockVscode.env.openExternal.mockResolvedValue(true);
  });

  it('calls openExternal for xlsx and skips openWith when external succeeds', async () => {
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/report.xlsx' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(mockVscode.env.openExternal).toHaveBeenCalledWith(uri);
    expect(mockVscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('calls openWith when openExternal returns false for office file', async () => {
    mockVscode.env.openExternal.mockResolvedValue(false);
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/report.xlsx' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(mockVscode.env.openExternal).toHaveBeenCalledWith(uri);
    expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openWith', uri, 'default');
  });

  it('calls openWith first for pdf without openExternal', async () => {
    mockVscode.env.openExternal.mockClear();
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/doc.pdf' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(mockVscode.env.openExternal).not.toHaveBeenCalled();
    expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openWith', uri, 'default');
  });

  it('on openWith failure for non-office tries openExternal then vscode.open', async () => {
    mockVscode.env.openExternal.mockResolvedValueOnce(false);
    vi.mocked(mockVscode.commands.executeCommand)
      .mockRejectedValueOnce(new Error('openWith failed'))
      .mockResolvedValueOnce(undefined as never);
    const { openAttachmentFile } = await import('../sectionEditorProvider');
    const uri = { fsPath: '/tmp/doc.pdf' } as vscode.Uri;
    await openAttachmentFile(uri);
    expect(mockVscode.env.openExternal).toHaveBeenCalledWith(uri);
    expect(mockVscode.commands.executeCommand).toHaveBeenNthCalledWith(1, 'vscode.openWith', uri, 'default');
    expect(mockVscode.commands.executeCommand).toHaveBeenNthCalledWith(2, 'vscode.open', uri);
  });

  it('shows error and revealFileInOS when all open methods fail', async () => {
    mockVscode.env.openExternal.mockResolvedValue(false);
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
