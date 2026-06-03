import './setup';

class FakeDataTransfer {
  private map = new Map<string, { value: unknown }>();
  set(mime: string, item: { value: unknown }): void {
    this.map.set(mime, item);
  }
  get(mime: string): { value: unknown } | undefined {
    return this.map.get(mime);
  }
}

describe('SampleTreeDragAndDropController (Phase D-3)', () => {
  it('writes the @type;id;alias;description payload to text/plain for Sample items', async () => {
    const {
      SampleTreeDragAndDropController,
      SampleTreeItem,
      SampleTreeItemType,
      SAMPLE_TREE_DND_MIME,
    } = await import('../views/SampleTreeViewProvider');

    const controller = new SampleTreeDragAndDropController();
    const dragged = new SampleTreeItem('DNA-123', SampleTreeItemType.Sample, {
      scope: 'local',
      sampleType: 'DNA',
      sampleId: 'DNA-123',
      alias: '샘플1',
      sampleDescription: '설명',
    });

    const dt = new FakeDataTransfer();
    controller.handleDrag([dragged], dt as any, {} as any);

    expect(dt.get('text/plain')?.value).toBe('@dna;DNA-123;샘플1;설명');
    const structured = dt.get(SAMPLE_TREE_DND_MIME)?.value as Array<Record<string, unknown>>;
    expect(structured).toHaveLength(1);
    expect(structured[0]).toMatchObject({
      scope: 'local',
      sampleType: 'DNA',
      sampleId: 'DNA-123',
      alias: '샘플1',
      sampleDescription: '설명',
    });
  });

  it('omits the id for Equip type to match getDefinitionText', async () => {
    const { SampleTreeDragAndDropController, SampleTreeItem, SampleTreeItemType } = await import(
      '../views/SampleTreeViewProvider'
    );
    const controller = new SampleTreeDragAndDropController();
    const dragged = new SampleTreeItem('Centrifuge', SampleTreeItemType.Sample, {
      scope: 'global',
      sampleType: 'Equip',
      sampleId: 'Equip-5',
      alias: 'Eppendorf 5424',
      sampleDescription: null,
    });

    const dt = new FakeDataTransfer();
    controller.handleDrag([dragged], dt as any, {} as any);

    expect(dt.get('text/plain')?.value).toBe('@equip;;Eppendorf 5424');
  });

  it('does not emit any payload for non-Sample nodes', async () => {
    const { SampleTreeDragAndDropController, SampleTreeItem, SampleTreeItemType } = await import(
      '../views/SampleTreeViewProvider'
    );
    const controller = new SampleTreeDragAndDropController();
    const typeNode = new SampleTreeItem('DNA [0]', SampleTreeItemType.Type, {
      scope: 'local',
      sampleType: 'DNA',
    });

    const dt = new FakeDataTransfer();
    controller.handleDrag([typeNode], dt as any, {} as any);

    expect(dt.get('text/plain')).toBeUndefined();
  });

  it('joins multi-selection payloads with newlines', async () => {
    const { SampleTreeDragAndDropController, SampleTreeItem, SampleTreeItemType } = await import(
      '../views/SampleTreeViewProvider'
    );
    const controller = new SampleTreeDragAndDropController();
    const a = new SampleTreeItem('DNA-1', SampleTreeItemType.Sample, {
      scope: 'local',
      sampleType: 'DNA',
      sampleId: 'DNA-1',
      alias: null,
      sampleDescription: null,
    });
    const b = new SampleTreeItem('RNA-2', SampleTreeItemType.Sample, {
      scope: 'local',
      sampleType: 'RNA',
      sampleId: 'RNA-2',
      alias: null,
      sampleDescription: null,
    });

    const dt = new FakeDataTransfer();
    controller.handleDrag([a, b], dt as any, {} as any);

    expect(dt.get('text/plain')?.value).toBe('@dna;DNA-1\n@rna;RNA-2');
  });
});

