import React, { useState, useEffect, useCallback } from 'react';
import { MantineProvider } from '@mantine/core';
import { Editor } from './Editor';
import { vscode, MessageHandler } from './vscodeApi';

export const App: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [documentUri, setDocumentUri] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleMessage: MessageHandler = (message) => {
      switch (message.type) {
        case 'update':
          setContent(message.content);
          setDocumentUri(message.documentUri);
          setIsReady(true);
          break;
      }
    };

    vscode.onMessage(handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => {
      vscode.offMessage(handleMessage);
    };
  }, []);

  const handleSave = useCallback((markdown: string) => {
    vscode.postMessage({ type: 'save', content: markdown });
  }, []);

  const handleSaveImage = useCallback(async (base64Data: string, filename: string): Promise<string> => {
    vscode.postMessage({ type: 'saveImage', data: base64Data, filename });
    return `./assets/${filename}`;
  }, []);

  const resolveAssetUrl = useCallback(async (relativePath: string): Promise<string> => {
    const response = await vscode.request<{ uri: string }>({
      type: 'getAssetUri',
      relativePath,
    });
    return response.uri;
  }, []);

  return (
    <MantineProvider>
      {isReady ? (
        <Editor
          initialContent={content}
          documentUri={documentUri}
          onSave={handleSave}
          onSaveImage={handleSaveImage}
          resolveAssetUrl={resolveAssetUrl}
        />
      ) : (
        <div className="loading">Loading...</div>
      )}
    </MantineProvider>
  );
};
