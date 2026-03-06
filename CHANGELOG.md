# 변경 이력

이 파일은 프로젝트의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 기반으로 하며,
이 프로젝트는 [유의적 버전 관리](https://semver.org/lang/ko/)를 따릅니다.

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
