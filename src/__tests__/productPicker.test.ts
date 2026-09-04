/**
 * Issue #22 Q2 regression: when the product catalog is empty (no reference DB
 * files), the Search product button used to silently fall through, leaving the
 * user unsure whether the feature was broken or just missing data.
 * `showProductPicker` must now surface a single information toast explaining the
 * source paths, while still returning `null` so callers (the SampleCreateModal
 * autofill, `createSampleWithPrompt`, etc.) keep their existing no-op behaviour.
 */
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

// Force getProductCandidates to return [] by stubbing the data source.
vi.mock('../lib/sampleStorage', () => ({
  getLabsamplesFolder: vi.fn(() => '/test/local/resources/labsamples'),
  getGlobalLabsamplesFolder: vi.fn(() => '/test/global/resources/labsamples'),
  loadReferenceSamplesByType: vi.fn(() => ({})),
}));

describe('showProductPicker — empty candidate guard (issue #22 Q2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const documentUri = { fsPath: '/test/workspace/exp/foo.labnote.md' } as any;

  it('shows an information toast and returns null when no Reagent candidates exist', async () => {
    const { showProductPicker } = await import('../lib/productPicker');

    const result = await showProductPicker('Reagent', documentUri);

    expect(result).toBeNull();
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Reagent')
    );
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringMatching(/resources[\\/]labsamples/)
    );
    // The QuickPick must not appear when there are no candidates.
    expect(mockVscode.window.showQuickPick).not.toHaveBeenCalled();
  });

  it('shows an information toast and returns null when no Labware candidates exist', async () => {
    const { showProductPicker } = await import('../lib/productPicker');

    const result = await showProductPicker('Labware', documentUri);

    expect(result).toBeNull();
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Labware')
    );
    // The empty-catalog hint points at the JSON reference DB path.
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringMatching(/resources[\\/]labsamples/)
    );
  });
});

/**
 * Issue #28: Equip was excluded from `REFERENCE_DB_TYPES`, so the Search
 * product button (and `getProductCandidates`) treated Equip as unsearchable
 * and returned []. Equip must be searched against its reference JSON
 * (local + global Equip_*.json).
 */
describe('getProductCandidates — Equip reference DB (issue #28)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const documentUri = { fsPath: '/test/workspace/exp/foo.labnote.md' } as any;

  it('returns Equip candidates from the reference DB', async () => {
    const { loadReferenceSamplesByType } = await import('../lib/sampleStorage');

    // Local folder returns one Equip record; global folder is empty.
    vi.mocked(loadReferenceSamplesByType).mockImplementation(
      (_fs: any, folder: string, type: string) => {
        if (type === 'Equip' && folder.includes('local')) {
          return Promise.resolve({
            'Equip-001': { alias: 'Centrifuge', descriptions: ['5424 R'] },
          } as any);
        }
        return Promise.resolve({} as any);
      }
    );

    const { getProductCandidates } = await import('../lib/productPicker');
    const candidates = await getProductCandidates('Equip', documentUri);

    expect(candidates).toEqual([
      { id: 'Equip-001', alias: 'Centrifuge', description: '5424 R' },
    ]);
  });
});
