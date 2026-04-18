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
