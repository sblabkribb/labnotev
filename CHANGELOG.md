# 변경 이력

이 파일은 프로젝트의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 기반으로 하며,
이 프로젝트는 [유의적 버전 관리](https://semver.org/lang/ko/)를 따릅니다.

## [0.8.1] - 2026-01-18

### 변경

#### 워크플로 추가 후 README.md 유지
- 워크플로 추가 후 워크플로 파일을 자동으로 열지 않음
- README.md에서 워크플로 추가 시 README.md에 그대로 머묾
- 사용자가 체크리스트에서 워크플로 링크를 클릭하여 열 수 있음

### 테스트

- Extension 테스트: 194개 (12개 파일)
- Webview 테스트: 104개 (6개 파일)
- 총 298개 테스트 통과

---

## [0.8.0] - 2026-01-18

### 변경

#### 워크플로 파일 확장자 변경
- 워크플로 파일 확장자를 `.md`에서 `.labnote.md`로 변경
- BlockNote 에디터에서 워크플로 파일 자동 열기 지원
- `isValidWorkflowPath()`: `.labnote.md` 파일만 인식
- `getNextWorkflowNumber()`: `.labnote.md` 파일만 카운트
- `createWorkflowFileName()`: `.labnote.md` 확장자로 생성
- `parseWorkflowChecklistFromReadme()`: `.labnote.md` 링크 파싱

#### 명령어 구조 단순화
- `Lab Note: New Note` 명령어 제거 (중복 기능)
- `Lab Note: Create New Labnote Folder` 명령어로 통합
- labnote-lite와 동일한 구조화된 워크플로 지원

### 추가

#### 디버깅 로그
- `createLabnote` 명령어에 상세 디버깅 로그 추가
- 폴더 생성 과정 추적 가능

### 테스트

- Extension 테스트: 194개 (12개 파일)
- Webview 테스트: 104개 (6개 파일)
- 총 298개 테스트 통과

---

## [0.7.3] - 2026-01-18

### 수정

#### BlockNote codeBlock NaN 에러 해결
- YAML front matter 또는 코드 블록이 있는 파일을 열 때 에디터가 빈 화면으로 표시되던 문제 수정
- 원인: BlockNote의 `codeBlock` 타입이 `content` 필드에서 `NaN` 에러 발생
- 해결: YAML과 코드 블록을 **특수 마커가 포함된 paragraph**로 저장
  - YAML: `___YAML_FRONTMATTER___\n{content}\n___END_YAML___`
  - 코드: `___CODE_BLOCK_{language}___\n{content}\n___END_CODE___`
- `blocksToMarkdown()`에서 마커를 인식하여 원래 형식으로 복원
- ErrorBoundary를 활용한 체계적인 런타임 디버깅으로 근본 원인 파악

### 테스트

- Extension 테스트: 171개 (11개 파일)
- Webview 테스트: 104개 (6개 파일)
- 총 275개 테스트 통과

---

## [0.7.2] - 2026-01-17

### 수정

#### YAML Front Matter 렌더링 오류 수정
- BlockNote 에디터에서 YAML front matter가 있을 때 에디터가 렌더링되지 않던 문제 수정
- 원인: `yaml-frontmatter`라는 존재하지 않는 언어 사용으로 인한 에디터 초기화 실패
- 해결: 표준 `yaml` 언어 사용, 첫 번째 yaml 코드 블록을 front matter로 인식
- `blocksToMarkdown()`에 `isFirst` 파라미터 추가하여 위치 기반 판별

### 테스트

- Extension 테스트: 171개 (11개 파일)
- Webview 테스트: 104개 (6개 파일)
- 총 275개 테스트 통과

---

## [0.7.1] - 2026-01-17

### 추가

#### YAML Front Matter 보존 기능
- BlockNote 에디터에서 YAML front matter 파싱 및 복원 지원
- `markdownToBlocks()`에서 YAML front matter를 코드 블록으로 파싱
- `blocksToMarkdown()`에서 YAML front matter를 `---` 마커로 복원
- `Sample Tracking`, `created_date` 등 YAML 메타데이터 보존
- 6개의 단위 테스트 추가

### 테스트

- Extension 테스트: 171개 (11개 파일)
- Webview 테스트: 103개 (6개 파일)
- 총 274개 테스트 통과

---

## [0.7.0] - 2026-01-17

### 추가

#### 날짜 Snippet 지원
- VS Code Snippet contribution 추가
- 마크다운 파일에서 자동완성 지원:
  - `date`, `today` → 현재 날짜 (YYYY-MM-DD)
  - `datetime` → 현재 날짜/시간 (YYYY-MM-DD HH:mm)
  - `lastupdated` → `last_updated_date: 'YYYY-MM-DD'`
  - `createddate` → `created_date: 'YYYY-MM-DD'`
  - `enddate` → `end_date: ''`

#### YAML Sample Tracking 설정
- YAML front matter에서 `Sample Tracking: Yes/No` 파싱
- 설정에 따라 샘플 하이라이팅 및 Sample Info 패널 활성화/비활성화
- `parseSampleTracking()` 함수 추가
- 지원 형식: `Sample Tracking`, `sampleTracking`, `sample-tracking`
- 지원 값: Yes/No, true/false, on/off, 1/0 (대소문자 무관)
- 11개의 단위 테스트 추가

#### Global/Local 샘플 관리
- 워크스페이스 루트 `resources/labsamples/` 경로 지원
- `getGlobalLabsamplesFolder()` 함수 추가
- `getSampleLocation()` 함수 추가 (local/global/both/none 판별)
- `moveSampleToGlobal()`, `moveSampleToLocal()` 함수 추가
- 8개의 단위 테스트 추가

#### 워크플로 템플릿 슬래시 명령
- `/workflow` 슬래시 명령 추가 (29개 워크플로)
- DBTL 사이클 기반: Design, Build, Test, Learn 카테고리
- `webview/src/data/workflows.ts` 데이터 파일 추가
- 6개의 단위 테스트 추가

#### 유닛 오퍼레이션 슬래시 명령
- `/operation` 슬래시 명령 추가 (35개 오퍼레이션)
- Hardware, Software 카테고리 지원
- 실험 자동화 장비 및 분석 소프트웨어 템플릿
- `webview/src/data/unitOperations.ts` 데이터 파일 추가
- 6개의 단위 테스트 추가

### 테스트

- Extension 테스트: 171개 (11개 파일)
- Webview 테스트: 97개 (6개 파일)
- 총 268개 테스트 통과

---

## [0.6.0] - 2026-01-17

### 추가

#### 샘플 정보 저장 기능
- 문서 저장 시 샘플 ID 정보를 `resources/labsamples/{TYPE}.json`에 자동 저장
- 샘플 ID 형식 지원: `ID|별칭:설명`, `ID|별칭`, `ID: 설명`, `ID`
- 별칭(Alias), 설명(Description), 출처(Sources) 정보 관리
- 새 샘플 정보가 기존 정보와 자동 병합
- `src/lib/sampleStorage.ts` 모듈 추가
- 11개의 단위 테스트 추가

#### Sample Info 패널 확장
- 별칭, 설명, 출처 표시
- **위치로 이동** 버튼 - 샘플 ID 클릭 시 해당 위치로 커서 이동
- **Rename** 버튼 - 새 ID 입력 후 문서 내 일괄 변경
- **Replace** 버튼 - 기존 ID 목록에서 선택하여 교체
- 확장된 HTML 생성 (`generateSampleInfoHtml`)
- `findSampleLocation` 함수 추가
- 6개의 단위 테스트 추가

#### 실험 노트 폴더 구조 생성
- `Lab Note: Create New Labnote Folder` 명령 추가 (`labnotev.createLabnote`)
- 자동 폴더 구조 생성:
  - `labnote/{번호}_{제목}/`
  - `README.md` (YAML front matter 포함 템플릿)
  - `images/`, `resources/` 폴더
- 자동 번호 부여 (001, 002, ...)
- `src/lib/labnoteStructure.ts` 모듈 추가
- 13개의 단위 테스트 추가

### 테스트

- Extension 테스트: 152개 (11개 파일)
- Webview 테스트: 85개 (6개 파일)
- 총 237개 테스트 통과

---

## [0.5.0] - 2026-01-17

### 변경

- **슬래시 명령 시스템 리팩토링**: BlockNote의 `ReactSlashMenuItem` 인터페이스와 완전히 호환되도록 수정
  - `title` → `name`, `onItemClick` → `execute`, `subtext` → `hint` 속성명 변경
  - BlockNote 기본 명령과 커스텀 명령이 동일하게 작동

### 리팩토링

- **공유 라이브러리 구조 개선**: `src/lib/` 폴더로 공용 모듈 통합
  - `dateUtils.ts`: 날짜/시간 처리 함수 (Extension + Webview 공유)
  - `sampleUtils.ts`: 샘플 ID 생성 및 상수 (Extension + Webview 공유)
  - `sampleDecorations.ts`: VS Code 전용 텍스트 데코레이션
- **기존 폴더 삭제**: `src/labnote-lite/`, `src/labsample/` 폴더 제거
- **Vite 설정 개선**: `@lib` alias 추가로 경로 간소화
- **테스트 구조 정리**: `src/__tests__/lib/` 폴더에 새 라이브러리 테스트 추가

### 테스트

- Extension 테스트: 122개 (9개 파일)
- Webview 테스트: 85개 (6개 파일)
- 총 207개 테스트 통과

---

## [0.4.1] - 2026-01-17

### 수정

- **이미지 붙여넣기 중복 버그 수정**: `Ctrl+V`로 이미지 붙여넣기 시 이미지가 2개 삽입되던 문제 해결
  - 원인: `clipboardData.files`와 `clipboardData.items`가 같은 이미지에 대해 다른 File 객체를 반환
  - 해결: `files`에 이미지가 있으면 그것만 사용하고 `items`는 건너뜀

- **슬래시 명령 메뉴 필터링 오류 수정**: `/` 입력 시 "no item found" 메시지만 표시되던 문제 해결
  - 원인: BlockNote 기본 아이템이 `name` 대신 `title` 속성 사용
  - 해결: 필터링 시 `name` 또는 `title` 속성 모두 처리

- **슬래시 명령 블록 삽입 오류 수정**: 커스텀 슬래시 명령(`/dna`, `/date` 등) 선택 시 블록이 삽입되지 않던 문제 해결
  - 원인: BlockNote의 `insertBlocks`가 `props`와 `styles` 필드가 없으면 `Object.entries(undefined)` 에러 발생
  - 해결: 블록 객체에 `props: {}`와 `styles: {}` 추가

### 문서화

- 드래그 앤 드롭 제한 사항 README에 추가 (VS Code webview 보안 정책 제한)

---

## [0.4.0] - 2026-01-17

### 추가

#### labnote-lite 모듈 통합
- 날짜 처리 및 YAML Front Matter 파싱 기능 통합
  - `getSeoulDateString()`, `getSeoulDateTimeString()` - 한국 시간대 기준 날짜 포맷팅
  - `updateDateFieldInLine()`, `updateAllDatesInLine()`, `updateAllDateFields()` - 날짜 필드 업데이트
  - `findDateFieldsInDocument()` - 문서 내 날짜 필드 검색
  - `parseWorkflowFrontMatter()`, `parseReadmeFrontMatter()` - YAML 파싱
- js-yaml 의존성 추가
- 34개의 단위 테스트 추가

#### VS Code 명령어
- `labnotev.insertDate` - 현재 날짜 삽입 (YYYY-MM-DD)
- `labnotev.insertDateTime` - 현재 날짜 및 시간 삽입 (YYYY-MM-DD HH:mm)
- `labnotev.updateDateField` - 현재 줄의 날짜 필드 업데이트
- `labnotev.updateAllDateFields` - 모든 last_updated_date 필드 업데이트
- 키보드 단축키:
  - `Ctrl+Shift+D` / `Cmd+Shift+D` - 날짜/시간 삽입
  - `Ctrl+Shift+U` / `Cmd+Shift+U` - 날짜 필드 업데이트
- 11개의 단위 테스트 추가

#### labsample 모듈 통합
- 샘플 ID 관리 기능 통합
  - `generateUniqueSampleId()` - 타임스탬프 기반 고유 ID 생성
  - `SAMPLE_TYPES` 상수 - DNA, RNA, Plasmid, Reagent, Primer, Protein, Equip, Labware 지원
  - 명령어, 경로, 메시지용 애플리케이션 상수
- 8개의 단위 테스트 추가

#### 샘플 ID 하이라이팅
- 마크다운 파일 내 샘플 ID 색상 강조 표시
  - DNA, RNA, Plasmid, Reagent, Primer, Protein, Equip, Labware 타입별 고유 색상
  - 타이핑 시 실시간 하이라이팅 업데이트
- 8개의 단위 테스트 추가

#### BlockNote 에디터 Slash Commands
- `/date` - 현재 날짜 삽입 (YYYY-MM-DD)
- `/datetime` - 현재 날짜 및 시간 삽입 (YYYY-MM-DD HH:mm)
- `/dna`, `/rna`, `/protein` 등 - 고유 샘플 ID 생성
- 9개의 단위 테스트 추가

#### Sample Info 패널
- 현재 문서의 모든 샘플 ID 조회
- 샘플 타입별 색상 배지
- `labnotev.showSampleInfo` 명령어
- 10개의 단위 테스트 추가

---

## [0.1.0] - 2026-01-16

### 추가

- Lab Note Editor VS Code Extension 최초 릴리스
- BlockNote 기반 Notion 스타일 블록 에디터
- `.labnote.md` 파일용 커스텀 에디터 프로바이더
- 마크다운 파일 양방향 변환 지원
- 지원하는 블록 타입:
  - 제목 (H1, H2, H3)
  - 문단 및 인라인 서식 (굵게, 기울임, 코드)
  - 글머리 기호 및 번호 목록
  - 구문 강조가 있는 코드 블록
  - 로컬 저장소 이미지
  - 표 (GFM 형식)
  - KaTeX 렌더링 수학 블록
- 빠른 블록 삽입을 위한 슬래시 명령 메뉴
- Ctrl+V 붙여넣기 처리:
  - 일반 텍스트
  - 서식 있는 텍스트 (HTML)
  - 클립보드 이미지 (스크린샷)
  - 파일 탐색기의 이미지 파일
- `assets/` 폴더에 이미지 자동 저장
- VS Code 테마 통합 (라이트/다크 모드)
- 드래그 앤 드롭 블록 재정렬
- 7개 테스트 파일에 85개 테스트 포함
