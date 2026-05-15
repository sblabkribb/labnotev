/**
 * Issue #22 Q2 regression: when the Reagent/Labware product catalog is empty
 * (no reference DB files and no MongoDB results), the Search product button
 * used to silently fall through, leaving the user unsure whether the feature
 * was broken or just missing data. `showProductPicker` must now surface a
 * single information toast explaining the source paths and MongoDB toggle,
 * while still returning `null` so callers (the SampleCreateModal autofill,
 * `createSampleWithPrompt`, etc.) keep their existing no-op behaviour.
 */
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

// Force getProductCandidates to return [] by stubbing both data sources.
vi.mock('../lib/sampleStorage', () => ({
  getLabsamplesFolder: vi.fn(() => '/test/local/resources/labsamples'),
  getGlobalLabsamplesFolder: vi.fn(() => '/test/global/resources/labsamples'),
  loadReferenceSamplesByType: vi.fn(() => ({})),
}));

vi.mock('../lib/dataLoader', () => ({
  ensureRemoteDataLoaded: vi.fn(() => Promise.resolve()),
  getMongoIds: vi.fn(() => [] as string[]),
  getMongoRecord: vi.fn(() => undefined),
  MONGO_BACKED_TYPES: ['Equip', 'Labware'] as const,
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
    // Labware-specific hint: mention the MongoDB toggle so users know the
    // remote catalog source is opt-in.
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringMatching(/labnotev\.enableMongo/)
    );
  });
});
