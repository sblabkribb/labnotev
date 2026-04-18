import './setup';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('SampleTreeViewProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SampleTreeItem', () => {
    it('should create root item for Local scope', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'Samples (Local)',
        SampleTreeItemType.Root,
        { scope: 'local' }
      );
      
      expect(item.label).toBe('Samples (Local)');
      expect(item.itemType).toBe(SampleTreeItemType.Root);
      expect(item.scope).toBe('local');
    });

    it('should create root item for Global scope', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'Samples (Global)',
        SampleTreeItemType.Root,
        { scope: 'global' }
      );
      
      expect(item.label).toBe('Samples (Global)');
      expect(item.scope).toBe('global');
    });

    it('should create type item with sample count', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA [3]',
        SampleTreeItemType.Type,
        { scope: 'local', sampleType: 'DNA' }
      );
      
      expect(item.label).toBe('DNA [3]');
      expect(item.itemType).toBe(SampleTreeItemType.Type);
      expect(item.sampleType).toBe('DNA');
    });

    it('should create sample item with ID and alias', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA-1737123456789 | 샘플A',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'DNA',
          sampleId: 'DNA-1737123456789',
          alias: '샘플A',
          sampleDescription: '테스트 설명'
        }
      );
      
      expect(item.label).toBe('DNA-1737123456789 | 샘플A');
      expect(item.itemType).toBe(SampleTreeItemType.Sample);
      expect(item.sampleId).toBe('DNA-1737123456789');
      expect(item.alias).toBe('샘플A');
      expect(item.sampleDescription).toBe('테스트 설명');
    });

    it('should create sample item without alias', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA-1737123456789',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'DNA',
          sampleId: 'DNA-1737123456789',
          alias: null,
          sampleDescription: null
        }
      );
      
      expect(item.label).toBe('DNA-1737123456789');
    });
  });

  describe('Collapsible State', () => {
    it('should have Root items expanded by default', async () => {
      const { SampleTreeItem, SampleTreeItemType, getCollapsibleState } = await import('../views/SampleTreeViewProvider');
      const vscode = await import('vscode');
      
      const state = getCollapsibleState(SampleTreeItemType.Root);
      expect(state).toBe(vscode.TreeItemCollapsibleState.Expanded);
    });

    it('should have Type items expanded by default', async () => {
      const { SampleTreeItemType, getCollapsibleState } = await import('../views/SampleTreeViewProvider');
      const vscode = await import('vscode');
      
      const state = getCollapsibleState(SampleTreeItemType.Type);
      expect(state).toBe(vscode.TreeItemCollapsibleState.Expanded);
    });

    it('should have Sample items collapsed by default', async () => {
      const { SampleTreeItemType, getCollapsibleState } = await import('../views/SampleTreeViewProvider');
      const vscode = await import('vscode');
      
      const state = getCollapsibleState(SampleTreeItemType.Sample);
      expect(state).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });

    it('should have Detail items as None (leaf node)', async () => {
      const { SampleTreeItemType, getCollapsibleState } = await import('../views/SampleTreeViewProvider');
      const vscode = await import('vscode');
      
      const state = getCollapsibleState(SampleTreeItemType.Detail);
      expect(state).toBe(vscode.TreeItemCollapsibleState.None);
    });
  });

  describe('getChildren', () => {
    it('should return Local and Global root items when called without element', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      // Mock workspace folders
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      // Mock fs to return empty for both local and global
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      const children = await provider.getChildren();
      
      expect(children).toHaveLength(2);
      expect(children[0].label).toBe('Samples (Local)');
      expect(children[1].label).toBe('Samples (Global)');
    });

    it('should return type items for root element', async () => {
      const { SampleTreeViewProvider, SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      // Mock local folder with DNA.json
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        if (p.includes('local') || p.includes('document')) return true;
        return false;
      });
      vi.mocked(fs.readdirSync).mockReturnValue(['DNA.json'] as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: [], sources: [] }
      }));
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      
      const rootItem = new SampleTreeItem('Samples (Local)', SampleTreeItemType.Root, { scope: 'local' });
      const children = await provider.getChildren(rootItem);
      
      // Should return all SAMPLE_TYPES (DNA, RNA, etc.)
      expect(children.length).toBeGreaterThan(0);
      expect(children.some(c => c.label?.toString().startsWith('DNA'))).toBe(true);
    });

    it('should return sample items for type element', async () => {
      const { SampleTreeViewProvider, SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      // Mock DNA.json with samples
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: ['설명1'], sources: ['test.md'] },
        'DNA-456': { type: 'DNA', alias: null, descriptions: [], sources: [] }
      }));
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      
      const typeItem = new SampleTreeItem('DNA [2]', SampleTreeItemType.Type, { scope: 'local', sampleType: 'DNA' });
      const children = await provider.getChildren(typeItem);
      
      expect(children).toHaveLength(2);
      expect(children[0].label).toBe('DNA-123 | 샘플A');
      expect(children[1].label).toBe('DNA-456');
    });

    it('returns an empty-state Detail row when a Type has no samples (Phase B-4, local)', async () => {
      const { SampleTreeViewProvider, SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');

      const mockContext = { subscriptions: [], extensionUri: { fsPath: '/test/extension' } };
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');

      const provider = new SampleTreeViewProvider(
        mockContext as any, '/test/workspace', '/test/document/folder'
      );
      const typeItem = new SampleTreeItem('DNA [0]', SampleTreeItemType.Type, {
        scope: 'local', sampleType: 'DNA',
      });
      const children = await provider.getChildren(typeItem);

      expect(children).toHaveLength(1);
      expect(children[0].itemType).toBe(SampleTreeItemType.Detail);
      // Label must mention "샘플 없음" so users can distinguish from a loading bug.
      expect(String(children[0].label)).toContain('샘플 없음');
      // Local placeholder hints at the right-click action.
      expect(String(children[0].label)).toContain('샘플 생성');
    });

    it('returns a global-flavored empty-state Detail row (Phase B-4, global)', async () => {
      const { SampleTreeViewProvider, SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');

      const mockContext = { subscriptions: [], extensionUri: { fsPath: '/test/extension' } };
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');

      const provider = new SampleTreeViewProvider(
        mockContext as any, '/test/workspace', '/test/document/folder'
      );
      const typeItem = new SampleTreeItem('RNA [0]', SampleTreeItemType.Type, {
        scope: 'global', sampleType: 'RNA',
      });
      const children = await provider.getChildren(typeItem);

      expect(children).toHaveLength(1);
      expect(String(children[0].label)).toContain('샘플 없음');
      // Global placeholder explains that samples appear automatically when
      // a matching `@type;id` definition is saved anywhere in the workspace.
      expect(String(children[0].label)).toContain('자동 등록');
    });

    it('applies a per-type ThemeIcon color to Type rows (Phase B-4)', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      const dna = new SampleTreeItem('DNA [1]', SampleTreeItemType.Type, {
        scope: 'local', sampleType: 'DNA',
      });
      // ThemeIcon is the concrete class; color is a ThemeColor when a palette
      // entry exists for the type.
      const icon = dna.iconPath as { id: string; color?: { id: string } };
      expect(icon.id).toBe('symbol-class');
      expect(icon.color?.id).toBe('charts.pink');
    });

    it('leaves unknown custom types with the default Type icon color (Phase B-4)', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      const custom = new SampleTreeItem('Oligo [0]', SampleTreeItemType.Type, {
        scope: 'local', sampleType: 'Oligo',
      });
      const icon = custom.iconPath as { id: string; color?: { id: string } };
      expect(icon.id).toBe('symbol-class');
      expect(icon.color).toBeUndefined();
    });

    it('should return detail items for sample element', async () => {
      const { SampleTreeViewProvider, SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      
      const sampleItem = new SampleTreeItem(
        'DNA-123 | 샘플A',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'DNA',
          sampleId: 'DNA-123',
          alias: '샘플A',
          sampleDescription: '테스트 설명'
        }
      );
      const children = await provider.getChildren(sampleItem);
      
      // Should return alias and description as detail items
      expect(children.length).toBeGreaterThanOrEqual(1);
      expect(children.some(c => c.label?.toString().includes('alias'))).toBe(true);
    });
  });

  describe('formatSampleLabel', () => {
    it('should format label with ID and alias', async () => {
      const { formatSampleLabel } = await import('../views/SampleTreeViewProvider');
      
      const label = formatSampleLabel('DNA-123', '샘플A');
      expect(label).toBe('DNA-123 | 샘플A');
    });

    it('should format label with ID only when no alias', async () => {
      const { formatSampleLabel } = await import('../views/SampleTreeViewProvider');
      
      const label = formatSampleLabel('DNA-123', null);
      expect(label).toBe('DNA-123');
    });

    it('should format label with ID only when alias is empty', async () => {
      const { formatSampleLabel } = await import('../views/SampleTreeViewProvider');
      
      const label = formatSampleLabel('DNA-123', '');
      expect(label).toBe('DNA-123');
    });
  });

  describe('Tree Order', () => {
    it('should display Local before Global in root', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      const children = await provider.getChildren();
      
      expect(children[0].scope).toBe('local');
      expect(children[1].scope).toBe('global');
    });
  });

  describe('Sample CRUD', () => {
    it('should add a new sample', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      
      await provider.addSample('local', 'DNA', 'DNA-999', '새샘플', '새로운 설명');
      
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should delete a sample', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: [], sources: [] }
      }));
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      
      await provider.deleteSample('local', 'DNA', 'DNA-123');
      
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should edit a sample', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: ['기존설명'], sources: [] }
      }));
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      
      await provider.editSample('local', 'DNA', 'DNA-123', '새별칭', '새설명');
      
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should replace description instead of accumulating when editing a sample (Phase A-5)', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'DNA-123': {
          type: 'DNA',
          alias: '샘플A',
          descriptions: ['기존설명1', '기존설명2'],
          sources: [],
        },
      }));

      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };

      const provider = new SampleTreeViewProvider(
        mockContext as any,
        '/test/workspace',
        '/test/document/folder'
      );

      await provider.editSample('local', 'DNA', 'DNA-123', '새별칭', '새설명');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.at(-1);
      expect(writeCall).toBeDefined();
      const payload = JSON.parse(writeCall![1] as string);
      // Phase A-5: descriptions must be overwritten, not prepended, so that
      // TreeView/InfoPanel always show exactly what the user just typed.
      expect(payload['DNA-123'].descriptions).toEqual(['새설명']);
      expect(payload['DNA-123'].alias).toBe('새별칭');
    });

    it('should clear description when editing with empty description (Phase A-5)', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'DNA-123': {
          type: 'DNA',
          alias: '샘플A',
          descriptions: ['지워질 설명'],
          sources: [],
        },
      }));

      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };

      const provider = new SampleTreeViewProvider(
        mockContext as any,
        '/test/workspace',
        '/test/document/folder'
      );

      await provider.editSample('local', 'DNA', 'DNA-123', '샘플A', null);

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls.at(-1);
      expect(writeCall).toBeDefined();
      const payload = JSON.parse(writeCall![1] as string);
      expect(payload['DNA-123'].descriptions).toEqual([]);
    });
  });

  describe('getInsertText', () => {
    it('should return ID|alias format when alias exists', async () => {
      const { SampleTreeItem, SampleTreeItemType, getInsertText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA-123 | 샘플A',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'DNA',
          sampleId: 'DNA-123',
          alias: '샘플A',
          sampleDescription: null
        }
      );
      
      const text = getInsertText(item);
      expect(text).toBe('DNA-123;샘플A');
    });

    it('should return ID only when no alias', async () => {
      const { SampleTreeItem, SampleTreeItemType, getInsertText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA-123',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'DNA',
          sampleId: 'DNA-123',
          alias: null,
          sampleDescription: null
        }
      );
      
      const text = getInsertText(item);
      expect(text).toBe('DNA-123');
    });
  });

  describe('getDefinitionText', () => {
    it('should return @type:ID|alias:description format for regular sample with all fields', async () => {
      const { SampleTreeItem, SampleTreeItemType, getDefinitionText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA-123 | 샘플A',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'DNA',
          sampleId: 'DNA-123',
          alias: '샘플A',
          sampleDescription: '테스트 설명'
        }
      );
      
      const text = getDefinitionText(item);
      expect(text).toBe('@dna;DNA-123;샘플A;테스트 설명');
    });

    it('should return @type:ID|alias format when no description', async () => {
      const { SampleTreeItem, SampleTreeItemType, getDefinitionText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'RNA-456 | SampleB',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'RNA',
          sampleId: 'RNA-456',
          alias: 'SampleB',
          sampleDescription: null
        }
      );
      
      const text = getDefinitionText(item);
      expect(text).toBe('@rna;RNA-456;SampleB');
    });

    it('should return @type:ID format when no alias or description', async () => {
      const { SampleTreeItem, SampleTreeItemType, getDefinitionText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'Plasmid-789',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'Plasmid',
          sampleId: 'Plasmid-789',
          alias: null,
          sampleDescription: null
        }
      );
      
      const text = getDefinitionText(item);
      expect(text).toBe('@plasmid;Plasmid-789');
    });

    it('should return @equip;;alias;description format for Equip (without ID)', async () => {
      const { SampleTreeItem, SampleTreeItemType, getDefinitionText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'Equip-001 | Centrifuge',
        SampleTreeItemType.Sample,
        { 
          scope: 'global', 
          sampleType: 'Equip',
          sampleId: 'Equip-001',
          alias: 'Centrifuge',
          sampleDescription: 'High-speed centrifuge'
        }
      );
      
      const text = getDefinitionText(item);
      // Equip should NOT include the ID in definition
      expect(text).toBe('@equip;;Centrifuge;High-speed centrifuge');
    });

    it('should return @equip;;alias format for Equip without description', async () => {
      const { SampleTreeItem, SampleTreeItemType, getDefinitionText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'Equip-002 | Incubator',
        SampleTreeItemType.Sample,
        { 
          scope: 'global', 
          sampleType: 'Equip',
          sampleId: 'Equip-002',
          alias: 'Incubator',
          sampleDescription: null
        }
      );
      
      const text = getDefinitionText(item);
      expect(text).toBe('@equip;;Incubator');
    });

    it('should return @equip; format for Equip without alias or description', async () => {
      const { SampleTreeItem, SampleTreeItemType, getDefinitionText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'Equip-003',
        SampleTreeItemType.Sample,
        { 
          scope: 'global', 
          sampleType: 'Equip',
          sampleId: 'Equip-003',
          alias: null,
          sampleDescription: null
        }
      );
      
      const text = getDefinitionText(item);
      expect(text).toBe('@equip;');
    });

    it('should handle Labware same as regular samples (with ID)', async () => {
      const { SampleTreeItem, SampleTreeItemType, getDefinitionText } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'Labware-100 | 96-well plate',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'Labware',
          sampleId: 'Labware-100',
          alias: '96-well plate',
          sampleDescription: 'Standard 96-well plate'
        }
      );
      
      const text = getDefinitionText(item);
      // Labware should include the ID (unlike Equip)
      expect(text).toBe('@labware;Labware-100;96-well plate;Standard 96-well plate');
    });
  });

  describe('contextValue with scope', () => {
    it('should set contextValue to sample_local for local samples', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA-123 | 샘플A',
        SampleTreeItemType.Sample,
        { 
          scope: 'local', 
          sampleType: 'DNA',
          sampleId: 'DNA-123',
          alias: '샘플A',
          sampleDescription: null
        }
      );
      
      expect(item.contextValue).toBe('sample_local');
    });

    it('should set contextValue to sample_global for global samples', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA-456 | 글로벌샘플',
        SampleTreeItemType.Sample,
        { 
          scope: 'global', 
          sampleType: 'DNA',
          sampleId: 'DNA-456',
          alias: '글로벌샘플',
          sampleDescription: null
        }
      );
      
      expect(item.contextValue).toBe('sample_global');
    });

    it('should keep contextValue as root for Root items', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'Samples (Local)',
        SampleTreeItemType.Root,
        { scope: 'local' }
      );
      
      expect(item.contextValue).toBe('root');
    });

    it('should keep contextValue as type for Type items', async () => {
      const { SampleTreeItem, SampleTreeItemType } = await import('../views/SampleTreeViewProvider');
      
      const item = new SampleTreeItem(
        'DNA [5]',
        SampleTreeItemType.Type,
        { scope: 'local', sampleType: 'DNA' }
      );
      
      expect(item.contextValue).toBe('type');
    });
  });

  describe('moveSampleToGlobal', () => {
    it('should move sample from local to global folder', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      // Mock local folder with sample, global folder empty
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
        if (filePath.includes('document') || filePath.includes('local')) {
          return JSON.stringify({
            'DNA-123': { type: 'DNA', alias: 'LocalSample', descriptions: ['Desc'], sources: ['test.md'] }
          });
        }
        return JSON.stringify({});
      });
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      
      await provider.moveSampleToGlobal('DNA', 'DNA-123');
      
      // Should save both local (without sample) and global (with sample)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should refresh tree after move', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'DNA-123': { type: 'DNA', alias: 'Test', descriptions: [], sources: [] }
      }));
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      const refreshSpy = vi.spyOn(provider, 'refresh');
      
      await provider.moveSampleToGlobal('DNA', 'DNA-123');
      
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('moveSampleToLocal', () => {
    it('should move sample from global to local folder', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      // Mock local folder empty, global folder with sample
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
        if (filePath.includes('document') || filePath.includes('local')) {
          return JSON.stringify({});
        }
        return JSON.stringify({
          'DNA-123': { type: 'DNA', alias: 'GlobalSample', descriptions: ['Desc'], sources: ['test.md'] }
        });
      });
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      
      await provider.moveSampleToLocal('DNA', 'DNA-123');
      
      // Should save both local (with sample) and global (without sample)
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should refresh tree after move', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'DNA-123': { type: 'DNA', alias: 'Test', descriptions: [], sources: [] }
      }));
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      const refreshSpy = vi.spyOn(provider, 'refresh');
      
      await provider.moveSampleToLocal('DNA', 'DNA-123');
      
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('getAllSamplesForSearch', () => {
    it('should return all samples from both local and global folders', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      // Mock DNA samples in local and global
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
        if (filePath.includes('local') || filePath.includes('document')) {
          return JSON.stringify({
            'DNA-111': { type: 'DNA', alias: '로컬샘플', descriptions: ['로컬 설명'], sources: [] }
          });
        }
        return JSON.stringify({
          'DNA-222': { type: 'DNA', alias: '글로벌샘플', descriptions: ['글로벌 설명'], sources: [] }
        });
      });
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      const samples = provider.getAllSamplesForSearch();
      
      expect(samples.length).toBeGreaterThanOrEqual(2);
      expect(samples.some(s => s.sampleId === 'DNA-111')).toBe(true);
      expect(samples.some(s => s.sampleId === 'DNA-222')).toBe(true);
    });

    it('should include scope information in results', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
        if (filePath.includes('local') || filePath.includes('document')) {
          return JSON.stringify({
            'DNA-111': { type: 'DNA', alias: '로컬', descriptions: [], sources: [] }
          });
        }
        return JSON.stringify({});
      });
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      const samples = provider.getAllSamplesForSearch();
      
      const localSample = samples.find(s => s.sampleId === 'DNA-111');
      expect(localSample?.scope).toBe('local');
    });

    it('should return empty array when no samples exist', async () => {
      const { SampleTreeViewProvider } = await import('../views/SampleTreeViewProvider');
      const fs = await import('fs');
      
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test/extension' },
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const provider = new SampleTreeViewProvider(mockContext as any, '/test/workspace', '/test/document/folder');
      const samples = provider.getAllSamplesForSearch();
      
      expect(samples).toEqual([]);
    });
  });
});
