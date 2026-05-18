# 변경 이력

이 파일은 프로젝트의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 기반으로 하며,
이 프로젝트는 [유의적 버전 관리](https://semver.org/lang/ko/)를 따릅니다.

## [0.55.0] - 2026-05-19

### Fixed
- **샘플 트리 ↔ 섹션 에디터 양방향 동기화 단절 해소**: (1) 트리뷰의 `edit/add/delete/moveSampleToGlobal/moveSampleToLocal` 5개 명령이 종료될 때마다 `SectionEditorProvider.broadcastSampleDefsUpdated()`를 호출해 살아있는 모든 webview에 `sampleDefsUpdated` 메시지를 발신, (2) 마크다운 문서 저장 시점(`onDidSaveTextDocument`)에도 동일 broadcast 추가, (3) `resources/labsamples/*.json`을 감시하는 `FileSystemWatcher`가 100ms 디바운스로 트리뷰 refresh + broadcast를 트리거 — 외부 도구·git pull 등으로 JSON이 바뀐 경우에도 webview의 하이라이트와 정의 호버 카드가 즉시 갱신 ([src/sectionEditorProvider.ts](src/sectionEditorProvider.ts), [src/commands/sampleCommands.ts](src/commands/sampleCommands.ts), [src/commands/utilityCommands.ts](src/commands/utilityCommands.ts), [src/extension.ts](src/extension.ts))
- **트리뷰 `editSample`이 다른 파일에 있는 정의도 갱신**: 종전에는 활성 섹션 에디터 / 활성 plain editor 한 곳만 시도하다가 매치 실패 시 무음 폐기되던 문제 수정. 새 `resolveDefinitionDocument` 헬퍼가 (a) 활성 webview 문서 → (b) 활성 plain editor → (c) `SampleRecord.sources[0]` 후보 파일 → (d) 워크스페이스 `**/*.labnote.md` + `**/*.workflow.md` 스캔의 4단계 fallback으로 정의를 찾고, 매치된 문서가 아직 보이지 않으면 `showTextDocument({ preview: false, preserveFocus: false })`로 새 탭에 자동 표시 ([src/commands/sampleCommands.ts](src/commands/sampleCommands.ts), [src/views/SampleTreeViewProvider.ts](src/views/SampleTreeViewProvider.ts))
- **다중 Section Editor webview broadcast**: `SectionEditorProvider`가 기존 `activeEditor`/`_lastActiveEditor` 한 쌍 외에 `_allEditors: Set<ActiveEditor>`를 통해 살아있는 모든 webview를 추적. `broadcastSampleDefsUpdated()`는 각 webview에 자기 문서 URI 기준으로 빌드한 `sampleDefs`를 push 하여 local/global 해상도를 panel별로 정확히 유지 ([src/sectionEditorProvider.ts](src/sectionEditorProvider.ts))

### Performance
- **섹션 에디터 타이핑 시 React 리렌더 범위를 변경된 unit op / section으로 축소**: 핵심 컴포넌트를 `React.memo`로 감싸고 props ref를 안정화하여, 사용자가 한 textarea에 타이핑하는 동안 다른 UnitOp / 다른 section의 textarea가 매 키 입력마다 다시 그려지던 비용을 제거. 구체적으로:
  - `SortableUnitOp`, `UnitOpSectionTextarea`을 `React.memo` 래핑. `UnitOpSectionTextarea` props를 `(opIndex, secIndex, op)` + 평탄 콜백 형태로 재설계하여 부모가 매 render마다 새 inline arrow를 만들지 않도록 함 ([webview-section/src/components/UnitOpAccordion.tsx](webview-section/src/components/UnitOpAccordion.tsx))
  - `HighlightedTextarea`을 `React.memo(forwardRef(...))`로 래핑, `handleSampleMouseDown` / `reportCursor`을 `useCallback`으로 안정화하여 자식 `SampleHighlighter`의 memo가 실제로 발휘되도록 함 ([webview-section/src/components/HighlightedTextarea.tsx](webview-section/src/components/HighlightedTextarea.tsx))
  - `SampleHighlighter`을 `React.memo`로 감싸고 regex 매칭으로 빌드되는 `parts: ReactNode[]` 배열 전체를 `useMemo([text, regex, sampleTypeColors, sampleDefs, interactive, onSampleClick])`로 메모이즈 ([webview-section/src/components/SampleHighlighter.tsx](webview-section/src/components/SampleHighlighter.tsx))
  - `UnitOpAccordion` 내부의 `updateSection`/`updateAlias`/`updateDescription`/`deleteOp`/`handleCollapse`를 `useCallback` + latest-ref 패턴으로 deps 비움으로 안정화, App.tsx의 `handleUnitOpsChange`/`handleUnitOpSectionFocus`/`getCursorForUnitOpSection`/`handleUnitOpAttachFile`/`handleQueryClipboardOnMenuOpen`/`updateCursorPos`/`getCursorForArea` 등 hot-path 콜백도 `useCallback`으로 안정화 ([webview-section/src/components/UnitOpAccordion.tsx](webview-section/src/components/UnitOpAccordion.tsx), [webview-section/src/App.tsx](webview-section/src/App.tsx))

### Added
- **`SampleTreeViewProvider.getSampleSources(scope, type, id)`**: 특정 sample의 `sources`(마크다운 basename 목록)를 외부에 노출. `resolveDefinitionDocument`의 3단계 fallback에서 활성 디렉토리 기준 후보 파일을 결정하는 데 사용 ([src/views/SampleTreeViewProvider.ts](src/views/SampleTreeViewProvider.ts))
- **`createDebouncedLabsamplesHandler(refresh, broadcast, delay)`**: `extension.ts`에 디바운스 헬퍼 export. JSON 와처가 같은 tick에 여러 파일이 바뀌더라도 한 번의 refresh + broadcast로 합쳐 처리. 단위 테스트가 `vi.useFakeTimers`로 직접 검증 가능하도록 분리 ([src/extension.ts](src/extension.ts), [src/__tests__/sampleJsonWatcher.test.ts](src/__tests__/sampleJsonWatcher.test.ts))
- **신규 단위 테스트 4종**: `sectionEditorProvider.broadcast.test.ts` (3건), `sampleCommands.broadcast.test.ts` (5건), `resolveDefinitionDocument.test.ts` (5건), `sampleJsonWatcher.test.ts` (3건) — 총 16건이 신규 통과. 사전 flake 9건(v0.54.10 기준선)은 그대로 유지

## [0.54.10] - 2026-05-16

### Added
- **Section Editor의 각 Unit Operation 패널 끝에 "Collapse" 아이콘 추가**: 펼친 UnitOp의 본문이 길어 마지막 섹션에서 작업을 마쳤을 때 헤더의 chevron까지 위로 다시 스크롤하지 않아도 되도록, panel 우측 하단에 작은 chevron-up `ActionIcon`(aria-label `Collapse unit operation`, Tooltip `Collapse`)을 배치. 클릭 시 controlled 상태의 `openedOpIds`에서 해당 op.id가 제거되어 Accordion이 닫히고, 두 번의 `requestAnimationFrame`으로 Mantine collapse transition이 안정화된 다음 frame에서 해당 UnitOp wrapper로 `scrollIntoView({ block: 'start', behavior: 'smooth' })`를 호출하여 헤더가 viewport 최상단에 부드럽게 도착함 ([webview-section/src/components/UnitOpAccordion.tsx](webview-section/src/components/UnitOpAccordion.tsx))

## [0.54.9] - 2026-05-16

### Changed
- **Section Editor의 +Sample 버튼이 섹션 의미에 맞는 빌트인 타입으로 잠금**: Reagent 섹션은 `Reagent`, Labware and Consumables 섹션은 `Labware`, Equipment 섹션은 `Equip`로 모달의 Sample type Select가 자동 지정·잠금(disabled)되어 사용자가 다른 타입으로 바꾸거나 새 커스텀 타입을 정의할 수 없음. Input/Output 섹션은 종전대로 모든 빌트인·커스텀 타입을 자유 선택 가능. 잠금 매핑은 정규화된 heading 기준이라 기존 노트북의 `#### Consumables` 헤딩도 `Labware`로 동일하게 잠김
- **`SampleCreateModal`에 `lockedType?: boolean` prop 추가**: true일 때 type Select에 `disabled` 적용 + `+ Add new type` 항목을 `selectData` 구성 단계에서 제외하여 잠금 우회 경로를 두 겹으로 차단. 기존 `defaultType` 동작(modal 진입 시 alias 입력으로 포커스 이동)은 그대로 활용 ([webview-section/src/components/SampleCreateModal.tsx](webview-section/src/components/SampleCreateModal.tsx))
- **`getSectionTypeLock(heading)` 헬퍼 추가**: `webview-section/src/utils/unitOpSectionHeading.ts`에 정규화된 섹션 heading → 빌트인 타입 매핑 테이블(`'Reagent'→'Reagent'`, `'Labware and Consumables'→'Labware'`, `'Equipment'→'Equip'`)과 단일 lookup 헬퍼 도입. 자유 선택 섹션은 `undefined` 반환

## [0.54.8] - 2026-05-16

### Changed
- **Sample TreeView 빈 상태 안내 단순화**: 빈 Type 노드를 펼쳤을 때 표시되던 두 안내 ("No samples — right-click → \"Create Sample\"" / "No samples — saving an @type;id definition in a document registers it automatically")를 단일 중립 라벨 `"No samples"`로 통일. 안내 행 자체에서는 그 동작이 발견 불가능했기 때문에 거짓 안내 인상을 주던 문제 제거 ([src/views/SampleTreeViewProvider.ts](src/views/SampleTreeViewProvider.ts))
- **Unit Operation HW 섹션 이름 변경: `Consumables` → `Labware and Consumables`**: 새로 생성되는 HW UnitOp의 4번째 섹션 헤딩이 `#### Labware and Consumables`로 출력되며, placeholder도 plate/filter/tip/tube를 포함하도록 갱신. 기존 `.labnote.md`/`.workflow.md`의 `#### Consumables` 헤딩은 두 정규화 함수(`normalizeUnitOpSectionHeading`/`normalizeWorkflowUnitSectionHeading`)에서 새 이름으로 매핑되어 그대로 두어도 동일 섹션으로 인식 — `+Sample` 버튼 규칙(`SECTIONS_WITH_SAMPLE_BUTTON`)도 두 헤딩 모두에서 동작 ([src/lib/unitOpTemplate.ts](src/lib/unitOpTemplate.ts), [webview-section/src/utils/unitOpSectionHeading.ts](webview-section/src/utils/unitOpSectionHeading.ts), [src/lib/workflowSectionParser.ts](src/lib/workflowSectionParser.ts))

## [0.54.7] - 2026-05-16

### Fixed
- **이슈 #23 후속 — Section Editor 액션 메뉴 클릭 시 UnitOp Accordion 폴더가 접히던 문제**: Copy / Paste below / Delete... `Menu.Item`의 `onClick`이 동기 콜백만 호출하고 React synthetic event를 부모 `Accordion.Control` 버튼까지 전파시키던 회귀 수정. 세 `Menu.Item` 모두 첫 줄에서 `e.stopPropagation()`을 호출하여 Mantine의 `closeOnItemClick`(메뉴 닫힘)은 그대로 두면서 Accordion 토글만 차단

### Added
- **이슈 #23 후속 — 클립보드 상태에 따른 Paste below 동적 비활성화**: `vscode.env.clipboard`에 유효한 `labnotev/unit-operation` envelope가 없을 때는 사용자가 누르기 전부터 비활성으로 표시되도록 웹뷰↔익스텐션 양방향 메시지(`queryClipboardState` / `clipboardStateUpdated`) 도입. 익스텐션이 기존 인라인 검증 로직을 `parseClipboardUnitOp` 헬퍼로 추출하여 `requestPasteUnitOp` 삽입 경로와 새 `queryClipboardState` 검사 경로가 동일한 진실 공급원을 사용. 갱신 트리거는 (1) 웹뷰 `ready` 직후 1회, (2) Mantine `<Menu>` `onChange(opened=true)` 시점, (3) `webviewPanel.onDidChangeViewState`로 패널이 다시 active가 되는 시점 — 폴링 없이 자연 이벤트만 사용. Paste below `Menu.Item`과 빈 워크플로우의 "Paste Unit Operation" 버튼 모두 `clipboardHasUnitOp` 상태에 따라 `disabled` 적용

## [0.54.6] - 2026-05-16

### Added
- **이슈 #23 — Section Editor 워크플로우에서 Unit Operation 단위 Copy / Paste below / Delete**: UnitOp 헤더 우측의 케밥(More) 아이콘을 누르면 펼쳐지는 Mantine `<Menu>`에서 세 액션을 일괄 제공. Copy는 op 데이터를 `{ kind: 'labnotev/unit-operation', version: 1, data: {...} }` JSON envelope로 직렬화해 `vscode.env.clipboard.writeText`로 시스템 클립보드에 기록하므로 다른 워크플로우 파일을 열어도 Paste below가 동작(cross-workflow). Paste below는 익스텐션이 클립보드 envelope를 검증한 뒤 `unitOpPasted` 메시지로 op을 회신해 호출 위치 바로 아래(`afterOpIndex + 1`)에 새 React 키(`unitop-paste-<ts>-<rand>`)를 부여해 삽입하고 해당 op을 자동으로 펼침. 빈 워크플로우에서는 안내 영역에 "Paste Unit Operation" 버튼이 표시되어 `afterOpIndex = -1`로 맨 앞 삽입. Delete...는 확인 Mantine `<Modal>`을 거쳐 실제 배열에서 제거하며, 같은 변경 경로에서 `openedOpIds`와 `activeSectionRef`의 stale 참조를 정리(삭제된 op은 제거, 인덱스가 밀린 op은 새 위치로 재정렬)
- **새 메시지 타입**: webview→extension `copyUnitOp` / `requestPasteUnitOp`, extension→webview `unitOpPasted` ([webview-section/src/types.ts](webview-section/src/types.ts), [src/sectionEditorProvider.ts](src/sectionEditorProvider.ts))
- **클립보드 envelope 검증 실패 시 안내 토스트**: `kind`/`version`/`opId`/`opName`/`opType`/`sections` 중 어느 하나라도 어긋나면 익스텐션이 "Clipboard does not contain a Unit Operation." 정보 메시지를 띄우고 webview 상태는 그대로 유지(silent noop)

### Changed
- **Section Editor 비-텍스트 영역의 기본 우클릭 메뉴 억제**: VS Code webview 기본 contextmenu(cut/copy/paste)가 텍스트 영역 밖에서는 동작하지 않아 혼란을 주던 문제 해소. `document` 레벨 `contextmenu` 핸들러가 `textarea`/`input`/`contentEditable` 외 영역에서만 `preventDefault`를 호출하므로, 텍스트 편집 위치의 네이티브 cut/copy/paste는 그대로 보존됨



### Fixed
- **이슈 #21 — Section Editor 텍스트에리어에서 내용이 길어진 뒤 키 입력마다 화면이 위로 점프**: `HighlightedTextarea`의 autosize 로직이 매 키 입력마다 `style.height = 'auto'`로 textarea를 일시적으로 `min-height`까지 축소시키면서, 큰 폭(예: 50줄 ≈ 800px → 97px)의 레이아웃 변화가 outer 스크롤러를 위로 끌어올리는 부수효과를 발생시키던 문제 수정. 새 `resizeToContent(ta)` 헬퍼가 `style.height` 변경 직전 `document.scrollingElement`(또는 `documentElement`)의 `scrollTop`을 저장하고, 변경 직후 동기적으로 복원하여 페이지 스크롤 점프를 차단. `value` 변경 useEffect와 `ResizeObserver` 콜백 모두 동일 헬퍼로 일원화

## [0.54.4] - 2026-05-15

### Fixed
- **Workflow Title↔Header 양방향 동기화 결손**: Front Matter의 Title을 수정해도 Workflow Header(`## [idName] desc`)가 따라가지 않던 회귀 수정. `updateWorkflowFm`에 `key === 'title'` 분기를 추가하여 Title을 첫 번째 ` - ` 기준으로 분리 → `[idName] desc` 형식으로 `workflowHeader`를 함께 재구성. 기존 Header→Title 방향의 정확한 역연산이라 양방향 일관성 확보. `WD010 Sample Preparation`처럼 ` - ` 구분자가 없는 단순 형식도 정상 처리

### Changed
- **Workflow 설명 및 Unit Operation 설명 인풋 시각적 줄바꿈 지원**: v0.54.3에서 추가한 두 description 인풋이 단일 라인 `<TextInput>`이라 긴 내용이 가로로 잘리던 문제를 Mantine `<Textarea autosize minRows={1}>`로 교체하여 내용 길이에 따라 위/아래로 늘어나도록 개선. Enter 키는 `onKeyDown` + `preventDefault`로 차단(한국어 IME 조합 중 Enter는 `e.nativeEvent.isComposing`으로 가드)하여 마크다운 단일 라인 blockquote(`> ...`) 출력 포맷은 무변경 유지

## [0.54.3] - 2026-05-15

### Fixed
- **이슈 #24 — Editor 모드에서 Unit Operation 설명(`> blockquote`) 직접 편집 불가**: `UnitOpAccordion`에서 `opDescription`이 읽기 전용 `<Text>`로만 렌더링되어 Editor 모드 사용자가 Text 모드로 전환해야만 설명을 수정할 수 있던 문제 수정. 인라인 편집 가능한 `<TextInput variant="unstyled">`로 교체하여 Editor 모드에서도 클릭 후 바로 편집 가능하도록 개선
- **Workflow 헤더 설명(`> blockquote`)도 Editor 모드 편집 불가**: 동일 패턴으로 `App.tsx`의 `workflow.workflowDescription` 표시가 읽기 전용 `<Text>`였던 문제를 함께 수정하여 Editor 모드 편집 패리티 회복

### Changed
- **Unit Operation alias 인풋 placeholder 문구 명확화**: 신규 description 인풋과의 의미 충돌을 피하기 위해 alias 인풋의 placeholder를 `"Add a short description here"` → `"Add a short alias"`로 변경. alias는 헤딩 라인(`### [HW001 Name] alias-text`), description은 다음 줄 blockquote(`> ...`)로 직렬화되는 별도 필드라는 점이 시각적으로도 구분됨

## [0.54.2] - 2026-05-15

### Changed
- **샘플 트리뷰 "Insert to Editor" 차단 안내 문구 보강** (이슈 #22 Q3): 텍스트 마크다운 에디터에서 이 액션을 눌렀을 때 표시되는 안내가 단순 차단 메시지에서 "Section Editor에서만 동작하며, 텍스트 모드에서는 Lab Samples 뷰의 돋보기 아이콘(`Labnote: Search Sample`)을 사용하라"는 대안 안내로 교체됨. 사용자가 텍스트 모드 삽입 경로를 발견하지 못해 "기능이 사라졌다"고 오해하던 문제 해소
- **README/README.ko 보강**: 샘플 트리뷰 절에 `Labnote: Search Sample`이 텍스트 모드와 Section Editor 모두에서 커서 위치 삽입을 지원한다는 점과, "Search product" 버튼의 후보 출처(`resources/labsamples/{type}_*.json` + Labware의 경우 MongoDB) 및 `labnotev.enableMongo` 설정 안내 추가

### Fixed
- **"Search product" 버튼이 후보 0개일 때 무반응처럼 보이던 문제** (이슈 #22 Q2): `productPicker.ts`가 후보 0개에서 `null`을 silent 반환하면서 SampleCreateModal 사용자가 버튼 동작 여부를 알 수 없던 문제를 수정. 이제 타입별로 "검색할 {타입} 제품이 없습니다 — `resources/labsamples/{타입}_*.json`을 추가하세요(Labware는 추가로 `labnotev.enableMongo`를 켜세요)" 안내 토스트가 표시됨

## [0.54.1] - 2026-05-15

### Changed
- **샘플 트리뷰 컨텍스트 메뉴 정리**: 우클릭 메뉴에서 "Insert Definition"과 "Delete Sample" 항목 제거. 명령 자체는 보존되어 명령 팔레트에서 여전히 호출 가능(트리뷰 컨텍스트 없이는 NoOp)
- **"Insert to Editor"가 Section Editor 전용으로 동작**: 활성 텍스트 에디터가 markdown인 경우 작동하지 않고 "Section Editor로 열어주세요" 안내를 표시. 마크다운 텍스트 에디터에 직접 삽입하던 fallback 제거
- **"Move to Definition"이 Section Editor 웹뷰 내부에서 스크롤**: 일반 텍스트 에디터를 새로 열지 않고 활성 Section Editor의 웹뷰에 `scrollToSample` 메시지를 보내 정의 위치(`@type;ID...`)로 이동. 다른 파일을 자동으로 열어주던 cross-file 검색 fallback 제거

### Fixed
- **"Move to Definition"이 본문 단순 참조로 잘못 점프하던 문제**: 단순 ID 참조(예: `DNA-123`)도 매칭하던 기존 정규식 대신 `@type;ID...` 정의 형식만 매칭하는 `findSampleDefinitionOnlyMatch`를 도입해 진짜 정의 위치로만 이동하도록 수정
- **웹뷰에서 샘플 클릭 시 마크다운 에디터가 새로 열리던 문제**: `navigateToSample` 처리에서 현재 문서에 정의가 없을 때 외부 파일 검색으로 fallback하던 코드를 제거하고 "Definition not found in current document." 안내로 대체

## [0.54.0] - 2026-05-15

> **설치 ID 변경 안내**: 이번 버전부터 `package.json`의 `name`이 `LabnoteV` → `labnotev`로 정규화되었습니다. **Marketplace 신규 설치자에게는 영향 없습니다**. 다만 v0.53.0 이하 VSIX로 수동 설치한 사용자가 VS Code의 publisher.name 변경 감지를 놓치면 구버전(`korea-biofoundry.LabnoteV`)과 신버전(`korea-biofoundry.labnotev`)이 동시에 표시될 수 있으므로 구버전 확장을 수동으로 제거한 뒤 새 버전을 설치하시기를 권장합니다.

### Added
- **VS Code Marketplace 공개 게시**: `Labnote: Open with Section Editor` 명령으로 시작하는 모든 기능을 VS Code Marketplace(`korea-biofoundry.labnotev`)에서 직접 설치 가능. VS Code 확장 검색에서 "Labnote Assistant"로 노출됨
- **GitHub Actions Marketplace 자동 게시 step**: 태그 푸시 시 `vsce publish --packagePath` 사용으로 GitHub Release와 Marketplace에 완전히 동일한 VSIX 바이트가 게시됨. `VSCE_PAT` GitHub Secret 등록 필요
- **Marketplace 검색용 메타데이터 보강**: `keywords`(labnote/lab notebook/experiment/biology/bioinformatics/markdown/sample tracking/workflow/kribb), `categories`(Notebooks, Education, Other), `galleryBanner`(dark theme), 128×128 PNG 아이콘(`resources/icons/labnotev-128.png`) 추가

### Changed
- **`name` 필드 정규화**: `LabnoteV` → `labnotev`(소문자). Marketplace 설치 ID는 `korea-biofoundry.labnotev`이며 VSIX 파일명은 `labnotev-X.Y.Z.vsix`로 표준화됨
- **`displayName` 단순화**: `"Labnote Assistant for VSCode"` → `"Labnote Assistant"`(VS Code 가이드라인 권장 표기)
- **`description` 확장**: 검색 노출용으로 도메인 키워드(sample tracking, workflow checklists, Section Editor, biology, bioinformatics) 추가

### Fixed
- **GitHub Release 안내문 파일명 불일치 해결**: 기존 `release.yml`의 `code --install-extension labnotev-X.Y.Z.vsix` 안내문이 실제 산출물 파일명(`LabnoteV-X.Y.Z.vsix`)과 불일치하던 pre-existing 문제가 `name` 소문자화로 자연 해결됨

### Removed
- **`.vscodeignore`의 dead `TEST_GUIDE.md` 항목**: v0.53.0에서 파일이 삭제되었음에도 ignore 규칙이 남아있던 잔재 정리
- **VSIX 패키지에서 `bash.exe.stackdump` 및 Marketplace 아이콘 소스(SVG) 제외**: `.vscodeignore`에 `**/*.stackdump`와 `resources/icons/labnotev-marketplace.svg` 패턴 추가로 패키지 크기/품질 개선

## [0.53.0] - 2026-05-14

### Added
- **확장 영문 전환 + VS Code l10n 인프라 도입**: 확장의 UI 메시지, 명령 라벨, 안내/에러 메시지를 모두 영문 기본으로 전환. VS Code의 표시 언어가 한국어(`ko`)이면 명령 팔레트의 명령 타이틀(`%key%` 참조)과 런타임 메시지(`vscode.l10n.t()` 호출)가 자동으로 한국어로 표시됨. 번역 사전은 워크스페이스 루트의 `package.nls.json` / `package.nls.ko.json`(선언적 문자열) 및 `l10n/bundle.l10n.ko.json`(런타임 메시지)에 분리 관리
- **영문 README + 한국어 README 분리 운영**: 기존 한국어 README를 `README.ko.md`로 분리하고, `README.md`를 영문으로 새로 작성. 양쪽 문서 상단에 상호 링크를 두어 사용자가 원하는 언어로 진입 가능. 최신 코드베이스(v0.49~v0.52)의 모든 기능을 반영하도록 본문 갱신
- **새 명령 타이틀의 한국어 번역 제공**: `Labnote: Open with Section Editor` / `Open as Markdown Editor` / `Open Preview` 등이 한국어 로케일에서 각각 `Section Editor로 열기` / `Markdown 편집기로 열기` / `미리보기 열기`로 표시됨

### Changed
- **신규 워크플로/유닛 오퍼레이션 본문은 항상 영문 고정 저장**: SW/HW UnitOp 8개 섹션의 placeholder 안내문과 워크플로 초기 본문의 `## Related Unit Operations` 블록쿼트 안내가 활성 로케일과 무관하게 영문으로 디스크에 기록되도록 변경. 한국어 사용자가 만든 노트를 영문 환경에서 열 때 본문이 깨지는 호환성 문제를 원천 차단. 기존 한글 본문은 사용자 데이터로 그대로 유지됨
- **SW/HW UnitOp 템플릿을 공통 헬퍼로 추출**: 동일 본문을 4곳(`sectionEditorProvider`, `workflowCommands`, `creationCommands`, `workflowStructure`)에서 따로 관리하던 중복을 `src/lib/unitOpTemplate.ts`로 통합. 향후 UnitOp 템플릿 변경 시 한 곳만 수정하면 됨
- **`workflowRename` 에러 모델을 discriminated union(`code` 필드)으로 리팩터**: 메시지 문자열 기반 분기를 `code: 'invalid_filename' | 'empty_name' | 'sanitized_empty' | 'no_change' | 'ambiguous_readme'`로 전환해 언어 무관 테스트와 다국어 메시지를 분리. 테스트는 `expect(result).toEqual({ error: { code: '...' } })` 형태로 안정화
- **auto-versioning 규칙 업데이트**: `frontend/package.json` → `package.json`으로 정정하고, README 동기화 단계에서 `README.md`(영문)와 `README.ko.md`(한국어)를 동시에 갱신하도록 명시. `git add` 예시에 `README.ko.md` 포함

### Removed
- **`TEST_GUIDE.md` 제거**: 사용자 요청에 따라 별도 테스트 가이드 문서 삭제 (개발자 참고 사항은 README에 통합)
- **`src/lib/josa.ts` + 관련 테스트 제거**: 한국어 조사 처리 유틸리티는 UI 영문화 이후 호출처가 없어 삭제. `SampleInfoPanel.ts`의 4 callsite는 영문 문장 패턴(`Rename {0}`, `Renamed {0} → {1}` 등)으로 치환

## [0.52.0] - 2026-05-14

### Added
- **이슈 #19 워크플로 이름 변경 명령 (`Labnote: Rename Workflow`)**: 워크플로 이름을 한 번에 5곳(파일명, front matter `title`, 본문 `## [...]` 헤더, 같은 폴더 `README.labnote.md`의 체크리스트 표시명/링크) 일괄 갱신하는 명령을 추가. 파일 탐색기에서 `{seq}_{id}_{name}.labnote.md` 파일을 우클릭하거나, 해당 파일이 활성 에디터인 상태에서 Command Palette로 실행 가능. `id`와 `sequence`는 보존되며 name만 변경됨. 빈 이름, sanitize 후 빈 이름, 동일 파일명 충돌은 입력 다이얼로그가 차단. 본문에 우연히 들어간 `title:` 문자열이나 다른 워크플로의 `## [...]` 헤더는 영향을 받지 않도록 front matter 영역과 id 매칭을 엄격히 적용. README 체크리스트에 같은 파일이 여러 번 등록된 ambiguous한 상태에서는 자동 갱신을 거부하고 사용자에게 안내

## [0.51.0] - 2026-05-14

### Changed
- **이슈 #20 파일 첨부 시 커서 위치에 인라인 삽입 (UX 개선)**: 섹션의 첨부 아이콘으로 파일을 첨부할 때 마크다운 링크가 더 이상 섹션 마지막 줄로 강제 이동하지 않고 textarea의 현재 커서 위치에 인라인으로 삽입됨. 삽입 직후 캐럿이 링크 뒤로 자동 이동. textarea에 포커스가 없거나 다른 섹션에 포커스가 있는 경우, 그리고 다이얼로그가 떠 있는 동안 다른 섹션으로 포커스가 옮겨가는 경우에는 안전하게 섹션 끝에 append하는 기존 동작으로 폴백 (잘못된 위치 삽입 방지). 새 순수 헬퍼 `insertAttachmentLinkAt` / `isFocusedOn`을 도입해 단위 테스트로 회귀 방지

## [0.50.3] - 2026-05-01

### Fixed
- **이슈 #18-1 샘플 트리 D&D 재정렬 미동작 수정**: `SAMPLE_TREE_DND_MIME` 상수 값을 비표준 `application/vnd.code.tree.labnotevsampletreeview`에서 VS Code 표준인 `application/vnd.code.tree.labnotev.sampleTreeView`(viewId와 동일한 형식)로 교정. 이전 값은 same-view drop을 자동 라우팅받지 못해 `handleDrop`이 호출되지 않아 드래그해도 순서가 바뀌지 않던 원인이었음
- **이슈 #18-2 Section editor Tab 들여쓰기 미동작 수정**: 일부 webview 환경에서 React 합성 이벤트의 `e.preventDefault()`가 textarea의 native focus traversal을 완전히 막지 못하던 문제를 보강. `HighlightedTextarea`에 capture 단계 native keydown 리스너를 추가해 Tab의 기본 동작을 가장 먼저 차단하고, `useTableEditing`의 핸들러에서도 `stopPropagation` / `nativeEvent.preventDefault`를 함께 호출하도록 다층 방어를 적용

## [0.50.2] - 2026-05-01

### Added
- **VS Code 내장 Markdown Preview의 한 줄 Enter 줄바꿈 기본 적용 (이슈 #18-3)**: `package.json`의 `contributes.configurationDefaults`에 `markdown.preview.breaks: true`를 추가하여, LabnoteV가 활성화된 환경에서 `Ctrl+Shift+V` 미리보기가 단일 Enter도 줄바꿈으로 렌더링하도록 기본값을 변경. 사용자가 `settings.json`에 직접 `markdown.preview.breaks: false`를 두면 그 값이 우선 적용됨

## [0.50.1] - 2026-04-30

### Fixed
- **`appendUnitOpToDocument`의 누락된 문서 반영**: `WorkspaceEdit`를 만들고 `applyEdit`까지 호출했지만 `edit.replace(document.uri, fullRange, newContent)`가 빠져 있어 유닛 오퍼레이션을 추가해도 webview의 자동 저장 디바운스가 발화하기 전에 에디터를 닫으면 변경분이 손실되던 문제 수정 (TDD로 회귀 테스트 추가)
- **테스트 실패 3건 갱신**: `workflowStructure.test.ts`의 `createWorkflowContent` / `createWorkflowFileName` 호출이 v0.37.0에서 변경된 2-인자 시그니처를 따르도록 수정하고, 사용자 설명 인자가 제거된 기능과 관련된 테스트 2건 제거. `SampleCompletionProvider.test.ts`의 샘플 ID 구분자 기대값을 v0.46.0 표준인 `;`로 갱신

### Changed
- **테스트 mock 타입 매개변수 정비 (TS 에러 60건 일괄 정리)**: `src/__tests__/setup.ts`에서 `vi.fn`에 명시적 타입 매개변수(`<[command, callback], Disposable>`)를 부여해 `mock.calls[i][n]`의 추론을 정상화. 더불어 테스트 파일에서 `import type`로 인터페이스를 분리(`SampleDisplayInfo`, `JsonSampleRecord`, `WorkflowInfo`)하고, mock 객체에 `as unknown as vscode.TextDocument` 등 안전 캐스팅을 적용해 `tsc --noEmit`이 0 에러로 통과하도록 정리
- **webview 번들 경고 한도 700KB**: `webview-section/vite.config.ts`에 `chunkSizeWarningLimit: 700`을 추가. Custom Editor webview는 로컬 디스크에서 로드되므로 500KB 기본 경고가 의미 없는 노이즈였음

### Removed
- **워크스페이스 루트의 stray `nul` 파일 정리**: Windows bash 리다이렉션 부산물(0 byte) 삭제 및 `.gitignore`에 `/nul` 항목 추가로 재생성 방지

## [0.50.0] - 2026-04-30

### Added
- **Section editor Tab 들여쓰기 / Shift+Tab 내어쓰기 (이슈 #18-2)**: 테이블 밖에서 Tab은 커서 위치에 2 공백을 삽입하고, Shift+Tab은 줄 시작의 공백을 최대 2칸 제거합니다. 여러 줄을 선택한 상태에서는 모든 줄에 일괄 적용되어 마크다운 리스트의 하위 그룹 들여쓰기에 그대로 활용 가능. 테이블 안에서 Tab은 기존대로 다음 셀로 이동합니다
- **`webview-section/src/utils/indent.ts` 새 헬퍼 모듈**: `applyIndent(text, selStart, selEnd, mode)`로 들여쓰기 결과 텍스트와 새 선택 범위를 순수 함수로 계산해 단위 테스트 가능

## [0.49.0] - 2026-04-30

### Added
- **Lab Samples 트리뷰 드래그앤드롭 순서 변경 (이슈 #18-1)**: 같은 scope(Local/Global)와 같은 타입(DNA/RNA/Reagent 등) 안에서 샘플을 다른 샘플 위로 끌어다 놓으면 순서가 바뀌고 JSON 파일에 즉시 저장됨. 타입 노드 위에 놓으면 맨 끝으로 이동, 다중 선택 시 상대 순서 보존. 다른 타입/scope로의 D&D는 무시되며 범위 이동은 기존 `Move to Global/Local` 명령이 담당
- **`SampleTreeViewProvider.reorderSamples` / `getSampleIds` 공개 메서드**: D&D 컨트롤러가 새 키 순서를 계산해 위임할 수 있도록 추가. 누락된 ID는 끝에 보존되어 데이터 손실을 방지

## [0.48.3] - 2026-03-26

### Fixed
- **섹션 헤더의 `+Sample` 버튼으로 생성한 샘플 정의가 엉뚱한 위치에 삽입되던 문제**: `App.tsx`의 `sampleDefinitionCreated` 핸들러가 `setWorkflow`로 콘텐츠를 삽입한 뒤 `pendingCursor`를 설정하지 않아, caret이 이전 위치에 멈춰 있거나 섹션 끝으로 드리프트된 상태로 유지되었고, 다음번 `+Sample` 클릭 시 `resolveInsertPosition`이 stale한 `activeCursorPos`(섹션 말미)를 사용하여 정의 텍스트가 섹션 끝에 계속 추가되던 문제 수정
- **동기적 삽입 위치 사전 계산**: v0.48.2의 `sampleInserted` 패턴과 동일하게, 대상 UnitOperation/Section을 `workflowRef.current`와 메시지 `opId`/`secHeading`으로 동기적으로 사전 해석하고 `pendingDefCursorPos`를 React 배치 상태 업데이트 **이전**에 계산. `setWorkflow` 이후 `setPendingCursor({ pos, scroll: 'nearest' })`를 명시적으로 호출하여 caret이 삽입된 정의의 끝으로 이동하고 뷰포트가 따라가도록 보장

## [0.48.2] - 2026-03-26

### Fixed
- **TreeView Sample Insert 후 caret이 textarea 맨 앞으로 튀는 문제 (최종 수정)**: v0.47.4 / v0.48.1에서도 잔존하던 동일 증상의 실제 원인은 스크롤 로직이 아니라 React state updater의 실행 시점 문제였음. `App.tsx` `sampleInserted` 핸들러가 `let actualPos = 0`으로 초기화한 뒤, `setWorkflow(prev => insertAt(prev))` updater 내부에서 `actualPos = cutStart`를 대입하고 바로 다음 줄에서 `setPendingCursor({ pos: actualPos + text.length })`를 호출하는 구조였는데, React 18의 배치된 setState에서 updater가 지연 실행되므로 pendingCursor는 초기값 `0`으로 계산돼 caret이 `0 + text.length` 위치(≒ textarea 앞쪽)로 이동하던 문제를 수정
- **동기적 actualPos 사전 계산으로 구조 변경**: insert 대상 섹션의 현재 `original` 콘텐츠를 `labNote` / `workflow` / `linkedWorkflows` 상태 클로저에서 동기적으로 조회해, prefix-cut(`@type;` 중복 제거) 포함 `cutStart`를 setState 호출 이전에 결정. updater(`insertAt(prev)`)는 동일 로직을 `prev` 기반으로 독립 수행하여 state 일관성 유지. 이로써 blur 경로나 stale cursor 보고와 무관하게 pendingCursor가 항상 실제 삽입 종료 위치를 가리키도록 보장

## [0.48.1] - 2026-03-26

### Fixed
- **샘플 Insert 후 caret이 textarea 첫 줄로 튀는 문제 (재수정)**: v0.47.4의 `scrollIntoView({ block: 'nearest' })` 접근이 이 프로젝트에 맞지 않았던 것을 교정. Section Editor의 `HighlightedTextarea`는 `scrollHeight` 기반 auto-resize + `overflow: hidden`을 쓰므로 textarea 엘리먼트 자체가 뷰포트보다 커질 수 있다. 이 상태에서 `scrollIntoView({ block: 'nearest' })`는 caret 위치가 아니라 textarea **블록의 top edge**를 뷰포트에 맞춰, caret은 아래쪽에 있는데도 textarea 첫 줄이 화면에 나타나 사용자에겐 "커서가 첫 줄로 튐"으로 보이던 문제가 남아 있었음
- **caret mirror 기반 최소 스크롤로 교체**: [`webview-section/src/utils/caretPosition.ts`](webview-section/src/utils/caretPosition.ts) 신규 추가. textarea와 동일한 글꼴·패딩·폭의 hidden div에 `value.slice(0, pos)` + zero-width marker span을 넣어 `getBoundingClientRect()`로 실제 caret 뷰포트 좌표를 계산하고, `'nearest'`는 caret이 상·하 margin 밖에 있을 때만 `window.scrollBy`로 최소한만 이동, `'center'`는 caret을 뷰포트 중앙으로 정렬. 이미 보이는 caret에는 스크롤을 발생시키지 않음
- 대상 파일: [`webview-section/src/components/HighlightedTextarea.tsx`](webview-section/src/components/HighlightedTextarea.tsx) `requestFocusAt` useEffect의 `scrollIntoView` 호출을 `getTextareaCaretRect` + `scrollCaretIntoView`로 교체

## [0.48.0] - 2026-03-26

### Changed
- **MongoDB 통합 기본 비활성화 (opt-in 전환)**: 새 설정 `labnotev.enableMongo` (기본값 `false`)를 추가. `@equip`/`@labware` 자동완성이나 Labware 제품 피커가 처음 호출될 때 SBLIMS 서버가 도달 불가한 경우 `serverSelectionTimeoutMS: 5000` + `connectTimeoutMS: 10000`에 의해 최대 5–10초 가량 블로킹되던 현상을 제거. 기존에 `labnotev.mongoUrl`만 설정해둔 사용자는 업그레이드 후 Equip/Labware 항목이 사라진 것처럼 보일 수 있으며, 계속 사용하려면 설정에서 `labnotev.enableMongo`를 `true`로 켜야 함
- **설정 변경 즉시 반영**: `labnotev.enableMongo`, `labnotev.mongoUrl`, `labnotev.mongoDbName` 중 하나라도 변경되면 VS Code 재시작 없이 `reloadRemoteData()`가 자동 호출돼 연결을 해제하거나 재시도. 토글을 끄면 `warnedDisabled` 플래그가 리셋되어 다음 호출에서 디버그 로그가 한 번만 남도록 유지

## [0.47.4] - 2026-03-26

### Fixed
- **샘플 Insert 후 caret이 "첫 줄"로 보이는 문제**: `HighlightedTextarea`가 포커스 시 `preventScroll: true`로 부모 컨테이너 스크롤까지 차단해, 긴 본문(공백·줄바꿈이 포함된 여러 라인) 중간에 샘플을 삽입하면 caret이 뷰포트 아래로 빠져 사용자에게는 커서가 첫 줄로 튄 것처럼 보이던 문제 수정. `requestFocusAt`에 `scroll` 힌트(`'none' | 'nearest' | 'center'`)를 추가하고, TreeView Insert/텍스트 삽입/이미지 붙여넣기 경로는 `'nearest'`로 동작해 caret이 화면을 벗어난 경우에만 최소한으로 스크롤하도록 개선
- **"정의로 이동" 화면 이동 안 됨**: 샘플 호버 후 "정의로 이동"을 눌러도 Section Editor의 아코디언이 접혀 있으면 대상 textarea가 DOM에 없어 커서/스크롤이 적용되지 않던 문제 수정. `UnitOpAccordion`을 controlled multiple Accordion으로 전환하고, `scrollToSample` 핸들러에서 대상 UnitOp을 자동으로 펼친 뒤 두 프레임 뒤에 `scroll: 'center'`로 포커스를 적용해 정의 위치가 뷰 중앙으로 오도록 개선
- **포커스 적용 중 stale cursor 보고**: 프로그래밍적 포커스 설정 시 `focus()`가 동기적으로 발화하는 onFocus에서 `reportCursor`가 아직 이동 전 `selectionStart`를 부모에게 보고해 `activeSectionRef.cursorPos`를 잠깐 잘못 덮어쓰던 레이스 수정 (`isApplyingFocusRef` 가드 추가, `setSelectionRange` → `focus` 순서로 보정)

## [0.47.3] - 2026-03-26

### Fixed
- **TreeView Insert 버튼 무응답**: 샘플 TreeView 항목을 클릭하면 포커스가 TreeView로 이동해 `webviewPanel.active`가 `false`가 되고, 이때 `activeEditor`가 해제되어 삽입이 아무 반응 없이 조용히 무시되던 문제 수정. 마지막 활성 웹뷰를 기억하는 `_lastActiveEditor` fallback을 추가해 TreeView 포커스 상태에서도 정상적으로 Insert 메시지가 전달되도록 개선
- **샘플 삽입 직후 커서 점프**: `pendingCursor` 상태가 소비된 뒤에도 리셋되지 않아, 아코디언을 접었다 다시 펼치는 등 컴포넌트가 리마운트될 때 오래된 caret 위치가 재적용되어 엉뚱한 곳으로 이동하던 문제 수정. 샘플/이미지/`scrollToSample` 삽입 후 다음 렌더 사이클에서 `pendingCursor`를 명시적으로 해제
- **연속 포커스 요청 레이스 컨디션**: `HighlightedTextarea`의 `requestFocusAt` 처리에서 `requestAnimationFrame` 핸들이 취소되지 않아, 빠른 연속 삽입 시 이전 rAF 콜백이 뒤늦게 실행되어 caret이 엇갈리던 문제 수정 (`cancelAnimationFrame` cleanup 추가)

## [0.47.2] - 2026-03-26

### Changed
- **MongoDB 번들 분리 유지**: `esbuild` 설정에서 `mongodb`를 `external`로 지정해 확장 번들에서 제외. 지연 로드(`await import('mongodb')`) 시점에만 런타임 `node_modules`에서 해석되도록 하여 활성화 시 거대한 의존성 트리 평가를 회피
- **VSIX 패키징 규칙 보정**: `.vscodeignore`에서 `mongodb` 및 하위 의존 패키지(`@mongodb-js`, `bson`, `whatwg-url` 등)를 화이트리스트로 복원해, `external`로 분리된 모듈이 VSIX에 정상 포함되도록 수정
- **활성화 지연 구간 가시화**: `extension.ts`에 모듈 로드 시점(`moduleLoadedAt`) 대비 `activate()` 호출까지의 경과 시간을 기록하는 `beforeActivate` 로그 추가. 번들 크기/로드 비용으로 인한 지연을 활성화 로직과 구분해 진단 가능

## [0.47.1] - 2026-04-18

### Fixed
- **+Sample 버튼 커서 위치 오작동**: 섹션 헤더의 +Sample 버튼으로 샘플 정의를 추가할 때, 직전에 다른 섹션을 포커스했다면 그 섹션의 커서 오프셋이 잘못 적용돼 엉뚱한 위치(또는 섹션 끝)에 삽입되던 문제 수정. 버튼 클릭 시 해당 textarea를 먼저 포커스·커서 보고하고, `sampleDefinitionCreated` 핸들러가 `opId`/`secHeading`이 실제로 일치할 때만 추적된 커서 위치를 사용하도록 가드
- **TreeView Insert 후 스크롤 튐**: `Insert to Editor` / `Insert Definition`으로 샘플 참조를 넣은 직후 브라우저의 자동 `scroll-into-view` 때문에 caret이 다른 곳으로 이동한 것처럼 보이던 문제 수정 (`textarea.focus({ preventScroll: true })`)
- **섹션 미포커스 상태 Insert 조용한 무시**: 어떤 textarea도 포커스된 적이 없는 상태에서 Insert를 호출하면 아무 반응 없이 무시되던 동작을, 상단 상태 뱃지 옆에 3초간 표시되는 경고 뱃지(“먼저 삽입할 섹션의 텍스트 영역을 클릭하세요.”)로 교체
- **드래그 후 blur된 커서 누락**: 텍스트 영역 내부에서 드래그가 바깥에서 끝나거나 모달 포커스 트랩으로 blur되는 경우 직전 caret이 보고되지 않던 문제 수정 (`onBlur`에서도 커서 위치 보고)

## [0.47.0] - 2026-04-18

### Added
- **수동 MongoDB 재로드 커맨드**: `Labnote: Reload Remote Data (MongoDB)` 커맨드 추가. 확장 기동 후 `mongoUrl` 설정을 변경하거나 서버가 뒤늦게 도달 가능해진 경우 VS Code 재시작 없이 Equip/Labware 캐시를 다시 불러올 수 있음
- **활성화 타이밍 계측 로그**: `activate()`의 주요 단계(`registerCompletionProvider`, `createSampleTreeView`, `createWorkflowTreeView`, `registerCustomEditor`, `registerCommands`, `activateEnd`)에 대해 `performance.now()` 기반 경과 시간 로그를 Output에 기록

### Changed
- **확장 활성화 속도 개선**: MongoDB 초기화를 `activate()` 경로에서 제거하고 지연 로드로 전환. Mongo 서버가 도달 불가능해도 기동이 최대 10–15초 지연되던 문제 해소. 연결 완료 후에는 `onRemoteDataLoaded` 이벤트로 샘플 트리가 자동 갱신되어 Equip/Labware ID가 뒤늦게 나타남
- **활성화 이벤트 축소**: `activationEvents`에서 `onLanguage:markdown`을 제거하고 `workspaceContains:**/*.labnote.md`로 대체. 라보노트와 무관한 일반 마크다운 파일을 열 때 확장이 더 이상 로드되지 않음 (커맨드/뷰는 호출 시 자동 활성화)
- **Workflow TreeView 지연 로딩**: Workflow/Unit Operation 카탈로그 JSON 로드가 생성자에서 제거되어, 사용자가 해당 트리뷰를 펼치기 전까지 동기 파일 I/O가 발생하지 않음
- **MongoDB 질의 경량화**: `equip_list`/`Item_Catalog` 조회에 projection을 적용해 실제 사용되는 필드(`equip`/`equip_num`/`subname`, `CID`/`물품명`/`name`)만 네트워크로 전송

### Fixed
- **Mongo 실패 시 재시도 폭주 방지**: 자동완성 트리거마다 MongoDB 재접속이 반복되던 문제 해결. 한 번 실패한 세션에서는 재시도를 중단하고, 필요 시 `Labnote: Reload Remote Data`로 수동 재시도하도록 동작 변경

## [0.46.0] - 2026-04-18

### Added
- **TreeView 드래그 앤 드롭**: Sample TreeView의 샘플 노드를 에디터로 드래그하면 `@type;ID;별칭;설명` 정의가 자동 삽입됨. 다중 선택 시 여러 줄로 삽입되며, Equip 타입은 ID를 생략한 포맷을 따름
- **샘플 TreeView 타입 아이콘 색상**: 타입 노드 아이콘이 본문 하이라이트와 동일한 팔레트로 표시되어 DNA/RNA/Plasmid 등을 시각적으로 즉시 구분 가능
- **샘플 TreeView 빈 상태 안내**: 타입에 샘플이 없을 때 "샘플 없음" 안내 행을 표시 (Local은 우클릭으로 생성, Global은 본문 저장 시 자동 등록된다는 힌트 포함)
- **한국어 조사 헬퍼**: `src/lib/josa.ts`의 `josa`/`withJosa`로 `을/를`, `이/가`, `은/는`, `와/과`, `으로/로`(ㄹ 받침 특수 처리 포함)를 받침 유무에 따라 자동 선택. SampleInfoPanel의 안내 메시지에서 어색한 `을(를)` 표기 제거

### Changed
- **샘플 정의 삽입 시 프리픽스 중복 제거**: TreeView의 Insert Definition 및 Section Editor 웹뷰 모두에서, 커서 앞에 이미 `@type;` 또는 `@type:` 프리픽스가 타이핑되어 있으면 새 정의가 프리픽스를 중복 삽입하지 않고 해당 범위를 교체하도록 개선
- **샘플 정의 생성 라우팅 안정화**: `sampleDefinitionCreated` 메시지가 동적으로 순서가 바뀐 유닛 오퍼레이션에서도 올바른 섹션에 삽입되도록 `opId`/`secHeading` 기반 조회를 우선 사용(인덱스는 폴백)
- **샘플 정보 패널 한국어화**: `Sample Info` → `샘플 정보`, `Rename` → `이름 변경`, `Replace` → `다른 ID로 교체`, `Sources` → `출처` 등으로 통일. 패널 생성 HTML 전체에 `escapeHtml` 일관 적용으로 특수문자 안전성 강화
- **샘플 디스플레이 메타 단일 소스화**: `getSampleDisplayMeta(customTypes)`를 `sampleUtils`에 신설하고 Section Editor의 `availableTypes`/`sampleTypeColors`/`customTypesUpdated` 메시지가 모두 이 단일 엔트리에서 파생되도록 통합
- **자동완성 성능 개선**: `SampleCompletionProvider`가 `@`가 없는 라인에서 조기 반환하고, 로컬·글로벌 샘플 JSON의 `mtimeMs` 기반 인메모리 캐시를 도입해 타이핑 중 디스크 재읽기를 최소화. 트리거 문자도 `@`, `;`, `:` 3개로 축소
- **샘플 생성 모달 UX**: 모달 오픈 시 자동 포커스, 필수 항목 표시, 비정상 문자 검증, `submitting` 상태 시 로딩 표시 및 중복 제출 방지, Enter 키 폼 제출 지원
- **샘플 하이라이트 클릭 통과**: 투명 textarea 오버레이 위의 샘플 토큰 클릭 시에도 실제 textarea 캐럿이 정확한 위치로 이동하도록 개선. "정의로 이동" 버튼은 정의가 없을 때 비활성화되며 툴팁으로 이유 안내
- **샘플 설명 편집 동작**: Edit 다이얼로그에서 설명 필드를 수정/비우면 기존 설명 배열을 덮어써 저장하도록 변경 (이전에는 누적되어 InfoPanel/TreeView에 과거 설명이 남아 있었음)

### Fixed
- **커서 위치 폴백 일관화**: 샘플·텍스트·이미지 삽입 시 `cursorPos`가 없을 때 `original.length`로 일관되게 폴백해 삽입 후 실제 위치(`actualPos`)가 정확히 반영되도록 수정
- **ID 패턴 통일**: `buildSampleIdPattern`으로 저장 추출·본문 하이라이팅·InfoPanel 교체가 모두 `(?:-\d+)*` 세그먼트를 공유하게 되어 `DNA-1737000000000-3` 같은 충돌 해결 ID도 동일하게 매칭됨

## [0.45.1] - 2026-04-18

### Fixed
- **샘플 호버 툴팁**: Section Editor / 유닛 오퍼레이션 아코디언의 텍스트 영역에서 `DNA-001` 같은 샘플 토큰 위로 마우스를 올려도 정보 말풍선(HoverCard)이 뜨지 않던 문제 수정. 투명 textarea가 오버레이를 덮고 있어 샘플 span이 마우스 이벤트를 받지 못하던 z-index 레이어 순서를 바로잡음(오버레이 `pointer-events: none` 유지로 비-샘플 영역 클릭 통과는 동일)

## [0.45.0] - 2026-04-18

### Added
- **Section Editor 샘플 메타**: 확장이 `resources/labsamples` JSON을 읽어 웹뷰에 샘플 ID별 별칭·설명 맵을 전달하고, 문서에서 샘플 정의를 추가한 뒤 저장하면 `sampleDefsUpdated`로 동기화되어 하이라이트/툴팁에 반영됨

### Fixed
- **샘플 트리 재저장**: 워크스페이스 루트가 실험 폴더와 같을 때 Local과 Global `resources/labsamples` 경로가 동일해, 두 번째 저장 이후 `dna.json` 등이 비워져 사이드바 타입 개수가 0으로 보이던 문제 수정
- **Office 첨부 열기**: Windows 등에서 `file:` URI의 `openExternal` 대신 OS 기본 앱으로 여는 경로(`cmd`/`open`/`xdg-open`)를 사용해 한글·공백 경로에서 VS Code 오류 다이얼로그가 뜨던 문제 완화(폴백 체인 유지)

## [0.44.1] - 2026-04-17

### Changed
- **문서**: README에 최근 릴리스 반영 — Related Unit Operations TOC, Output +Sample, UHW/USW 타입 표시, Conclusions 저장·동기화, 테이블 정렬(버튼 전용), 첨부 이미지 썸네일, Reagen 정규화, 샘플 트리 설정 갱신, Quick Start 첨부 요약 등

## [0.44.0] - 2026-04-17

### Added
- **Section Editor 첨부 이미지 썸네일**: `[이름](경로)` 형식으로 삽입한 이미지 파일도 `![](…)` 붙여넣기와 동일하게 textarea 아래 썸네일·모달 미리보기에 표시(동일 경로는 한 번만). 비이미지 첨부는 기존처럼 종이클립 링크만 표시

## [0.43.2] - 2026-04-17

### Fixed
- **워크플로 유닛 오퍼레이션 타입 표시**: 마크다운 파서가 카탈로그 ID `USW`/`UHW` 접두어를 인식하지 못해 `USW` 계열이 항상 HW로 표시되던 문제 수정(레거시 `SW`/`HW` 접두어 호환 유지)

## [0.43.1] - 2026-04-17

### Fixed
- **파일 첨부 경로**: `images/` 등 실험 폴더(열린 `.labnote.md`와 같은 디렉터리) 안 파일을 첨부해도 `resources/attachments/`로 복사되던 동작을 수정하고, 폴더 내부 파일은 복사 없이 상대 경로 링크만 삽입하도록 변경

### Changed
- **문서**: README에 클립보드 이미지 붙여넣기와 파일 첨부의 저장·링크 동작 차이를 명확히 기술

## [0.43.0] - 2026-04-17

### Added
- **Section Editor 파일 첨부**: 섹션 제목 옆 첨부 버튼으로 파일 선택 시 `resources/attachments/`에 복사(또는 이미 실험 폴더 `resources/` 안 파일은 상대 경로 링크만 삽입), 본문에 마크다운 링크 추가
- **첨부 링크 UI**: 섹션 textarea 아래에서 첨부 파일 링크를 표시하고 클릭 시 열기

### Fixed
- **Office 첨부 열기**: Excel·Word·PowerPoint 등은 VS Code 대신 OS 기본 앱으로 열도록 하여 에디터에서 깨지거나 오류가 나는 문제 완화; 실패 시 `openWith`/`vscode.open` 폴백 및 오류 시 파일 위치 표시

## [0.42.0] - 2026-04-16

### Added
- **Output 섹션 샘플 추가**: 워크플로 유닛 오퍼레이션의 Output 섹션에도 샘플 추가(플라스크) 버튼 노출

### Fixed
- **Reagen 오타 정규화**: 워크플로 파서에서 `#### Reagen` 헤딩을 `#### Reagent`로 자동 정규화하여, 웹뷰 표시 및 저장 시 올바른 표기로 통일

## [0.41.0] - 2026-03-30

### 개선

#### Related Unit Operations TOC 자동 생성
- 워크플로 마크다운 직렬화 시 `## Related Unit Operations` 섹션에 각 유닛 오퍼레이션의 앵커 링크 목록(TOC)을 자동 생성
- 마크다운 프리뷰에서 TOC 링크 클릭 시 해당 유닛 오퍼레이션 헤딩으로 이동 가능
- alias 포함 헤딩에 대해서도 정확한 slug 생성으로 앵커 매칭 보장

## [0.40.0] - 2026-03-30

### 수정

#### Conclusions and Discussion 섹션 파싱/직렬화 수정
- 워크플로 파일의 `## Conclusions and Discussion` 섹션이 마크다운 파일에 저장되지 않던 문제 수정
- 유닛 오퍼레이션이 없는 새 워크플로에서 skip 루프가 Conclusions 헤딩까지 건너뛰던 문제 해결
- 직렬화 시 항상 `## Conclusions and Discussion` 헤딩을 출력하도록 변경
- 파싱 시 tailContent에서 Conclusions 헤딩을 분리하여 Section Editor UI 중복 표시 방지

## [0.39.0] - 2026-03-29

### 수정

#### 샘플 트리뷰 버그 수정
- 다른 파일/폴더나 extension 관리 페이지로 이동 후 샘플 트리메뉴로 돌아올 때 로컬 샘플이 사라지던 문제 수정 -- `.labnote.md` 파일이 활성화될 때만 로컬 폴더를 업데이트하도록 변경
- 커스텀 샘플 타입(`labnotev.customSampleTypes` 설정)이 트리메뉴에 표시되지 않던 문제 수정 -- 빌트인 타입과 커스텀 타입을 합쳐서 표시
- `labnotev.customSampleTypes` 설정 변경 시 샘플 트리가 자동 갱신되도록 리스너 추가

#### 로컬 샘플 실험 폴더 스코핑
- Section Editor(커스텀 에디터)에서 다른 실험 폴더의 `.labnote.md` 파일로 전환할 때 로컬 샘플이 해당 실험 폴더로 올바르게 갱신되도록 수정
- 커스텀 에디터 초기 로드 및 탭 전환 시 `updateDocumentFolder` 호출 추가

## [0.38.0] - 2026-03-29

### 변경

#### 샘플 구분자 `;`로 통일
- 샘플 정의/참조 구분자를 `|`와 `:`에서 `;`로 변경 -- 마크다운 테이블의 `|` 기호와 충돌 해소
  - 정의: `@type;ID;alias;description` (기존: `@type:ID|alias:description`)
  - 참조: `ID;alias` (기존: `ID|alias`)
- 파싱 시 기존 형식(`|`, `:`)도 함께 인식하여 하위 호환성 유지
- 자동완성 트리거에 `;` 추가 (`@type;`으로 자동완성 활성화)

### 수정
- 워크플로 카탈로그 설명(blockquote)이 제거되었던 문제 복원

## [0.37.0] - 2026-03-29

### 개선

#### 워크플로 헤더 편집 개선
- 워크플로 생성 시 설명(description) 입력 단계 제거 -- 파일 즉시 생성 후 Section Editor에서 설명 편집
- 워크플로 파일명에서 설명 부분 제거 (`001_WD010_Name.labnote.md`)
- Section Editor에서 워크플로 헤더의 설명 부분을 인라인 편집 가능하게 변경 (UnitOp alias와 유사한 패턴)
- 워크플로 헤더 아래 blockquote 설명 제거 (기존 파일도 재저장 시 제거)
- 워크플로 설명 편집 시 `readme.labnote.md`의 Related Workflows 체크리스트 타이틀 자동 동기화
- UnitOp alias 및 워크플로 헤더 설명 입력 영역이 가용 공간을 최대한 사용하도록 flex 레이아웃 개선

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
