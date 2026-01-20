# Lab Note Editor

VS Code용 마크다운 기반 실험실 노트 에디터입니다. 샘플 ID 관리, 워크플로 템플릿, 유닛 오퍼레이션 카탈로그를 통해 체계적인 과학 문서화를 지원합니다.

## 주요 기능

### 📝 마크다운 텍스트 에디터 (기본)
- **VS Code 기본 마크다운 에디터**: 모든 `.md` 파일이 기본 텍스트 에디터로 열림
- **@ 기반 자동완성**: `@dna:`, `@rna:`, `@sample:` 등으로 샘플 ID 자동완성
- **AI 편집 지원**: Cursor, Copilot 등 AI 도구와 완벽한 호환

### 🖼️ 이미지 처리
- **클립보드 이미지 붙여넣기** (Ctrl+V)
- **이미지 미리보기 패널**: 이미지 링크 클릭 시 별도 패널에서 이미지 열기
  - 닫기 버튼을 누르기 전까지 패널 유지
  - 여러 이미지를 동시에 여러 패널로 열기 가능
  - 줌 컨트롤 (+, -, Reset)
  - 키보드 단축키: Esc(닫기), +/-(줌), 0(리셋)

### 🔬 샘플 ID 관리

#### @ 기반 자동완성 (텍스트 에디터)
- `@dna:`, `@rna:`, `@plasmid:`, `@reagent:`, `@primer:`, `@labware:` - 타입별 샘플 검색
- `@sample:` - 모든 타입 샘플 검색
- `@equip:` - MongoDB 연동 장비 검색 (새 ID 생성 불가)
- 검색어 입력으로 필터링 (예: `@dna:test`)
- "새 ID 생성", "정보 입력" 옵션 제공 (Equip 제외)

#### 샘플 삽입 형식

| 상황 | 입력 | 결과 |
|------|------|------|
| **기존 샘플 참조** | `@dna:` → 기존 샘플 선택 | `DNA-123\|SampleA` (`@dna:` 제거됨) |
| **새 샘플 정의** | `@dna:` → 새 ID 생성 | `@dna:DNA-xxx\|별칭:설명` |
| **TreeView 참조** | 샘플 더블클릭 | `DNA-123\|SampleA` |
| **TreeView 정의** | 샘플 우클릭 → Insert Definition | `@dna:DNA-123\|SampleA:설명` |
| **Equip 정의** | Insert Definition | `@equip:\|별칭:설명` (ID 없음) |

- 참조: 본문에서 기존 샘플을 언급할 때 사용 (ID와 별칭만)
- 정의: 샘플을 처음 정의할 때 사용 (`@type:` 접두어 + 설명 포함)


#### 공통 기능
- **샘플 ID 하이라이팅**: 타입별 색상으로 샘플 ID 강조 표시 (항상 활성화)
  - DNA, RNA, Plasmid, Reagent, Primer, Equip, Labware 지원
- **Sample Info 패널**: 문서 내 모든 샘플 ID 조회
  - 별칭, 설명, 출처 표시
  - 위치로 이동, Rename, Replace 기능
- **자동 저장**: 문서 저장 시 샘플 정보를 JSON으로 자동 저장 (항상 활성화)
  - `resources/labsamples/{TYPE}.json`에 저장
  - 지원 형식: `@type:ID|별칭:설명`, `ID|별칭:설명`, `ID|별칭`, `ID: 설명`

### 🌲 Sample TreeView (Activity Bar)
- **트리뷰 표시**: VS Code Activity Bar에 플라스크 아이콘으로 샘플 패널 표시
- **Local/Global 구분**: 문서 폴더와 워크스페이스 루트의 샘플 분리 표시
- **계층 구조**:
  - `Samples (Local)` / `Samples (Global)`: 루트 노드 (언폴딩)
  - `DNA [3]`, `RNA [1]` 등: 타입별 노드 (언폴딩)
  - `DNA-123 | 샘플A`: 개별 샘플 (폴딩, 클릭하여 상세 정보)
- **컨텍스트 메뉴**:
  - 샘플 더블클릭: 에디터에 `ID|별칭` 삽입 (참조)
  - 샘플 우클릭 → Insert Definition: `@{type}:ID|별칭:설명` 삽입 (정의)
  - 타입 우클릭: 새 샘플 추가
  - 샘플 우클릭: 편집 / 삭제
  - Local 샘플 우클릭 → Move to Global: 샘플을 Global로 이동
  - Global 샘플 우클릭 → Move to Local: 샘플을 Local로 이동
- **샘플 검색**: 트리뷰 제목 바의 🔍 아이콘 또는 `Lab Note: Search Sample` 명령어
  - QuickPick으로 ID, 별칭, 설명 검색
  - 선택 시 에디터에 자동 삽입
