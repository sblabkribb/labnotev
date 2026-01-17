# Lab Note Editor

VS Code용 Notion 스타일 블록 에디터로, 실험실 노트 작성을 위해 특별히 설계되었습니다. BlockNote와 React로 구축되어 과학 문서화를 위한 현대적이고 직관적인 편집 경험을 제공합니다.

## 주요 기능

### 📝 리치 블록 에디터
- **Notion 스타일 편집**: 드래그 앤 드롭 재정렬이 가능한 블록 기반 에디터
- **마크다운 지원**: 마크다운과 블록 간 양방향 변환
- **슬래시 명령**: `/` 메뉴로 빠른 블록 삽입

### 🧩 지원하는 블록 타입
- **제목** (H1, H2, H3)
- **문단** 및 인라인 서식 (굵게, 기울임, 코드)
- **목록** (글머리 기호, 번호)
- **코드 블록** 및 구문 강조
- **이미지** 및 로컬 저장소 연동
- **표** (GFM 형식)
- **수학 블록** 및 KaTeX 렌더링

### 🖼️ 이미지 처리
- **클립보드 이미지 붙여넣기** (Ctrl+V)
  - 스크린샷
  - 파일 탐색기의 이미지 파일
  - 임베디드 이미지가 포함된 서식 있는 텍스트
- **자동 저장**: `assets/` 폴더에 저장
- **드래그 앤 드롭** 이미지 업로드

### 🔬 샘플 ID 관리
- **샘플 ID 생성**: `/dna`, `/rna`, `/protein` 등의 슬래시 명령으로 고유 ID 생성
- **샘플 ID 하이라이팅**: 타입별 색상으로 샘플 ID 강조 표시
  - DNA, RNA, Plasmid, Reagent, Primer, Protein, Equip, Labware 지원
- **Sample Info 패널**: 문서 내 모든 샘플 ID 조회

### 📅 날짜 관리
- **날짜 삽입**: 현재 날짜/시간을 한국 시간대(KST) 기준으로 삽입
- **날짜 필드 업데이트**: YAML Front Matter의 날짜 필드 자동 업데이트
- **키보드 단축키**:
  - `Ctrl+Shift+D` / `Cmd+Shift+D`: 날짜/시간 삽입
  - `Ctrl+Shift+U` / `Cmd+Shift+U`: 날짜 필드 업데이트

### 🎨 VS Code 통합
- **테마 지원**: VS Code 라이트/다크 테마에 자동 적응
- **커스텀 에디터**: `.labnote.md` 파일 자동 열기
- **자동 저장**: 부드러운 편집을 위한 500ms 디바운스 저장

## 설치

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

### 새 노트 생성

1. 명령 팔레트 열기 (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. "Lab Note: New Note" 입력
3. 파일 이름 입력 (확장자 제외)
4. 파일이 `filename.labnote.md`로 생성되고 에디터에서 열림

### 기존 파일 열기

VS Code에서 아무 `.labnote.md` 파일을 열면 커스텀 에디터가 자동으로 활성화됩니다.

### 편집

- **`/` 입력**: 슬래시 명령 메뉴 열기
- **블록 드래그**: 블록 재정렬
- **이미지 붙여넣기**: `Ctrl+V` (Mac: `Cmd+V`)
- **텍스트 서식 지정**:
  - `Ctrl+B` / `Cmd+B`: 굵게
  - `Ctrl+I` / `Cmd+I`: 기울임
  - `Ctrl+K` / `Cmd+K`: 링크

### 수학 블록

`/math` 명령을 사용하거나 `$$`를 입력하고 Enter를 눌러 수학 방정식을 삽입합니다. 수학 블록은 LaTeX 문법을 지원하며 KaTeX로 렌더링됩니다.

예시:
```latex
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
```

### 슬래시 명령 목록

| 명령어 | 설명 |
|--------|------|
| `/date` | 현재 날짜 삽입 (YYYY-MM-DD) |
| `/datetime` | 현재 날짜/시간 삽입 (YYYY-MM-DD HH:mm) |
| `/dna` | DNA 샘플 ID 생성 |
| `/rna` | RNA 샘플 ID 생성 |
| `/protein` | Protein 샘플 ID 생성 |
| `/plasmid` | Plasmid 샘플 ID 생성 |
| `/reagent` | Reagent 샘플 ID 생성 |
| `/primer` | Primer 샘플 ID 생성 |
| `/equip` | Equip 샘플 ID 생성 |
| `/labware` | Labware 샘플 ID 생성 |

### VS Code 명령어

| 명령어 | 설명 |
|--------|------|
| `Lab Note: New Note` | 새 실험 노트 생성 |
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
│   ├── labnote-lite/             # 날짜/YAML 처리 모듈
│   │   └── logic.ts
│   ├── labsample/                # 샘플 ID 관리 모듈
│   │   ├── constants/
│   │   │   ├── appConstants.ts
│   │   │   └── decorations.ts
│   │   └── utils/
│   │       └── idGenerator.ts
│   └── views/                    # Webview 패널
│       └── SampleInfoPanel.ts
├── webview/                      # Webview (React 앱)
│   └── src/
│       ├── Editor.tsx            # 메인 에디터 컴포넌트
│       ├── slashCommands.ts      # 커스텀 슬래시 명령
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
4. 새 창에서 `.labnote.md` 파일을 열어 테스트

## 테스트

프로젝트에는 포괄적인 테스트 커버리지가 포함되어 있습니다:

- **Extension 테스트**: 89개 (7개 파일)
- **Webview 테스트**: 76개 (6개 파일)
- **테스트 프레임워크**: Vitest

테스트 실행:
```bash
npm test                 # Extension 테스트
cd webview && npm test   # Webview 테스트
npm run test:all         # 모든 테스트
```

## 파일 형식

실험 노트는 마크다운 파일(`.labnote.md`)로 저장됩니다. 에디터는 표준 마크다운 문법과의 호환성을 유지하면서 시각적 인터페이스를 제공합니다.

### 이미지 저장

이미지는 노트 파일과 같은 디렉토리의 `assets/` 폴더에 자동으로 저장됩니다. 마크다운 파일은 상대 경로를 사용하여 이미지를 참조합니다:

```markdown
![이미지 캡션](./assets/1234567890_abc123.png)
```

## 요구 사항

- **VS Code**: ^1.85.0
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0

## 알려진 문제

- 일부 엣지 케이스에서 이미지 붙여넣기가 중복될 수 있음 (최신 버전에서 수정됨)
- 큰 이미지는 처리에 시간이 걸릴 수 있음

## 기여

기여를 환영합니다! Pull Request를 자유롭게 제출해 주세요.

## 라이선스

[라이선스 추가 예정]

## 감사의 말

- [BlockNote](https://www.blocknotejs.org/)로 제작
- [Mantine](https://mantine.dev/)의 UI 컴포넌트
- [KaTeX](https://katex.org/)의 수학 렌더링