// Issue #18-1: drag-and-drop reordering of samples within the same scope+type.
// The controller computes the new key order from the current sample ids and
// delegates persistence to provider.reorderSamples().
describe('SampleTreeDragAndDropController reordering (issue #18-1)', () => {
  type Sample = {
    scope: 'local' | 'global';
    sampleType: string;
    sampleId: string;
  };

  async function makeController(initial: Record<string, string[]>) {
    const { SampleTreeDragAndDropController, SampleTreeItem, SampleTreeItemType } = await import(
      '../views/SampleTreeViewProvider'
    );
    // initial keyed by `${scope}/${type}` -> ordered ids
    const store: Record<string, string[]> = { ...initial };
    const reorderCalls: Array<{ scope: string; type: string; orderedIds: string[] }> = [];
    const provider = {
      getSampleIds: vi.fn((scope: 'local' | 'global', type: string): string[] => {
        return store[`${scope}/${type}`] ? [...store[`${scope}/${type}`]] : [];
      }),
      reorderSamples: vi.fn((scope: 'local' | 'global', type: string, orderedIds: string[]): void => {
        reorderCalls.push({ scope, type, orderedIds });
        store[`${scope}/${type}`] = [...orderedIds];
      }),
    };
    const controller = new SampleTreeDragAndDropController(provider as any);

    const makeSampleItem = (s: Sample) =>
      new SampleTreeItem(s.sampleId, SampleTreeItemType.Sample, {
        scope: s.scope,
        sampleType: s.sampleType,
        sampleId: s.sampleId,
        alias: null,
        sampleDescription: null,
      });

    const makeTypeItem = (scope: 'local' | 'global', sampleType: string) =>
      new SampleTreeItem(`${sampleType} [0]`, SampleTreeItemType.Type, {
        scope,
        sampleType,
      });

    return { controller, provider, reorderCalls, makeSampleItem, makeTypeItem };
  }

  function dataTransferFor(samples: Sample[]): FakeDataTransfer {
    const dt = new FakeDataTransfer();
    dt.set(
      'application/vnd.code.tree.labnotev.sampleTreeView',
      { value: samples.map(s => ({ ...s, alias: null, sampleDescription: null })) }
    );
    return dt;
  }

  it('inserts dragged sample before the drop-target sample (same scope+type)', async () => {
    const { controller, makeSampleItem, reorderCalls } = await makeController({
      'local/DNA': ['DNA-1', 'DNA-2', 'DNA-3'],
    });
    const target = makeSampleItem({ scope: 'local', sampleType: 'DNA', sampleId: 'DNA-1' });
    const dt = dataTransferFor([{ scope: 'local', sampleType: 'DNA', sampleId: 'DNA-3' }]);

    await controller.handleDrop(target, dt as any, {} as any);

    expect(reorderCalls).toHaveLength(1);
    expect(reorderCalls[0]).toEqual({
      scope: 'local',
      type: 'DNA',
      orderedIds: ['DNA-3', 'DNA-1', 'DNA-2'],
    });
  });

  it('ignores drops whose source scope or type differs from the target', async () => {
    const { controller, makeSampleItem, reorderCalls } = await makeController({
      'local/DNA': ['DNA-1', 'DNA-2'],
      'global/RNA': ['RNA-1'],
    });
    const target = makeSampleItem({ scope: 'local', sampleType: 'DNA', sampleId: 'DNA-1' });
    // source RNA in different scope+type
    const dt = dataTransferFor([{ scope: 'global', sampleType: 'RNA', sampleId: 'RNA-1' }]);

    await controller.handleDrop(target, dt as any, {} as any);

    expect(reorderCalls).toHaveLength(0);
  });

  it('moves dragged samples to the end when dropped on a Type node', async () => {
    const { controller, makeTypeItem, reorderCalls } = await makeController({
      'local/DNA': ['DNA-1', 'DNA-2', 'DNA-3'],
    });
    const target = makeTypeItem('local', 'DNA');
    const dt = dataTransferFor([{ scope: 'local', sampleType: 'DNA', sampleId: 'DNA-1' }]);

    await controller.handleDrop(target, dt as any, {} as any);

    expect(reorderCalls).toHaveLength(1);
    expect(reorderCalls[0]).toEqual({
      scope: 'local',
      type: 'DNA',
      orderedIds: ['DNA-2', 'DNA-3', 'DNA-1'],
    });
  });

  it('preserves relative order of multi-selection sources when inserting before target', async () => {
    const { controller, makeSampleItem, reorderCalls } = await makeController({
      'local/DNA': ['DNA-1', 'DNA-2', 'DNA-3', 'DNA-4'],
    });
    const target = makeSampleItem({ scope: 'local', sampleType: 'DNA', sampleId: 'DNA-2' });
    const dt = dataTransferFor([
      { scope: 'local', sampleType: 'DNA', sampleId: 'DNA-3' },
      { scope: 'local', sampleType: 'DNA', sampleId: 'DNA-4' },
    ]);

    await controller.handleDrop(target, dt as any, {} as any);

    expect(reorderCalls).toHaveLength(1);
    expect(reorderCalls[0]).toEqual({
      scope: 'local',
      type: 'DNA',
      orderedIds: ['DNA-1', 'DNA-3', 'DNA-4', 'DNA-2'],
    });
  });
});
