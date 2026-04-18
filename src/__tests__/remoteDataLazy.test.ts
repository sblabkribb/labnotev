/**
 * Phase 1 regression test: `ensureRemoteDataLoaded` must be a lazy,
 * idempotent entry point so activation never waits for MongoDB.
 *
 * Covered:
 * - No-op (returns immediately, no connection attempt) when `mongoUrl` is
 *   empty, and the warning is printed at most once.
 * - Concurrent calls return the same in-flight promise (initRemoteData is
 *   invoked exactly once).
 * - After a successful load, subsequent calls are no-ops.
 * - `onRemoteDataLoaded` fires once after a successful load.
 */

// Capture created EventEmitter instances so the test can observe `fire`.
const createdEmitters: Array<{ fire: ReturnType<typeof vi.fn>; event: ReturnType<typeof vi.fn> }> = [];

let mongoUrlMock = '';
let enableMongoMock = true;

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'enableMongo') return enableMongoMock;
        if (key === 'mongoUrl') return mongoUrlMock;
        if (key === 'mongoDbName') return 'SBLIMS';
        return defaultValue;
      }),
    })),
    workspaceFolders: [],
  },
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
    constructor() {
      createdEmitters.push(this);
    }
  },
}));

// Stub the `mongodb` dynamic import so the real driver isn't required in CI.
const connectMock = vi.fn(() => Promise.resolve());
const findToArrayMock = vi.fn(() => Promise.resolve([]));
const mongoClientInstances: unknown[] = [];
function MongoClientMock(this: unknown, _url: string, _opts?: unknown) {
  const instance = {
    connect: connectMock,
    db: () => ({
      collection: () => ({
        find: () => ({ toArray: findToArrayMock }),
      }),
    }),
    close: vi.fn(() => Promise.resolve()),
  };
  mongoClientInstances.push(instance);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  return instance;
}
const MongoClientSpy = vi.fn(MongoClientMock as unknown as (...args: unknown[]) => unknown);
vi.mock('mongodb', () => ({
  MongoClient: MongoClientSpy,
}));

describe('ensureRemoteDataLoaded (Phase 1)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    createdEmitters.length = 0;
    mongoUrlMock = '';
    enableMongoMock = true;

    // Reset dataLoader module state between tests so `loaded` / `loadingPromise`
    // start fresh. Also reset mongodb mock calls.
    mongoClientInstances.length = 0;
    vi.resetModules();
    // Re-install the mongodb mock after resetModules, since vi.resetModules
    // clears per-module state.
    vi.doMock('mongodb', () => ({ MongoClient: MongoClientSpy }));
  });

  it('is a no-op when mongoUrl is not configured', async () => {
    const { ensureRemoteDataLoaded } = await import('../lib/dataLoader');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await ensureRemoteDataLoaded();
    await ensureRemoteDataLoaded();

    expect(MongoClientSpy).not.toHaveBeenCalled();
    // Warning should be emitted at most once even across multiple calls.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('is a no-op when enableMongo is false, regardless of mongoUrl', async () => {
    enableMongoMock = false;
    mongoUrlMock = 'mongodb://fake';
    const { ensureRemoteDataLoaded } = await import('../lib/dataLoader');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await ensureRemoteDataLoaded();
    await ensureRemoteDataLoaded();

    expect(MongoClientSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('deduplicates concurrent calls (initRemoteData runs once)', async () => {
    mongoUrlMock = 'mongodb://fake';
    const { ensureRemoteDataLoaded } = await import('../lib/dataLoader');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await Promise.all([
      ensureRemoteDataLoaded(),
      ensureRemoteDataLoaded(),
      ensureRemoteDataLoaded(),
    ]);

    expect(MongoClientSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('is a no-op after a successful load', async () => {
    mongoUrlMock = 'mongodb://fake';
    const { ensureRemoteDataLoaded } = await import('../lib/dataLoader');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await ensureRemoteDataLoaded();
    expect(MongoClientSpy).toHaveBeenCalledTimes(1);

    await ensureRemoteDataLoaded();
    expect(MongoClientSpy).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });

  it('fires onRemoteDataLoaded once after a successful load', async () => {
    mongoUrlMock = 'mongodb://fake';
    const { ensureRemoteDataLoaded } = await import('../lib/dataLoader');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await ensureRemoteDataLoaded();

    // dataLoader's internal EventEmitter is the first one created.
    const emitter = createdEmitters[0];
    expect(emitter).toBeTruthy();
    expect(emitter.fire).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });
});