- **설정**: Sample TreeView 사용으로 `Sample Tracking: Yes` 설정 불필요

### 🔬 Workflow TreeView (Activity Bar)
- **워크플로 트리뷰**: Activity Bar의 Lab Samples 패널에 "Workflows" 세션
- **계층 구조**:
  - `Workflows [68]`: 루트 노드
    - `Design [13]`: 설계 워크플로 카테고리
    - `Build [18]`: 구축 워크플로 카테고리
    - `Test [19]`: 테스트 워크플로 카테고리
    - `Learn [12]`: 학습 워크플로 카테고리
    - 개별 워크플로: `WD010: General Design of Experiment`
  - `HW Unit Operations [50]`: 하드웨어 유닛 오퍼레이션
    - `UHW010: Liquid Handling`, `UHW020: 96 Channel Liquid Handling` 등
  - `SW Unit Operations [40]`: 소프트웨어 유닛 오퍼레이션
    - `USW010: DNA Oligomer Pool Design`, `USW020: Primer Design` 등
- **워크플로 명령어**:
  - 워크플로 항목 `[Create]` 버튼: README.md에서 워크플로 파일 생성
  - 워크플로 우클릭 → Edit, Delete: JSON 수정/삭제
  - 카테고리 우클릭 → Add Workflow: 새 워크플로 추가
- **유닛 오퍼레이션 명령어**:
  - 유닛 오퍼레이션 `[Insert]` 버튼: 현재 커서 위치에 템플릿 삽입
  - 유닛 오퍼레이션 우클릭 → Edit, Delete: JSON 수정/삭제
  - 루트 우클릭 → Add Unit Operation: 새 유닛 오퍼레이션 추가
- **검색 기능**: 트리뷰 제목 바의 🔍 아이콘으로 워크플로/유닛 오퍼레이션 검색
  - 선택 시 해당 작업 수행 (워크플로: Create, 유닛오퍼레이션: Insert)
- **리소스 자동 복사**: 처음 실행 시 확장의 JSON 파일이 워크스페이스로 복사
  - 사용자가 자유롭게 편집 가능

### 📁 실험 노트 폴더 구조
- **자동 폴더 생성**: 명령으로 표준화된 폴더 구조 생성
  - `labnote/{번호}_{제목}/`
  - `README.md`, `images/`, `resources/` 자동 생성
- **자동 번호 부여**: 001, 002, ... 순차적 번호

### 📅 날짜 관리
- **날짜 삽입**: 현재 날짜/시간을 한국 시간대(KST) 기준으로 삽입
- **날짜 필드 업데이트**: YAML Front Matter의 날짜 필드 자동 업데이트
- **키보드 단축키**:
  - `Ctrl+Shift+D` / `Cmd+Shift+D`: 날짜/시간 삽입
  - `Ctrl+Shift+U` / `Cmd+Shift+U`: 날짜 필드 업데이트

### 📋 YAML Front Matter 지원
- **YAML 보존**: 문서 시작의 `---` 블록이 에디터에서 코드 블록으로 표시되고 저장 시 복원
- **메타데이터 편집**: `created_date`, `last_updated_date` 등 YAML 필드 편집 가능

### 🎨 VS Code 통합
- **테마 지원**: VS Code 라이트/다크 테마에 자동 적응
- **기본 에디터**: 모든 `.md` 파일이 마크다운 텍스트 에디터로 열림

### ⚙️ MongoDB 연동 (선택)
Equip, Labware 타입의 샘플은 SBLIMS MongoDB 데이터베이스에서 자동으로 로드됩니다.

#### 설정 방법
1. VS Code 설정 열기 (`Ctrl+,`)
2. "Lab Note Editor" 검색
3. 다음 설정 입력:
   - `Mongo Url`: MongoDB 연결 URL
   - `Mongo Db Name`: 데이터베이스 이름 (기본값: SBLIMS)

#### 연결 URL 형식
```
mongodb://username:password@host:port/?authMechanism=SCRAM-SHA-256&authSource=SBLIMS
```

## 설치

### GitHub Releases에서 설치 (권장)

