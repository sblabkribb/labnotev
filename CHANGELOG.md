# 변경 이력

이 파일은 프로젝트의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 기반으로 하며,
이 프로젝트는 [유의적 버전 관리](https://semver.org/lang/ko/)를 따릅니다.

## [0.36.0] - 2026-03-29

### 수정
- 테이블 정렬 키보드 단축키(`Ctrl+Shift+F`) 제거 -- VS Code 내장 "Search: Find in Files" 단축키와 충돌
  - 정렬 기능은 기존 정렬 버튼(AlignIcon)으로 사용

## [0.35.0] - 2026-03-29

### 수정
- 시간 입력 시 4자리 숫자(예: 1111)가 올바른 HH:MM(11:11)으로 변환되지 않던 버그 수정
  - `handleTimeChange`의 auto-commit 후 동기적 blur가 stale 클로저 값으로 결과를 덮어쓰는 문제 해결 (`autoCommittedRef` 플래그 도입)

## [0.34.1] - 2026-03-29

### 수정
- Section Editor 전환 버튼(플라스크 아이콘)이 VS Code 다크 모드에서 보이지 않던 문제 수정
  - light/dark 테마별 SVG 파일 분리 (`flask-light.svg` #424242, `flask-dark.svg` #C5C5C5)

## [0.34.0] - 2026-03-29

### 추가

#### 에디터 3-way 전환 버튼
- Section Editor 모드에서 에디터 타이틀 바에 "Markdown 편집기로 열기"(`$(go-to-file)`) 및 "미리보기 열기"(`$(open-preview)`) 전환 버튼 추가
- Text Editor / Preview 모드에서는 Section Editor 전환 버튼(플라스크 아이콘) 표시
- 각 모드에서 나머지 두 모드로 한 번의 클릭으로 전환 가능

### 수정
- Preview 모드에서 Section Editor 전환 버튼이 작동하지 않던 문제 수정 (3단계 URI fallback 적용: activeTextEditor → sectionEditorProvider → lastLabnoteUri)
- Section Editor 전환 버튼 아이콘을 플라스크 아이콘(`resources/icons/flask.svg`)으로 교체
- 이미지 붙여넣기 시 커서 위치에 불필요한 줄바꿈이 삽입되던 문제 수정 (`\n![](...)` → `![](...)`)

## [0.33.0] - 2026-03-29

### 추가

#### 샘플 하이라이팅 및 정의 네비게이션
- UnitOp textarea에 샘플 ID 하이라이팅 오버레이 추가 (SectionEditor와 동일한 기법)
  - 샘플이 포함된 textarea에서 타입별 색상으로 강조 표시
  - 하이라이팅된 샘플 ID 클릭 시 동일 문서 내 정의 위치로 스크롤/포커스
- Section Editor 내 정의 네비게이션: 샘플 클릭 시 텍스트 에디터를 열지 않고 웹뷰 내부에서 해당 textarea로 이동
  - Extension 측에서 `findSampleDefinitionMatch()`로 정의 위치를 찾고 섹션 매핑 후 웹뷰에 `scrollToSample` 메시지 전송
  - 같은 문서에서 발견되지 않으면 기존 `moveToDefinition` 커맨드로 다른 파일에서 검색
- `moveToDefinition` 커맨드가 `SampleTreeItem` 객체뿐 아니라 `(string, string)` 두 인자 호출도 지원

#### 에디터 타이틀 바 Section Editor 전환 버튼
- `.labnote.md` 파일을 텍스트 에디터로 열었을 때 에디터 타이틀 바 오른쪽 상단에 Section Editor 전환 아이콘 버튼 표시
- 버튼 클릭 시 `vscode.openWith`로 Section Editor로 전환

### 수정
- `SortableUnitOp` 컴포넌트에 `getCursorForSection` prop이 전달되지 않아 워크플로 파일 렌더링 시 발생하던 오류 수정

## [0.32.0] - 2026-03-28

### 추가

#### 다크 모드 지원
- 에디터 오른쪽 상단에 다크/라이트 모드 토글 버튼(달/해 아이콘) 추가
- Mantine `forceColorScheme`으로 모든 UI 컴포넌트(Paper, Badge, Alert, Modal, Select 등)에 일괄 적용
- raw textarea의 배경·글자색을 Mantine CSS 변수(`--mantine-color-body`, `--mantine-color-text`)로 연동
- 사용자 선택이 `localStorage`에 저장되어 새로고침·재열기 후에도 유지
- body 배경색 전환 시 부드러운 transition 적용

## [0.31.0] - 2026-03-28

### 추가

#### 샘플 생성 모달 통합
- 유닛 오퍼레이션의 섹션별 개별 샘플 타입 버튼(`+DNA`, `+RNA` 등)을 단일 `+Sample` 버튼으로 통합
- 웹뷰 모달(`SampleCreateModal`)에서 타입 선택, 별칭, 설명을 한 번에 입력하여 샘플 생성
  - 기본 8종(DNA, RNA, Plasmid, Reagent, Primer, Protein, Equip, Labware) + 커스텀 타입을 드롭다운으로 제공
  - Reagent/Labware 선택 시 "제품 검색" 버튼 표시 (기존 QuickPick 연동)
  - "새 타입 추가" 옵션으로 커스텀 샘플 타입 정의 가능 (워크스페이스 설정 `labnotev.customSampleTypes`에 저장)
- 기존 TreeView 삽입 및 텍스트 에디터 `@` 자동완성은 변경 없음

#### 커스텀 타입 본문 참조 지원
- 커스텀 타입(예: `Oligo-1711234567890`)이 본문에서 하이라이팅, 추출, 저장되도록 지원
  - 웹뷰 `SampleHighlighter`: `availableTypes` prop 기반 동적 정규식 생성으로 커스텀 타입 하이라이팅
  - `sampleStorage.ts`: `extractSampleInfoFromText`에 `additionalTypes` 파라미터 추가, 커스텀 타입 추출/저장
  - `sampleDecorations.ts`: `getDecoration()` 함수로 커스텀 타입 데코레이션 동적 생성 (기본 회색)
  - 에디터 내 커스텀 타입 샘플 ID도 색상 데코레이션으로 표시

### 변경

#### 샘플 모달 UI 개선
- Output 섹션에서 샘플 추가 아이콘 제거 (Output은 샘플 정의가 아닌 결과 기술 영역)
- 모달 설명란을 `TextInput`에서 `Textarea`(autosize, 2~6줄)로 변경하여 여러 줄 입력 가능

### 새 파일
- `webview-section/src/components/SampleCreateModal.tsx` -- 샘플 생성 모달 컴포넌트

## [0.30.0] - 2026-03-28

### 추가

#### UnitOp 섹션 테이블 편집 지원
- 유닛 오퍼레이션의 모든 일반 섹션(Meta 제외)에 SectionEditor와 동일한 마크다운 테이블 기능 추가
  - 테이블 삽입 다이얼로그, Tab/Shift+Tab 셀 이동, TSV 붙여넣기 변환, Ctrl+Shift+F 컬럼 정렬
- `useTableEditing` 커스텀 훅으로 테이블 편집 로직을 추출하여 SectionEditor와 UnitOpAccordion에서 공유
- 각 섹션 제목 옆에 테이블 삽입/정렬 아이콘 버튼 배치
- Mantine `<Textarea>`를 raw `<textarea>` + auto-resize로 교체하여 일관된 편집 경험 제공

### 변경

#### Conclusion / Summary → Conclusions and Discussion 이름 변경
- 워크플로 생성 시 tail 섹션 heading을 `## Conclusions and Discussion`으로 변경
- Section Editor UI 표시 heading도 동일하게 변경 (기존 워크플로 파일은 파서가 heading과 무관하게 처리하므로 호환성 유지)

#### UnitOp 별칭 텍스트 색상 개선
- 유닛 오퍼레이션 별칭(alias) 입력 시 텍스트가 기본 색상(검은색)으로 표시되도록 변경 (기존: 항상 dimmed)

### 새 파일
- `webview-section/src/hooks/useTableEditing.ts` -- 테이블 편집 커스텀 훅

## [0.29.0] - 2026-03-27

### 개선

#### 시간 입력 마스크 방식 전환
- 시간 입력란 클릭 시 기존 값이 초기화되고 숫자를 입력하면 HH:MM 포맷에 맞춰 자동 채워짐
- 숫자 외 문자 입력 차단, 최대 4자리(HH:MM) 제한
- 4자리 입력 완료 시 자동 확정 및 blur
- 유효하지 않은 입력 시 이전 값 복원

#### 이미지 썸네일 제목 표시
- `![제목](path)` 형식에서 사용자가 입력한 alt 텍스트(제목)가 썸네일 아래에 표시
- 제목이 비어있으면 라벨 미표시, 긴 제목은 말줄임 처리

## [0.28.0] - 2026-03-27

### 개선

#### 이미지/샘플 삽입 후 커서 위치 복원
- 이미지 붙여넣기, 샘플/텍스트 삽입 후 커서가 삽입된 텍스트의 끝에 위치하고 textarea에 포커스가 유지되도록 개선
- SectionEditor에 `requestFocusAt` prop 추가, App.tsx에서 `pendingCursor` 상태를 통해 커서 위치를 SectionEditor에 전달

#### 시간 입력 개선
- Mantine TimeInput을 TextInput으로 교체하여 숫자만 입력해도 자동 포맷팅 (예: `1430` → `14:30`, `930` → `09:30`)
- "Now" 버튼(시계 아이콘) 추가: 클릭 시 현재 날짜+시간을 즉시 설정
- onBlur 또는 Enter 키로 입력 확정 시 자동 포맷팅 적용

## [0.27.0] - 2026-03-27

### 추가

#### Conclusion/Summary 이미지 붙여넣기 지원
- Workflow 모드의 Conclusion / Summary 섹션에서 Ctrl+V 이미지 붙여넣기 지원
- 텍스트/샘플 삽입도 Conclusion / Summary 섹션에서 동작하도록 개선
- `FocusTarget` 타입에 `tailContent` 영역 추가, `imagePasted`/`sampleInserted`/`textInserted` 핸들러에 분기 추가

### 변경

#### SectionEditor textarea 자동 높이 조절
- 모든 SectionEditor의 textarea가 내용에 따라 자동으로 높이 확장 (스크롤바 없음)
- UnitOpAccordion의 Mantine `<Textarea autosize />`와 동일한 사용 경험 제공
- raw textarea에 scrollHeight 기반 auto-resize useEffect 적용

## [0.26.0] - 2026-03-26

### 추가

#### 마크다운 테이블 편집 지원
- **테이블 삽입 다이얼로그**: 섹션 제목 옆 테이블 아이콘 클릭 → 행/열 수 지정 → 마크다운 테이블 템플릿 자동 생성 및 커서 위치에 삽입
- **Tab/Shift+Tab 셀 이동**: 테이블 내에서 Tab 키로 다음 셀, Shift+Tab으로 이전 셀로 이동. 마지막 셀에서 Tab 시 새 행 자동 추가. 테이블 밖에서는 기본 동작 유지
- **스프레드시트 붙여넣기 변환**: Excel, Google Sheets 등에서 복사한 탭 구분(TSV) 데이터를 Ctrl+V로 붙여넣으면 마크다운 테이블로 자동 변환
- **테이블 컬럼 정렬**: Ctrl+Shift+F 또는 툴바 정렬 버튼으로 테이블 컬럼을 최대 너비에 맞춰 자동 정렬 (CJK 문자 너비 고려)
- Escape 키로 textarea 포커스 해제 지원 (Tab 키 가로챔에 대한 접근성 보장)

### 새 파일
- `webview-section/src/utils/markdownTable.ts` - 테이블 유틸리티 함수 (생성, 변환, 정렬, 셀 탐색)
- `webview-section/src/components/TableInsertModal.tsx` - 테이블 삽입 다이얼로그 컴포넌트
- `webview-section/src/__tests__/markdownTable.test.ts` - 유틸리티 함수 28개 테스트

## [0.25.0] - 2026-02-02

### 변경

#### 날짜/시간 입력 UI 분리
- DateTimePicker를 DatePickerInput(날짜 달력) + TimeInput(시간 선택) 조합으로 분리
- 날짜는 달력 클릭으로 빠르게 선택, 시간은 별도 입력란으로 선택적 입력
- 시간을 입력하지 않으면 날짜만 저장 (YYYY-MM-DD), 시간 입력 시 YYYY-MM-DD HH:mm 형식
- Front Matter (Created Date, Last Updated, End Date)와 Unit Operation Meta (Start Date, End Date) 모두 적용
- 공통 DateTimeField 컴포넌트로 통합 관리

## [0.24.0] - 2026-02-02

### 수정

#### 샘플/이미지 삽입 시 커서 위치 지원
- Section Editor에서 샘플 정의, 텍스트 삽입, 이미지 붙여넣기 시 항상 텍스트 끝에 추가되던 문제 수정
- textarea 내 커서 위치를 실시간 추적하여 해당 위치에 삽입되도록 개선
- SectionEditor, UnitOpAccordion 모두 커서 위치 추적 지원

#### addUnitOperation 명령어 Section Editor 호환
- 커맨드 팔레트의 `Labnote: Add Unit Operation` 명령이 Section Editor에서 동작하지 않던 문제 수정
- Section Editor(워크플로 모드)가 활성화된 경우 `buildUnitOperationBlock` → `appendUnitOpToDocument` 경로로 삽입

### 변경

#### 경고 메시지 파일명 수정
- 워크플로 생성 시 안내 메시지의 `README.md`를 `README.labnote.md`로 수정 (2곳)

#### GitHub Actions Node.js 24 지원
- actions/checkout v4 → v5, actions/setup-node v4 → v5, softprops/action-gh-release v1 → v2
- node-version 20 → 22, webview 경로를 webview-section으로 수정

## [0.23.1] - 2026-02-02

### 변경

#### README 문서 업데이트
- v0.21.0 이후 도입된 Section Editor(웹뷰) 기반 편집 경험을 반영하여 README.md 전면 재작성
- Quick Start를 `.labnote.md` 파일과 Section Editor UI 기준으로 재작성
- Section Editor 주요 기능 섹션 신설 (자동 저장, 이미지 붙여넣기/썸네일, 샘플 정의 버튼, Meta 폼, DateTimePicker 등)
- 샘플 ID 관리를 Section Editor vs 텍스트 에디터로 구분하여 재구성
- Workflow TreeView에 General 카테고리 및 Blank Workflow 반영
- 폴더 구조, 파일 저장 형식을 `.labnote.md` 기반으로 업데이트
- Section Editor가 열리지 않을 때 수동 설정 방법(Open With, settings.json) 추가

## [0.23.0] - 2026-02-02

### 추가

#### General 카테고리 및 Blank Workflow 템플릿
- DBTL(Design/Build/Test/Learn)에 속하지 않는 범용 워크플로를 위한 "General" 카테고리 추가
- `WG010 Blank Workflow` 템플릿 추가 (트리뷰 및 커맨드 팔레트에서 선택 가능)
- ID 접두어 `WG` 자동 생성 지원

### 수정

#### 이미지 붙여넣기 버그 수정
- Ctrl+V 이미지 붙여넣기가 동작하지 않던 버그 수정 (`DataTransferItemList` 비동기 접근 문제)

#### 샘플 생성 취소 버그 수정
- 새 샘플 생성 시 별칭/설명 InputBox에서 Esc를 눌러도 취소되지 않던 버그 수정

### 변경

#### 워크플로 안내 문구 개선
- Related Workflows 빈 상태 안내 문구에 트리뷰 메뉴 사용법 추가

## [0.22.0] - 2026-02-02

### 추가

#### 이미지 붙여넣기 및 썸네일 표시
- 모든 섹션(Lab Note, Workflow)에서 Ctrl+V로 클립보드 이미지를 붙여넣기 가능
- 이미지가 자동으로 `images/` 폴더에 저장되고 마크다운 이미지 링크(`![](images/img_xxx.png)`)가 삽입됨
- Textarea 아래에 이미지 썸네일 자동 표시 (기존 마크다운 이미지 링크도 표시)
- 썸네일 클릭 시 모달로 확대 보기

#### 워크플로 뒤로가기 링크
- Workflow 파일 열람 시 상단에 "Back to Lab Note" 링크 표시
- 클릭 시 같은 디렉토리의 `README.labnote.md`로 이동

#### Lab Note 템플릿에 Summary and Discussion 섹션 추가
- 새로 생성되는 Lab Note에 `## Summary and Discussion` 섹션이 자동 포함

### 변경

#### Section Editor UX 개선
- 샘플 정의 텍스트에 `- ` 접두어 자동 추가 (리스트 형식)
- Front Matter의 Created Date, Last Updated 필드를 DateTimePicker로 변경 (기존 readonly → 편집 가능)
- 유닛 오퍼레이션 별칭을 아코디언 헤더에 인라인 배치 (placeholder: "Add a short description here")
- Lab Note 모드에서 Linked Workflow Unit Operations 인라인 표시 제거, 워크플로 제목 클릭으로 파일 열기
- Meta 섹션을 구조화된 폼으로 변환 (Experimenter: TextInput, Start/End Date: DateTimePicker)

### 제거

#### Sample Tracking UI 숨김
- Front Matter에서 `sample_tracking` 필드를 Section Editor UI에서 제거 (파서/시리얼라이저에서는 유지하여 기존 파일 호환성 보장)

## [0.21.4] - 2026-02-02

### 추가

#### 섹션별 샘플 정의 버튼
- 유닛 오퍼레이션의 각 섹션 제목 옆에 샘플 타입별 빠른 정의 버튼 추가
  - Input: `+DNA`, `+RNA`, `+Plasmid`, `+Protein`, `+Primer`
  - Reagent: `+Reagent`
  - Consumables: `+Labware`
  - Equipment: `+Equip`
  - Output: `+DNA`, `+RNA`, `+Plasmid`, `+Protein`
- 버튼 클릭 시 VS Code InputBox로 별칭/설명 입력 → 샘플 DB 저장 + TreeView 갱신 → `@type:ID|별칭:설명` 정의 텍스트를 해당 textarea에 자동 삽입

### 변경

#### 샘플 생성 로직 리팩토링
- `sampleCommands.ts`에서 `createSampleWithPrompt()` 헬퍼 함수 추출 (ID 생성 → alias/description 입력 → DB 저장)
- TreeView의 "Add Sample" 커맨드와 Section Editor 버튼이 동일 헬퍼 사용

### 제거

#### 웹뷰 전용 `@` 자동완성 제거
- Section Editor 내 `@` 트리거 자동완성 드롭다운(`SampleAutocomplete.tsx`) 삭제 (섹션 버튼으로 대체)
- `sectionEditorProvider.ts`에서 `requestSamples`, `generateSampleId` 메시지 핸들러 제거
- **기존 마크다운 텍스트 에디터의 `@dna:` 등 VS Code 네이티브 자동완성(`SampleCompletionProvider`)은 변경 없음**

---

## [0.21.3] - 2026-02-02

### 추가

#### 샘플 웹 기능 (Section Editor 내 웹 기술 구현)
- **샘플 하이라이팅**: SectionEditor의 textarea에 overlay 기법을 적용하여 샘플 ID(DNA-123, RNA-456 등)를 타입별 색상으로 실시간 하이라이트
- **샘플 자동완성**: textarea에서 `@` 입력 시 2단계 드롭다운 표시 (타입 선택 → 기존 샘플 목록/새 ID 생성)
  - Extension에서 `requestSamples` 메시지로 실제 샘플 DB 로드 (`loadSamplesByType`, `loadReferenceSamplesByType`)
  - `generateSampleId` 명령을 웹뷰에서 직접 호출하여 새 ID 반환
- **샘플 정의 네비게이션**: overlay의 하이라이트된 샘플 ID 클릭 시 정의 위치로 이동 (`moveToDefinition`), 호버 시 Tooltip 표시

### 새 파일
- `webview-section/src/components/SampleAutocomplete.tsx` - 2단계 샘플 자동완성 드롭다운

---

## [0.21.2] - 2026-02-02

### 추가

#### UX 개선
- **날짜-시간 입력**: `@mantine/dates` + `dayjs` 기반 `DateTimePicker` 도입. Workflow의 `end_date` 필드에서 캘린더 + 시간 선택 UI 제공 (`YYYY-MM-DD HH:mm` 형식)
- **Workflow Tail 섹션**: 워크플로 생성 시 `## Conclusion / Summary` 섹션 + 2~3줄 공란 자동 추가. `WorkflowDocument`에 `tailContent` 필드 추가, 파서/시리얼라이저에서 tail 섹션 보존
- **유닛 오퍼레이션 별칭 (Alias)**: `### [HW01 Centrifugation] 단백질 정제 1단계` 형식으로 대괄호 뒤에 별칭 저장. 아코디언 헤더에 표시 + 편집 가능한 TextInput 추가
- **섹션 드래그 정렬**: `@dnd-kit/core`+`@dnd-kit/sortable`로 유닛 오퍼레이션 순서를 드래그&드롭으로 변경 가능. 각 항목에 GripVertical 드래그 핸들 추가

---

## [0.21.1] - 2026-02-02

### 수정

#### 유닛 오퍼레이션 중복 삽입 버그
- TreeView에서 유닛 오퍼레이션 삽입 시 마지막에 2개가 추가되던 문제 수정
- 원인: `appendUnitOpToDocument`에서 `WorkspaceEdit` 적용 후 `onDidChangeTextDocument`가 `documentChanged`를, 직후 `unitOpAdded`가 동일 unitOp를 중복 전송
- `SectionEditorProvider`에 `_suppressDocChange` 플래그 추가하여 내부 편집 시 echo loop 방지

### 추가

#### 자동 저장
- 편집 시 1.5초 debounce 후 자동 저장 (`useDebouncedCallback`)
- 저장 상태 Badge 표시: 저장됨 (green) / 저장 중... (yellow) / 변경사항 있음 (orange)
- 상단에 자동 저장 안내 Alert 배너 추가
- Extension에서 `saveCompleted` 메시지 반환으로 저장 완료 확인

---

## [0.21.0] - 2026-02-02

### 추가

#### Section Editor 아키텍처
- **MD 기반 Section Editor**: `*.labnote.md` 파일의 기본 에디터로 React 19 + Mantine v8 기반 커스텀 에디터 도입
  - Lab Note 모드: Front Matter, Experiment Objective, Related Workflows, Results 섹션 편집
  - Workflow 모드: Front Matter, Workflow Header, Unit Operations 아코디언 편집
- **MD 섹션 파서**: `labnoteSectionParser.ts`(Lab Note), `workflowSectionParser.ts`(Workflow)로 MD 파일을 구조화된 문서 모델로 변환 및 역변환
- **타입 시스템**: `sectionTypes.ts`에 `LabNoteDocument`, `WorkflowDocument`, `UnitOperationBlock` 등 공유 타입 정의

#### .labnote.md 확장자 전환
- 랩노트 README: `README.md` → `README.labnote.md`
- 워크플로: `{name}.md` → `{name}.labnote.md`
- `package.json`에 `customEditors` (`*.labnote.md`, `priority: "default"`) 및 `languages` (`.labnote.md` → `markdown`) 설정
- `labnoteStructure.ts`, `workflowStructure.ts`, `creationCommands.ts`, `workflowCommands.ts` 경로 일괄 변경

#### 명령어 통합
- `sampleCommands`의 `editSample`, `moveToDefinition`이 Section Editor 활성 문서에서 동작하도록 확장
- `workflowCommands`의 `insertUnitOperation`, `createWorkflowFromTree`가 Section Editor 모드에서 `appendUnitOpToDocument`/`mergeWorkflowIntoDocument` 활용
- `labnoteWorkflowContext.ts`로 활성 편집 대상 해석 (`text` / `section` 모드)

### 제거
- **레거시 WYSIWYG 에디터 삭제**: `webview/` 디렉토리 전체 삭제 (BlockNote 기반 에디터, 슬래시 명령, 마크다운 변환기 등)
- `src/labNoteEditorProvider.ts` 및 관련 테스트 삭제

### 새 파일
- `src/sectionEditorProvider.ts` - Section Editor Provider
- `src/lib/labnoteSectionParser.ts` - Lab Note MD 파서
- `src/lib/workflowSectionParser.ts` - Workflow MD 파서
- `src/lib/sectionTypes.ts` - 공유 타입 정의
- `src/lib/labnoteWorkflowContext.ts` - 편집 대상 컨텍스트 해석
- `webview-section/` - 새 React Webview 앱 (Mantine v8)

---

## [0.20.2] - 2026-03-06

### 변경
- MIT `LICENSE` 파일을 추가하고 `package.json`, `README.md`의 라이선스 표기를 정리
- `.vscodeignore`를 보강해 VSIX에서 내부 문서/임시 폴더와 불필요한 패키지 파일을 제외
- `productPicker`의 QuickPick 항목 키 충돌을 수정해 빌드 경고를 제거

---

## [0.20.1] - 2026-03-06

### 변경
- README를 확장 설치 후 확인하는 실제 사용자 도움말 역할에 맞게 재구성
- Quick start, 주요 명령어, 문제 해결, 샘플 정의/참조, Reagent/Labware/Equip의 사용자 DB·참조 DB 설명을 보강
- README 내 명령어 표기를 실제 확장 UI의 `Labnote:` 명령명과 일치하도록 정리

---

## [0.20.0] - 2026-02-03

### 수정
- **Related Workflows 삽입 위치**: 실험 폴더 README.md에서 workflow 입력 시, 워크플로 목록이 설명(blockquote) **아래**에 삽입되도록 수정 (이전에는 설명 위에 삽입됨)

### 변경
- **자동완성 목록 정리**: `@reagent:`, `@labware:` 입력 시 목록에 사용자 DB(Reagent.json/Labware.json)와 "새 Reagent/Labware ID 생성"만 표시 (참조 DB 항목 제거). "새 ID 생성" 선택 시 참조 DB 검색창은 기존과 동일
- **Equip 참조 DB 노출**: `@equip:` 입력 시 사용자 Equip.json + 참조 DB(Equip_*.json) + MongoDB 목록 표시, 선택 시 id|alias:description 형식으로 삽입
- **"새 X ID 생성" 정렬**: "새 DNA ID 생성", "새 Reagent ID 생성" 등 타입별 "새 X ID 생성" 항목을 목록 최상단에 배치 (Enter로 바로 실행 가능)

---

## [0.19.1] - 2026-02-03

### 변경
- README 설치 안내의 최신 버전 표기를 v0.19.1로 업데이트

---

## [0.19.0] - 2026-02-03

### 추가

#### 참조 DB 및 Reagent/Labware 제품 검색
- **참조 DB**: `resources/labsamples/` 내 `{TYPE}_{suffix}.json` 형식 파일 지원 (예: `reagent_buffer.json`, `labware_plate.json`)
  - 사용자가 직접 생성·관리하는 제품 카탈로그 (읽기 전용)
  - 연구노트에 기록되는 샘플은 기존처럼 `Reagent.json`, `Labware.json` 등 고정 파일에만 저장
- **Reagent/Labware 새 ID 생성**: "새 ID 생성" 선택 시 별칭/설명 직접 입력 대신 **제품 DB 검색 QuickPick** 표시
  - 참조 DB(로컬·글로벌 `reagent_*.json`, `labware_*.json`) + Labware의 경우 MongoDB 항목 포함
  - 제품 선택 시 해당 별칭·설명으로 사용자 DB(Reagent.json/Labware.json)에 저장되어 본문·사이드바에서 참조 가능
  - 선택 취소 또는 후보 없음 시 기존처럼 수동 입력
- **자동완성**: `@reagent:`, `@labware:` 시 사용자 DB + 참조 DB + MongoDB(Labware) 통합 검색

### 변경
- `sampleStorage`: `loadReferenceSamplesByType()` 추가
- `SampleCompletionProvider`: Reagent/Labware에 참조 DB 소스 병합
- `utilityCommands.generateSampleId`, `sampleCommands.addSample`: Reagent/Labware 시 제품 선택 QuickPick 분기

---

## [0.18.0] - 2026-02-03

### 수정

#### 샘플 ID 정규식 버그 수정 (Critical)
- `extractSampleInfoFromText`의 ID 패턴에 `(?:-\d+)?`를 추가하여 `DNA-123-1` 형식(동일 밀리초 카운터 접미사)이 정상 추출되도록 수정
- `SampleInfoPanel`의 `extractSampleIdsFromText`에도 동일 패턴 적용
- `findSampleDefinitionMatch`에는 이미 반영되어 있었으나 추출 함수들과 불일치였던 문제 해소

#### SAMPLE_TYPES 테스트 불일치 수정
- `dataLoader.test.ts`: Protein 타입 누락으로 테스트 실패하던 문제 수정 (7 → 8개)
- `SampleCompletionProvider.test.ts`: mock의 SAMPLE_TYPES에 Protein 추가

### 변경

#### BlockNote 커스텀 에디터 제거
- `package.json`에서 `customEditors` 선언, `openInBlocknoteMode` 명령/메뉴 제거
- `extension.ts`, `sampleCommands.ts`, `utilityCommands.ts`에서 `LabNoteEditorProvider` 참조 및 BlockNote fallback 제거
- 샘플 삽입 시 마크다운 에디터가 없으면 경고 메시지 표시로 변경
- `.md` 파일은 항상 VS Code 기본 텍스트 에디터로 열림 (@ 자동완성이 모든 환경에서 동작)

#### .vscodeignore 정리
- `.cursor/**`, `.github/**`, `coverage/**`, `webview/coverage/**`, `**/*.vsix`, `TEST_GUIDE.md`, `vitest.config.ts` 등 추가
- VSIX 크기 약 600KB 절감

#### 기타 개선
- `SampleCompletionProvider`의 `filterText` 공백 제거로 필터링 일관성 개선
- `loadSamplesByType`에서 JSON 파싱 실패 시 `console.warn` 로깅 추가
- README.md 설치 안내의 버전 참조를 현재 버전으로 업데이트

---

## [0.17.1] - 2026-02-05

### 수정

#### SAMPLE_TYPES 불일치 해결 (Critical)
- `dataLoader.ts`에 누락되었던 'Protein' 타입 추가
- `sampleUtils.ts`와 `dataLoader.ts` 간 SAMPLE_TYPES 정의 동기화
- `@protein:` 자동완성이 정상 작동하도록 수정

#### Path Traversal 보안 취약점 해결 (Critical)
- `labNoteEditorProvider.ts`의 `saveImage` 메서드에 파일명 검증 추가
- `labNoteEditorProvider.ts`의 `getAssetUri` 메서드에 경로 검증 추가
- `../` 시퀀스를 통한 디렉토리 탈출 공격 방지

---

## [0.17.0] - 2026-02-02

### 변경

#### 유닛 오퍼레이션 템플릿: HW / SW 구분
- **하드웨어(HW)**: 기존 템플릿 유지 (Input, Reagent, Consumables, Equipment, Method, Output, Results & Discussions)
- **소프트웨어(SW)**: 실행·산출·설정·QC·환경·논의를 반영한 별도 템플릿 적용
  - Input (이전 단계 산출물, 데이터, 모델)
  - Output (다음 단계 산출물: 파일, 데이터셋, 모델)
  - Parameters (옵션, 하이퍼파라미터, seed)
  - QC Metrics (성능 지표, QC 지표)
  - Method (소프트웨어/모델 + 자연어 설명)
  - Environment (conda / poetry / container / OS / HW)
  - Discussion (다음 단계에 대한 코멘트)
- 트리에서 Insert 시와 QuickPick "Add Unit Operation" → Software 선택 시 SW 템플릿 사용

---

## [0.16.9] - 2026-02-02

### 추가

#### Sample TreeView – Move to Definition
- **Move to Definition 메뉴**: 사이드바 샘플 목록에서 샘플 항목 우클릭 시 "Move to Definition" 메뉴 추가
- 선택 시 해당 샘플이 정의된 마크다운 본문의 정의 위치로 커서/뷰 이동
- 활성 에디터가 마크다운이면 해당 문서에서 정의 검색; 없으면 샘플 레코드의 sources 파일을 열어 검색 (Local: 문서 폴더 기준, Global: 워크스페이스에서 파일명 검색)

### 변경
- SampleTreeViewProvider에 `getDocumentFolder()`, `getLocalFolder()`, `getGlobalFolder()` 추가 (Move to Definition 등에서 경로 조회용)
- `findSampleDefinitionMatch`의 alias 캡처를 `[^:\n|]+`로 통일하여 공백·특수문자 포함 별칭도 정의 검색 시 매치되도록 수정

---

## [0.16.8] - 2026-02-02

### 수정

#### Local → Global 이동 후 alias 잘림 및 Local 재등록
- **alias 추출 공백 허용**: 별칭 추출 정규식을 `[^\s:\n|]+`에서 `[^:\n|]+`로 변경하여, 공백·특수문자(™ 등)가 포함된 별칭이 잘리지 않고 전체가 추출되도록 수정 (예: `UltraPure™ DNase/RNase-Free Distilled Water`)
- **Move to Global 후 저장 시 Local 재추가 방지**: 문서 저장 시 Global에 이미 있는 (type, id) 샘플은 Local 병합 결과에서 제외하여, Move to Global한 샘플이 저장 시 잘린 별칭으로 Local에 다시 들어가지 않도록 수정
- `saveSamplesFromDocument`에 `globalLabsamplesFolder` 인자 추가; extension에서 workspace root 기준 global 폴더를 계산해 전달

---

## [0.16.7] - 2026-02-02

### 수정

#### @ 기반 샘플 자동완성
- **콜론 입력 시 리스트 표시**: `@dna` 등 입력 후 `:`를 누르면 VS Code가 콜론 삽입 전에 provider를 호출해도, 콜론을 선택적으로 매치하도록 정규식 변경으로 자동완성 리스트가 표시됨
- **콜론 입력 후 입력으로 검색**: `@dna:` 이후 계속 입력하면 해당 텍스트로 리스트가 필터됨 (트리거 문자에 영문·숫자·`-`·`_` 추가)
- 치환 범위를 `match.index` 기준으로 계산해 콜론 유무와 관계없이 일관되게 동작

### 테스트
- `@dna`(콜론 없음) + position (0, 4)에서도 배열 반환하는지 검증하는 테스트 추가

---

## [0.16.6] - 2026-02-02

### 추가

#### 샘플 정의와 사이드바 동기화
- **저장 시 사이드바 갱신**: 마크다운 저장 시 샘플 JSON 갱신 후 사이드바 샘플 트리가 자동으로 갱신되어, 본문에서 수정한 별칭/설명이 곧바로 반영됨
- **Description 수정 반영**: 본문에서 샘플 정의의 Description을 수정하고 저장하면, merge 시 현재 문서의 설명을 앞에 두어 사이드바에 수정된 설명이 표시되도록 변경
- **사이드바 Edit 시 본문 갱신**: 사이드바에서 샘플 우클릭 → Edit으로 별칭/설명을 수정하면, JSON뿐 아니라 현재 열린 마크다운 본문의 해당 샘플 정의 문자열도 새 값으로 치환됨 (Equip 포함 모든 타입 지원)

### 변경
- `mergeSampleDatabases`: descriptions를 현재 문서(newData) 기준으로 앞에 두고 기존 항목을 뒤에 유지하도록 변경
- `findSampleDefinitionMatch` 헬퍼 추가 (sampleStorage): 본문에서 샘플 정의 위치 검색 (일반 타입은 ID, Equip은 alias 기반)

---

## [0.16.5] - 2026-01-28

### 변경
- README: 설치 섹션에 최신 버전 안내 추가
- 패치 버전 업데이트 및 VSIX 패키징

---

## [0.16.4] - 2026-01-28

### 수정

#### @ 접두어 중복 삽입
- "새 ID 생성" 또는 "정보 입력" 선택 시 이미 입력된 `@type:` 접두어가 그대로 두고 삽입되어 `@labware:@labware:{sampleid}` 등으로 중복되던 문제 수정
- `findSamplePrefixRange()` 유틸 추가: 커서 위치에서 `@type:` 접두어 범위 탐지
- `generateSampleId`, `inputSampleInfo` 명령에서 접두어가 있으면 해당 범위를 교체하고, 없으면 삽입하도록 변경

#### @equip: 동작
- Equip 타입에 "정보 입력" 옵션 추가: MongoDB/로컬 ID가 없어도 `@equip:` 입력 시 수동으로 Equip ID·별칭·설명 입력 가능
- "새 ID 생성"은 Equip에서만 제외 (기존과 동일)

#### 샘플 하이라이트
- 하이라이트 정규식을 `TYPE-\d+`에서 `TYPE-\d+(?:-\d+)*`로 확장
- `DNA-1737123456789-1`, `Equip-123-456` 등 다중 구간 ID도 하이라이트되도록 수정

### 테스트
- Extension 테스트: 345개 (20개 파일) — 12개 추가
- `sampleCommandInsertion.test.ts` (접두어 중복 방지), `findSamplePrefixRange` 단위 테스트, Equip "정보 입력" 및 다중 구간 ID 패턴 테스트 포함

---

## [0.16.3] - 2026-01-20

### 변경

#### Sample Tracking 조건 제거
- `Sample Tracking: Yes` 설정 없이도 항상 샘플 정보 저장 및 하이라이팅 활성화
- Sample TreeView 사용으로 YAML front matter 설정 불필요
- `@type:ID|alias:description` 형식 파싱 지원 추가

### 테스트

- Extension 테스트: 333개 (19개 파일) - 5개 추가
- 총 333개 테스트 통과

---

## [0.16.2] - 2026-01-20

### 추가

#### GitHub Actions 자동 배포
- 태그 푸시 시 자동으로 VSIX 패키징 및 GitHub Release 생성
- `.github/workflows/release.yml` 워크플로 파일 추가
- Release Notes에 설치 안내 자동 포함

### 변경

- `package.json`에 repository, homepage, bugs 필드 추가
- README에 GitHub Releases 설치 방법 추가

---

## [0.16.1] - 2026-01-20

### 추가

#### 샘플 Local/Global 이동 기능
- **Move to Global**: Local 샘플을 Global로 이동 (우클릭 → Move to Global)
- **Move to Local**: Global 샘플을 Local로 이동 (우클릭 → Move to Local)
- contextValue에 scope 포함: `sample_local`, `sample_global` 구분으로 메뉴 조건 제어
- 기존 `sampleStorage.ts`의 `moveSampleToGlobal`, `moveSampleToLocal` 함수 재사용

### 테스트

- Extension 테스트: 328개 (19개 파일) - 8개 추가
- 총 328개 테스트 통과

---

## [0.16.0] - 2026-01-20

### 추가

#### Workflow TreeView (Activity Bar)
- **워크플로 트리뷰**: Lab Samples Activity Bar에 "Workflows" 세션 추가
- **3단 계층 구조**:
  - `Workflows [68]`: 루트 노드
  - `Design`, `Build`, `Test`, `Learn`: 카테고리별 분류
  - 개별 워크플로 항목
  - `HW Unit Operations [50]`: 하드웨어 유닛 오퍼레이션
  - `SW Unit Operations [40]`: 소프트웨어 유닛 오퍼레이션
- **워크플로 명령어**:
  - `Create Workflow`: README.md에서 워크플로 파일 생성 (인라인 버튼)
  - `Edit Workflow`: JSON에서 워크플로 수정 (우클릭)
  - `Delete Workflow`: JSON에서 워크플로 삭제 (우클릭)
  - `Add Workflow`: 새 워크플로 추가 (카테고리 우클릭)
- **유닛 오퍼레이션 명령어**:
  - `Insert Unit Operation`: 현재 커서에 템플릿 삽입 (인라인 버튼)
  - `Edit Unit Operation`: JSON에서 수정 (우클릭)
  - `Delete Unit Operation`: JSON에서 삭제 (우클릭)
  - `Add Unit Operation`: 새 유닛 오퍼레이션 추가 (루트 우클릭)
- **검색 기능**: QuickPick으로 워크플로/유닛 오퍼레이션 검색
  - ID, 이름, 설명으로 검색
  - 선택 시 해당 작업 수행 (워크플로: Create, 유닛오퍼레이션: Insert)
- **리소스 자동 복사**: 확장 리소스에서 워크스페이스로 JSON 파일 자동 복사
  - `resources/workflows/workflows_en.json`
  - `resources/workflows/unitoperations_hw_en.json`
  - `resources/workflows/unitoperations_sw_en.json`

### 새 파일
- `src/lib/workflowDataLoader.ts` - JSON 로드/저장/복사 유틸리티
- `src/views/WorkflowTreeViewProvider.ts` - 워크플로 TreeView Provider
- `src/__tests__/workflowDataLoader.test.ts` - 28개 테스트
- `src/__tests__/WorkflowTreeViewProvider.test.ts` - 17개 테스트

### 테스트

- Extension 테스트: 320개 (19개 파일) - 45개 추가
- 총 320개 테스트 통과

---

## [0.15.1] - 2026-01-20

### 수정

- 기존 샘플 참조 시 `@type:` 접두어가 제거되도록 수정
  - 입력: `@dna:` → 기존 샘플 선택 → 결과: `DNA-123|SampleA` (`@dna:` 삭제됨)
- CompletionItem.range를 사용하여 접두어 포함 범위 교체

---

## [0.15.0] - 2026-01-20

### 추가

- **Insert Definition 메뉴**: 트리뷰에서 샘플 우클릭 시 "Insert Definition" 옵션
  - 샘플 정의 형식: `@{type}:ID|별칭:설명`
  - Equip 타입은 ID 없이: `@equip:|별칭:설명`
- `getDefinitionText` 함수: 샘플 정의 텍스트 생성

### 변경

- **샘플 참조 형식 변경**: 기존 샘플 선택 시 설명 제외
  - 변경 전: `ID|별칭:설명`
  - 변경 후: `ID|별칭`
- **새 샘플 생성 형식 변경**: `@type:` 접두어 추가
  - 변경 전: `ID|별칭`
  - 변경 후: `@{type}:ID|별칭:설명`
- **Equip 타입**: 새 ID 생성 옵션 제거 (기존 DB/JSON에서만 사용)
- **Labware 타입**: 일반 샘플과 동일하게 새 ID 생성 가능

---

## [0.14.2] - 2026-01-20

### 변경

- 랩노트 README 템플릿을 labnote-lite 형식으로 변경
  - 영어 기반 간결한 템플릿 사용
  - 🎯 Experiment Objective 섹션
  - 🗂️ Related Workflows 섹션
  - author 필드 항상 포함 (빈 값 허용)
- 불필요한 한국어 섹션 제거 (실험 조건, 실험 방법, 결과, 결론, 참고 자료)

---

## [0.14.1] - 2026-01-20

### 문서 정리

- README에서 BlockNote 관련 설명 제거 (작동 불안정으로 사용 중단)
- 슬래시 명령, 수학 블록 등 BlockNote 전용 기능 설명 제거
- TreeView 삽입 설명을 "BlockNote" 대신 "에디터"로 변경
- `.labnote.md` → `.md` 참조 정리

---

## [0.14.0] - 2026-01-20

### 변경 (Major)

#### 마크다운 텍스트 에디터 기본 전환
- `.labnote.md` → `.md` 확장자 사용 (모든 마크다운 파일에 적용)
- BlockNote 에디터를 **선택적** 에디터로 변경 (`priority: option`)
- 기본 마크다운 텍스트 에디터에서 모든 편집 작업 수행

### 추가

#### @ 기반 샘플 ID 자동완성 (labsample 통합)
- `@dna:`, `@rna:`, `@plasmid:`, `@reagent:`, `@primer:` 등 타입별 자동완성
- `@sample:` 전체 샘플 검색
- `@equip:`, `@labware:` MongoDB 연동 (Equip, Labware 타입)
- 기존 샘플 목록 표시 및 선택
- "새 ID 생성", "정보 입력" 옵션

#### JSON 기반 워크플로/유닛오퍼레이션 카탈로그
- `resources/workflows/workflows_en.json` (68개 워크플로)
- `resources/workflows/unitoperations_hw_en.json` (50개 HW 오퍼레이션)
- `resources/workflows/unitoperations_sw_en.json` (40개 SW 오퍼레이션)
- 마크다운 기반에서 JSON 기반으로 전환

#### 새 명령어
- `labnotev.manageTemplates` - JSON 템플릿 카탈로그 편집
- `labnotev.reorderWorkflows` - 워크플로 번호 재정렬
- `labnotev.reorderLabnotes` - 랩노트 폴더 번호 재정렬
- `labnotev.generateSampleId` - 새 샘플 ID 자동 생성
- `labnotev.inputSampleInfo` - 샘플 정보 직접 입력

#### MongoDB 설정
- `labnotev.mongoUrl` - MongoDB 연결 URL 설정
- `labnotev.mongoDbName` - 데이터베이스 이름 설정
- SBLIMS 데이터베이스 Equip/Labware 연동

### 변경

#### TreeView 샘플 삽입 방식
- BlockNote 웹뷰 대신 텍스트 에디터에 직접 삽입
- 텍스트 에디터가 활성화되어 있으면 해당 에디터에 삽입
- 폴백: BlockNote 웹뷰로 전송

#### 기존 명령어 데이터 소스 변경
- `labnotev.addWorkflow` - `workflows_en.json`에서 68개 워크플로 로드
- `labnotev.addUnitOperation` - `unitoperations_*.json`에서 90개 오퍼레이션 로드

### 새 파일
- `src/lib/dataLoader.ts` - Local/Global JSON + MongoDB 데이터 관리
- `src/providers/SampleCompletionProvider.ts` - @ 기반 자동완성 프로바이더

---

## [0.13.0] - 2026-01-20

### 추가

#### 이미지 미리보기 패널 기능
- **이미지 클릭으로 미리보기 열기**: 마크다운 이미지 링크를 클릭하면 별도 패널에서 이미지 표시
- **닫기 버튼**: 패널에 Close 버튼이 있어 수동으로 닫을 수 있음
- **여러 이미지 동시 보기**: 각 이미지마다 별도 패널이 열림
- **줌 컨트롤**: +, -, Reset 버튼으로 이미지 확대/축소
- **키보드 단축키**: Esc(닫기), +/-(줌), 0(리셋)
- **ImagePreviewPanel 클래스**: Webview 패널 기반 이미지 뷰어
- **ImageLinkProvider**: 마크다운 이미지 링크를 클릭 가능하게 함

### 테스트

- Extension 테스트: 244개 (15개 파일) - 14개 추가
- Webview 테스트: 153개 (7개 파일)
- 총 397개 테스트 통과

---

## [0.12.0] - 2026-01-20

### 추가

#### 에디터 모드 전환 기능
- **BlockNote → 텍스트 모드**: BlockNote 에디터에서 우클릭 → "Edit in Text Mode" 선택
- **텍스트 → BlockNote 모드**: 텍스트 에디터에서 우클릭 → "Edit in BlockNote Mode" 선택
- 커스텀 컨텍스트 메뉴 UI (BlockNote Webview)
- 새 명령어: `labnotev.openInTextMode`, `labnotev.openInBlocknoteMode`

### 테스트

- Extension 테스트: 230개 (14개 파일)
- Webview 테스트: 153개 (7개 파일)
- 총 383개 테스트 통과

---

## [0.11.2] - 2026-01-19

### 변경

#### Sample TreeView를 Activity Bar로 이동
- 기존 탐색기 패널에서 **별도 Activity Bar 아이콘**으로 이동
- 플라스크(Erlenmeyer Flask) 아이콘으로 Lab Samples 표시
- 독립적인 샘플 관리 패널 제공
- `resources/icons/flask.svg` 아이콘 파일 추가

### 테스트

- Extension 테스트: 230개 (14개 파일)
- Webview 테스트: 153개 (7개 파일)
- 총 383개 테스트 통과

---

## [0.11.1] - 2026-01-19

### 추가

#### 샘플 검색 기능
- **Search Sample** 명령어 (`labnotev.searchSample`)
- 트리뷰 제목 바에 검색 아이콘 추가
- QuickPick을 통한 빠른 샘플 검색
  - ID, 별칭, 설명으로 검색 가능
  - Local/Global 구분 표시
  - 선택 시 BlockNote에 `ID|별칭` 삽입

### 테스트

- Extension 테스트: 230개 (14개 파일) - 3개 추가
- Webview 테스트: 153개 (7개 파일)
- 총 383개 테스트 통과

---

## [0.11.0] - 2026-01-19

### 추가

#### Sample TreeView 기능
- VS Code 탐색기 패널에 **Samples** 트리뷰 추가
- Local/Global 샘플 폴더 구분 표시
- 트리 계층 구조:
  - `Samples (Local)` / `Samples (Global)`: 루트 노드
  - `DNA`, `RNA`, `Protein` 등: 샘플 타입 노드
  - `DNA-123 | 별칭`: 개별 샘플 노드 (클릭하여 상세 정보 표시)
- 기본 폴딩 상태:
  - Local/Global, 타입: 언폴딩 (열림)
  - 개별 샘플: 폴딩 (닫힘)

#### 샘플 관리 명령어
- **Insert to Editor**: 샘플 더블클릭 시 BlockNote에 `ID|별칭` 형식으로 삽입
- **Add Sample**: 타입 노드에서 우클릭하여 새 샘플 추가
- **Edit Sample**: 샘플 노드에서 우클릭하여 별칭/설명 수정
- **Delete Sample**: 샘플 노드에서 우클릭하여 삭제 (확인 다이얼로그)
- **Refresh Sample Tree**: 트리 새로고침 명령

#### VS Code 설정
- `labnotev.sampleTracking`: 샘플 트리뷰 표시 여부 (기본값: true)

### 테스트

- Extension 테스트: 227개 (14개 파일) - 22개 추가
- Webview 테스트: 153개 (7개 파일)
- 총 380개 테스트 통과

---

## [0.10.3] - 2026-01-19

### 수정

#### 슬래시 명령 중복 문제 해결
- `/dna` 등 샘플 ID 슬래시 명령에서 "Insert DNA Sample ID"와 "새 DNA ID 생성"이 중복 표시되던 문제 수정
- `getLabNoteSlashMenuItems()`에서 `createSampleIdSlashItems()` 제거
- 샘플 ID는 `createSampleSlashItemsWithExisting()`을 통해 동적으로 로드

#### 샘플 입력 다이얼로그 스타일 개선
- VS Code webview 환경에서 다이얼로그가 반투명하게 표시되던 문제 수정
- Modal에 명시적 배경색 스타일 추가 (VS Code 테마 변수 사용)
- 오버레이 불투명도 0.7로 설정하여 가독성 향상

### 테스트

- Extension 테스트: 205개 (13개 파일)
- Webview 테스트: 153개 (7개 파일) - 3개 추가
- 총 358개 테스트 통과

---

## [0.10.2] - 2026-01-18

### 수정

#### 마크다운 변환 버그 수정
- **Horizontal Rule ("---") 저장 문제 해결**: `---`, `***`, `___` 구분선이 저장되지 않던 문제 수정
- **Quote (인용문) 지원 추가**: `>` 형식의 blockquote 파싱 및 저장
- **Checklist 지원 추가**: `- [ ]`, `- [x]` 형식의 체크리스트 파싱 및 저장
- **중첩 리스트 지원 추가**: BlockNote의 `children` 속성을 재귀적으로 처리하여 중첩 리스트 저장

### 개선

- 디버그 로그 정리: 이전 디버깅에서 추가된 로그 제거

### 테스트

- Extension 테스트: 205개 (13개 파일)
- Webview 테스트: 150개 (7개 파일) - 19개 추가
- 총 355개 테스트 통과

---

## [0.10.1] - 2026-01-18

### 개선

#### 슬래시 명령 검색 기능 강화
- 슬래시 명령 검색 시 **설명(subtext)**도 검색 대상에 포함
- 기존: `title`, `aliases`만 검색
- 변경: `title`, `subtext`, `aliases` 모두 검색
- 예시:
  - `/Design` → "Design of Experiment"가 설명에 포함된 워크플로 표시
  - `/Assembly` → "DNA Oligomer Assembly" 설명의 항목 표시

### 테스트

- Extension 테스트: 205개 (13개 파일)
- Webview 테스트: 131개 (7개 파일)
- 총 336개 테스트 통과

---

## [0.10.0] - 2026-01-18

### 추가

#### 샘플 관리 기능 확장 (labsample 통합)
- 슬래시 명령에서 기존 샘플 목록 표시 및 선택 기능
- 새 샘플 ID 생성 후 별칭/설명 입력 다이얼로그 추가
- Extension-Webview 간 샘플 데이터 통신 구현

#### Extension 메시지 핸들러
- `getSamples` 메시지 핸들러: 타입별 샘플 목록 반환
- `saveSample` 메시지 핸들러: 새 샘플 정보 저장
- `sampleStorage.ts`의 기존 함수 활용

#### Webview API 확장
- `vscode.loadSamples(type)`: 샘플 데이터 로드
- `vscode.saveSample(info)`: 샘플 데이터 저장
- `SampleRecord` 인터페이스 추가

#### 슬래시 명령 확장
- `createSampleSlashItemsWithExisting()`: 기존 샘플 포함 슬래시 아이템 생성
- "새 ID 생성" + 기존 샘플 목록 동적 로드
- 기존 샘플 선택 시 `ID|별칭` 형식으로 삽입

#### SampleInputDialog 컴포넌트
- Mantine Modal 기반 다이얼로그
- 별칭/설명 입력 필드
- 확인/취소/건너뛰기 버튼
- 다이얼로그 상태 관리 및 Editor 통합

### 테스트

- Extension 테스트: 205개 (13개 파일) - 4개 추가
- Webview 테스트: 131개 (7개 파일) - 23개 추가
- 총 336개 테스트 통과

---

## [0.9.0] - 2026-01-18

### 변경

#### BlockNote 0.46.1 업그레이드 (Major)
- BlockNote 0.17.1 → 0.46.1로 업그레이드
- **복사/붙여넣기 문제 해결**: `prosemirror-view`의 `__serializeForClipboard` 함수 관련 이슈 수정
- Ctrl+C/Ctrl+V가 BlockNote 에디터에서 정상 작동

#### 의존성 업데이트
- `@blocknote/core`: 0.17.1 → 0.46.1
- `@blocknote/react`: 0.17.1 → 0.46.1
- `@blocknote/mantine`: 0.17.1 → 0.46.1
- `@mantine/core`: 7.13.0 → 8.3.11
- `@mantine/hooks`: 추가 (8.3.11)
- 내부적으로 `@tiptap/*` 2.x → 3.x 업그레이드

#### API 변경 사항 적용
- `ReactSlashMenuItem` → `DefaultReactSuggestionItem` 인터페이스로 변경
- 슬래시 메뉴 아이템의 `execute()` → `onItemClick()` 메서드로 변경
- `createReactBlockSpec` API 호환성 수정 (MathBlock)
- 테스트 파일들을 새 API에 맞게 업데이트

### 테스트

- Extension 테스트: 201개 (13개 파일)
- Webview 테스트: 108개 (6개 파일)
- 총 309개 테스트 통과

---

## [0.8.3] - 2026-01-18

### 수정

#### 슬래시 메뉴 항목 표시 문제 해결
- BlockNote 슬래시 메뉴에서 커스텀 항목이 빈 칸으로 표시되던 문제 수정
- 원인: BlockNote가 `title` 속성을 사용하는데 `name` 속성을 사용
- 모든 슬래시 아이템의 `name` → `title`, `hint` → `subtext` 변경
- 날짜, 샘플 ID, 워크플로, 유닛 오퍼레이션 메뉴가 정상 표시됨

### 테스트

- Extension 테스트: 201개 (13개 파일)
- Webview 테스트: 107개 (6개 파일)
- 총 308개 테스트 통과

---

## [0.8.2] - 2026-01-18

### 추가

#### 유닛 오퍼레이션 슬래시 명령 템플릿 보강
- `/ophw-xxx`, `/opsw-xxx` 슬래시 명령이 완전한 템플릿 삽입
- labnote-lite와 동일한 8개 섹션 포함:
  - Meta (Experimenter, Start_date, End_date)
  - Input, Reagent, Consumables, Equipment
  - Method, Output, Results & Discussions
- `generateOperationTemplateBlocks()` 함수 추가
- Start_date에 현재 날짜/시간 자동 삽입

### 테스트

- Extension 테스트: 201개 (13개 파일)
- Webview 테스트: 107개 (6개 파일)
- 총 308개 테스트 통과

---

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
