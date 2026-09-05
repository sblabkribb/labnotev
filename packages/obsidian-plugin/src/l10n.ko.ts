/**
 * Obsidian-only Korean catalog.
 *
 * These keys are used by the Obsidian plugin via `this.t()` / `host.t()` but are
 * NOT referenced by the VS Code extension's `l10n.t()`. They are kept out of the
 * shared `l10n/bundle.l10n.ko.json` on purpose: `src/__tests__/l10nCoverage.test.ts`
 * fails on "stale" bundle keys that never appear in the VS Code `src/`. This
 * catalog is merged over the shared bundle at runtime in `i18n.ts` (ko locale).
 *
 * Conventions mirror the shared bundle: 워크플로 / 샘플 / 유닛 오퍼레이션 / 실험,
 * formal (존댓말) tone, and positional `{0}` / literal `{Type}` placeholders left
 * intact for `formatMessage`.
 */
const obsidianKo: Record<string, string> = {
  // Commands
  'Create experiment': '실험 생성',
  'Create workflow': '워크플로 생성',
  'Insert unit operation': '유닛 오퍼레이션 삽입',
  'Insert date': '날짜 삽입',
  'Insert date and time': '날짜 및 시간 삽입',
  'Export tables to CSV': '표를 CSV로 내보내기',
  'Open workflow view': '워크플로 뷰 열기',
  'Open sample view': '샘플 뷰 열기',
  'Toggle MCP server': 'MCP 서버 켜기/끄기',
  'AI: Draft Method section': 'AI: Method 섹션 초안 작성',
  'AI: Summarize results': 'AI: 결과 요약',
  'AI: Extract sample definitions': 'AI: 샘플 정의 추출',

  // View titles / ribbon
  'Workflows': '워크플로',
  'Samples': '샘플',

  // Pickers / prompts
  'New experiment': '새 실험',
  'Experiment title': '실험 제목',
  'Title is required.': '제목을 입력해야 합니다.',
  'Select experiment folder': '실험 폴더 선택',
  'Select workflow': '워크플로 선택',
  'Search workflows': '워크플로 검색',
  'Search unit operations': '유닛 오퍼레이션 검색',
  'No experiment folder found. Create one first.': '실험 폴더를 찾을 수 없습니다. 먼저 생성하세요.',
  'Open a lab note first.': '먼저 랩노트 파일을 여세요.',
  'Workflow name': '워크플로 이름',
  'Enter a name for this workflow': '이 워크플로의 상세 별칭을 입력하세요',

  // Notices / results
  'Experiment created: {0}': '실험이 생성되었습니다: {0}',
  'Exported {0} CSV file(s).': 'CSV 파일 {0}개를 내보냈습니다.',
  'No tables found in this note.': '이 노트에서 표를 찾을 수 없습니다.',
  'Command failed: {0}': '명령 실행 실패: {0}',

  // Sample view context menu
  'Copy sample ID': '샘플 ID 복사',
  'Copied: {0}': '복사했습니다: {0}',
  'Insert reference at cursor': '커서 위치에 참조 삽입',
  'Open a note to insert into.': '삽입할 노트를 여세요.',
  'No samples found.': '샘플을 찾을 수 없습니다.',

  // Settings tab
  'Sample tracking': '샘플 추적',
  'Autocomplete, highlighting and {Type}.json sync. Reload to apply.':
    '자동완성, 하이라이팅 및 {Type}.json 동기화. 적용하려면 다시 로드하세요.',
  'Custom sample types': '사용자 정의 샘플 타입',
  'Comma-separated types in addition to the built-ins.':
    '기본 제공 타입 외에 추가할 타입을 쉼표로 구분해 입력합니다.',
  'Global sample folder': '전역 샘플 폴더',
  'Vault-relative folder for vault-global samples.':
    '볼트 전역 샘플을 저장할 볼트 기준 상대 폴더입니다.',
  'AI provider': 'AI 프로바이더',
  'Provider': '프로바이더',
  'Disabled': '비활성화됨',
  'Endpoint': '엔드포인트',
  'Model': '모델',
  'API key': 'API 키',
  'Only sent to OpenAI-compatible providers, never to Ollama.':
    'OpenAI 호환 프로바이더에만 전송되며, Ollama에는 전송되지 않습니다.',
  'Enable MCP server': 'MCP 서버 활성화',
  'Desktop only. Exposes tools to external MCP clients.':
    '데스크톱 전용. 외부 MCP 클라이언트에 도구를 노출합니다.',

  // AI commands
  'Configure an AI provider in settings first.': '먼저 설정에서 AI 프로바이더를 구성하세요.',
  'Contacting {0}…': '{0}에 연결 중…',
  'AI request failed: {0}': 'AI 요청 실패: {0}',
  'Open a note first.': '먼저 노트를 여세요.',
  'Open a markdown note first.': '먼저 마크다운 노트를 여세요.',
  'Nothing to summarize.': '요약할 내용이 없습니다.',
  'Nothing to extract.': '추출할 내용이 없습니다.',
  'Created {0} sample(s).': '샘플 {0}개를 생성했습니다.',

  // MCP server
  'MCP server is desktop-only.': 'MCP 서버는 데스크톱 전용입니다.',
  'MCP server started on 127.0.0.1:{0}': 'MCP 서버가 127.0.0.1:{0}에서 시작되었습니다',
  'Allow MCP tool "{0}" to modify the vault?': 'MCP 도구 "{0}"가 볼트를 수정하도록 허용할까요?',
  'Allow': '허용',
};

export default obsidianKo;