1. [Releases](https://github.com/sblabkribb/labnotev/releases) 페이지에서 최신 `.vsix` 파일 다운로드
2. VS Code에서 설치:
   - **방법 A**: 명령줄에서 `code --install-extension labnotev-x.x.x.vsix`
   - **방법 B**: VS Code → `Ctrl+Shift+P` → "Extensions: Install from VSIX..." → 파일 선택

### 소스에서 설치

1. 저장소 클론:
```bash
git clone <repository-url>
cd labnotev
```

2. 의존성 설치:
```bash
npm run install:all
```

3. 확장 빌드:
```bash
npm run build
```

4. VS Code에서 열고 `F5`를 눌러 디버깅 시작

## 사용법

### 새 실험 노트 생성

1. 명령 팔레트 열기 (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. "Lab Note: Create New Labnote Folder" 입력
3. 실험 제목과 작성자 이름 입력
4. `labnote/{번호}_{제목}/` 폴더 구조가 생성되고 README.md가 열림
   - `README.md`: YAML front matter 포함 템플릿
   - `images/`: 이미지 저장 폴더
   - `resources/`: 리소스 저장 폴더

### VS Code 명령어

| 명령어 | 설명 |
|--------|------|
| `Lab Note: Create New Labnote Folder` | 새 실험 노트 폴더 구조 생성 |
| `Lab Note: Add Workflow` | 워크플로 템플릿 추가 |
| `Lab Note: Add Unit Operation` | 유닛 오퍼레이션 추가 |
| `Lab Note: Insert Current Date` | 현재 날짜 삽입 |
| `Lab Note: Insert Current Date and Time` | 현재 날짜/시간 삽입 |
| `Lab Note: Update Date Field on Current Line` | 현재 줄의 날짜 필드 업데이트 |
| `Lab Note: Update All last_updated_date Fields` | 모든 날짜 필드 업데이트 |
| `Lab Note: Show Sample Info Panel` | 샘플 정보 패널 표시 |

## 개발

### 프로젝트 구조

```
labnotev/
├── src/                          # Extension 소스 코드
│   ├── extension.ts              # 메인 진입점
│   ├── labNoteEditorProvider.ts  # 커스텀 에디터 프로바이더
│   ├── lib/                      # 공유 라이브러리 (Extension + Webview)
│   │   ├── dateUtils.ts          # 날짜/시간 처리 함수
│   │   ├── sampleUtils.ts        # 샘플 ID 생성 및 상수
│   │   ├── sampleDecorations.ts  # VS Code 텍스트 데코레이션
│   │   ├── sampleStorage.ts      # 샘플 정보 저장/로드
│   │   └── labnoteStructure.ts   # 실험 노트 폴더 구조 생성
│   └── views/                    # Webview 패널
│       └── SampleInfoPanel.ts
├── snippets/                     # VS Code Snippet 정의
│   └── markdown.json             # 날짜 관련 스니펫
├── webview/                      # Webview (React 앱)
│   └── src/
│       ├── Editor.tsx            # 메인 에디터 컴포넌트
│       ├── slashCommands.ts      # 커스텀 슬래시 명령
│       ├── data/                 # 데이터 파일
│       │   ├── workflows.ts      # 워크플로 템플릿 (29개)
│       │   └── unitOperations.ts # 유닛 오퍼레이션 (35개)
│       ├── blocks/               # 커스텀 블록 타입
│       └── hooks/                # React 훅
└── dist/                         # 컴파일된 출력
```

### 사용 가능한 스크립트

```bash
# Extension 및 Webview 빌드
npm run build

# Extension만 빌드
npm run build:extension

# Webview만 빌드
npm run build:webview

# Watch 모드 (변경 시 자동 재빌드)
npm run watch

# 개발 모드 (Extension과 Webview 모두 Watch)
npm run dev

# 테스트 실행
npm test

# Watch 모드로 테스트 실행
npm run test:watch

# 모든 테스트 실행 (Extension + Webview)
npm run test:all
```

### 디버깅

1. VS Code에서 프로젝트 열기
2. `F5`를 눌러 디버깅 시작
3. 새 Extension Development Host 창이 열림
4. 새 창에서 `.md` 파일을 열어 테스트

## 테스트

프로젝트에는 포괄적인 테스트 커버리지가 포함되어 있습니다:

- **Extension 테스트**: 333개 (19개 파일)
- **Webview 테스트**: 153개 (7개 파일)
- **테스트 프레임워크**: Vitest

테스트 실행:
```bash
npm test                 # Extension 테스트
cd webview && npm test   # Webview 테스트
npm run test:all         # 모든 테스트
```

## 파일 형식

실험 노트는 마크다운 파일(`.md`)로 저장됩니다. 에디터는 표준 마크다운 문법과의 호환성을 유지하면서 시각적 인터페이스를 제공합니다.


```markdown
![이미지 캡션](./assets/1234567890_abc123.png)
```

## 요구 사항

- **VS Code**: ^1.85.0
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0


## 기여

기여를 환영합니다! Pull Request를 자유롭게 제출해 주세요.

## 라이선스

[라이선스 추가 예정]

## 감사의 말

- [BlockNote](https://www.blocknotejs.org/)로 제작
- [Mantine](https://mantine.dev/)의 UI 컴포넌트
- [KaTeX](https://katex.org/)의 수학 렌더링
