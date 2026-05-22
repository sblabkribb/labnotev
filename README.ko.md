# Labnote Assistant (LabnoteV)

**v0.56.0** · [English → README.md](README.md)

VS Code에서 실험 노트를 마크다운으로 작성할 수 있도록 돕는 확장입니다. `.labnote.md` 파일을 Section Editor(웹뷰 기반 구조화 편집기)로 열어 Front Matter 폼, 워크플로 체크리스트, 유닛 오퍼레이션 아코디언, 샘플 정의 버튼, 이미지 붙여넣기/썸네일 등 실험 기록에 최적화된 UI를 제공합니다.

> v0.53.0부터 확장의 UI 메시지/명령 라벨은 영문 기본으로 제공되며, VS Code 언어 설정이 한국어(`ko`)이면 명령 팔레트와 안내 메시지가 자동으로 한국어로 표시됩니다(`l10n/bundle.l10n.ko.json` + `package.nls.ko.json`). 사용자가 작성한 노트 본문(한글 텍스트, 한글 폴더명, 한글 별칭/설명 등)은 그대로 유지됩니다.

## Quick Start

처음 사용하는 경우 아래 순서대로 진행하면 됩니다.

1. 명령 팔레트 열기 (`Ctrl+Shift+P` / `Cmd+Shift+P` / `F1`)
2. `Labnote: Create New Labnote Folder` 입력 및 실행으로 실험노트 생성
3. 실험 제목과 작성자 이름 입력
4. `labnote/{번호}_{제목}/` 폴더 구조가 생성되고 `README.labnote.md`가 **Section Editor**로 열림
   - Section Editor는 구조화된 폼 기반 편집기로, Front Matter(제목/작성자/날짜), Experiment Objective, Related Workflows, Summary and Discussion 섹션이 시각적으로 표시됨
   - `images/`: 실험 중 붙여넣거나 저장한 이미지 폴더
   - `resources/`: 샘플/워크플로 등 실험 관련 데이터 폴더
5. Experiment Objective 섹션에 실험 목적을 작성
6. 워크플로 추가
   - 왼쪽 Activity Bar의 플라스크 아이콘 클릭 → 워크플로 트리뷰에서 원하는 워크플로의 `[Labnote: Create Workflow]` 버튼 클릭
   - 또는 명령 팔레트에서 `Labnote: Create Workflow` 입력
   - 워크플로 파일이 즉시 생성되며 Related Workflows 섹션에 체크리스트로 연결됨
   - 워크플로 설명은 Section Editor에서 직접 편집 가능 (편집 시 readme.labnote.md에 자동 반영)
7. 워크플로 제목을 클릭하면 해당 워크플로 `.labnote.md` 파일이 Section Editor로 열림
   - 워크플로 파일 상단에 "Back to Lab Note" 링크가 표시되어 원래 실험 노트로 돌아갈 수 있음
8. 워크플로에서 유닛 오퍼레이션 추가
   - Activity Bar에서 원하는 유닛 오퍼레이션의 `[Insert]` 버튼 클릭
   - 유닛 오퍼레이션은 아코디언 UI로 표시되며, 드래그 앤 드롭으로 순서 변경 가능
   - HW: Input, Reagent, Labware and Consumables, Equipment, Method, Output, Results & Discussions
   - SW: Input, Output, Parameters, QC Metrics, Method, Environment, Discussion
   - **Output** 섹션을 포함해 각 섹션 제목 옆 **플라스크(+Sample)** 버튼으로 샘플 정의를 삽입할 수 있음
   - 새 워크플로/유닛 오퍼레이션을 만들 때 본문 안내 문구는 사용 로케일과 무관하게 **영문으로 고정 저장**됩니다(파일 호환성 보장). 기존 한글 본문은 사용자 데이터로 그대로 유지됨
9. 샘플 정의
   - 각 유닛오퍼레이션의 섹션 제목 옆 `+Sample` 버튼 클릭 → 모달에서 타입/별칭/설명 입력 → 해당 textarea에 `- @type;ID;별칭;설명` 형식으로 자동 삽입
   - 커스텀 타입도 모달에서 직접 정의하여 사용 가능
   - 또는 Activity Bar의 Sample TreeView에서 타입 우클릭 → Add Sample로 새 샘플 생성. 트리뷰의 `[Insert to Editor]` 버튼으로 Section Editor의 textarea에 참조 형태로 삽입
10. 샘플 참조
    - 샘플 삽입할 유닛오퍼레이션의 임의의 섹션에 커서를 위치
    - 왼쪽 Activity Bar의 Sample TreeView에서 `[Insert to Editor]` 버튼 클릭
11. 이미지
    - 커서 위치에 `Ctrl+V`로 클립보드 이미지 붙여넣기 가능 지원
    - 이미지는 `images/` 폴더에 자동 저장되고 마크다운 이미지 링크가 삽입됨
    - 텍스트박스 아래에 이미지 썸네일이 자동 표시되며, `![제목](링크)` 형식으로 제목을 입력하면 썸네일 아래에 제목 표시
    - **파일 첨부**(섹션 제목 옆 클립 아이콘): 실험 폴더 안 파일은 상대 링크만, 밖의 파일은 `resources/attachments/`에 복사 후 링크 삽입. 이미지 첨부도 썸네일로 확인 가능
12. 테이블
    - 섹션 제목 옆 테이블 아이콘 클릭 → 행/열 수 지정 → 테이블 템플릿 삽입
    - 테이블 내에서 Tab으로 다음 셀, Shift+Tab으로 이전 셀 이동 (마지막 셀에서 Tab → 새 행 추가)
    - Excel/Google Sheets에서 복사한 데이터를 붙여넣으면 마크다운 테이블로 자동 변환
    - 정렬 버튼으로 테이블 컬럼 자동 정렬 (한글 등 CJK 문자 너비 고려)
13. 기타
    - 문서는 편집 시 **자동 저장**되며 (1.5초뒤 자동 저장), 상단 배지에 저장 상태가 표시됨
    - **다크 모드**: 에디터 오른쪽 상단의 달/해 아이콘으로 다크/라이트 모드 전환 (설정은 자동 저장)
    - 에디터 타이틀 바 오른쪽 상단에서 Text Editor, Section Editor (플라스크아이콘), Preview 간 전환 가능
    - **Markdown Preview 줄바꿈**: 익스텐션이 `markdown.preview.breaks: true`를 기본값으로 적용해, 내장 Preview에서 Enter 한 번이 그대로 줄바꿈으로 렌더링됨 (사용자가 `settings.json`에서 직접 `false`로 덮어쓰면 그 값이 우선)

## 주요 기능

### Section Editor (기본 편집기)

`.labnote.md` 파일을 열면 자동으로 Section Editor가 표시됩니다. 마크다운 파일을 파싱하여 구조화된 폼 UI로 보여주며, 편집 내용은 마크다운으로 직렬화되어 저장됩니다.

#### Lab Note 모드 (`README.labnote.md`)

- **Front Matter 폼**: Title, Author, Experiment Type, Created Date, Last Updated를 입력 폼으로 편집
  - 날짜 필드는 DatePickerInput(달력 클릭) + 시간 입력(숫자 자동 포맷팅, Now 버튼)으로 제공
- **Experiment Objective**: 실험 목적을 자유롭게 작성하는 textarea
- **Related Workflows**: 연결된 워크플로 체크리스트
  - 워크플로 제목 클릭 시 해당 워크플로 `.labnote.md` 파일을 Section Editor로 열기
  - 저장 시 `## Related Unit Operations` 아래에 각 워크플로·유닛 오퍼레이션으로 점프할 수 있는 **목차(앵커 링크)**가 자동 생성되며, 마크다운 미리보기에서 링크를 클릭하면 해당 헤딩으로 이동할 수 있음
- **Results & Discussion**: 실험 결과 및 논의 작성 영역
- **Summary and Discussion**: 실험 전체 요약 작성 영역

#### Workflow 모드 (워크플로 `.labnote.md`)

- **Back to Lab Note 링크**: 상단에 원래 실험 노트로 돌아가는 링크 표시
- **Front Matter 폼**: Title, Experimenter, Created Date, Last Updated, End Date를 편집
- **Workflow Header**: 워크플로 제목 표시, 설명(description) 인라인 편집 가능 -- 편집 시 `readme.labnote.md` 체크리스트에 자동 동기화
- **Unit Operations**: 유닛 오퍼레이션 목록을 아코디언 UI로 표시
  - 드래그 앤 드롭으로 순서 변경
  - 유닛 오퍼레이션 이름 옆에 별칭(alias) 인라인 편집 가능
  - Meta 섹션: Experimenter(텍스트 입력), Start/End Date(날짜 달력 + 시간 선택)를 구조화된 폼으로 표시
  - 마크다운에 `#### Reagen`처럼 오타가 있어도 저장·표시 시 **`#### Reagent`**로 자동 정규화됨
  - 일반 섹션(Input, Output, Method 등): textarea로 자유롭게 편집
  - 카탈로그에서 삽입한 유닛 오퍼레이션 ID는 **`UHW…`(하드웨어)·`USW…`(소프트웨어)** 형식이며, Section Editor의 HW/SW 표시와 Meta의 Equipment/Software 필드가 이 접두어를 기준으로 맞춰짐(텍스트 에디터로 본문을 고친 뒤 다시 열어도 동일하게 인식)
  - `+Sample` 버튼으로 샘플 생성 모달 열기: 타입 선택(기본 8종 + 커스텀), 별칭, 설명을 한 번에 입력
  - Reagent/Labware 선택 시 "제품 검색(Search product)" 버튼으로 QuickPick 표시. 후보 출처는 로컬 + 워크스페이스의 `resources/labsamples/{Reagent|Labware}_*.json` 카탈로그이며, Labware의 경우 `labnotev.enableMongo`가 켜져 있을 때만 SBLIMS MongoDB `Item_Catalog`도 함께 검색됨. 후보가 없으면 어떤 파일을 추가하거나 어떤 설정을 켜야 하는지 안내 토스트가 표시됨.
  - "새 타입 추가"로 커스텀 샘플 타입 정의 가능 (워크스페이스 설정에 저장)
- **Conclusions and Discussion**: 워크플로 전체 요약 및 논의 작성 영역(저장 시 마크다운에 `## Conclusions and Discussion`이 항상 포함되며, Section Editor UI와 본문이 중복되지 않도록 동기화)

#### 공통 기능

- **자동 저장**: 편집 후 1.5초 뒤 자동 저장, 상단에 저장 상태 배지 표시 (저장됨/변경사항 있음/저장 중)
- **이미지 붙여넣기**: 모든 textarea(Conclusions and Discussion 포함)에서 `Ctrl+V`로 클립보드 이미지 붙여넣기 가능
  - 이미지가 `images/` 폴더에 자동 저장되고 마크다운 이미지 링크가 삽입됨
  - 삽입 후 커서가 삽입된 텍스트 끝에 자동 위치 (샘플/텍스트 삽입 시에도 동일)
  - textarea 아래에 이미지 썸네일이 자동 표시되며, `![제목]()` 형식으로 제목을 입력하면 썸네일 아래에 표시
  - 썸네일 클릭 시 모달로 확대 보기
- **파일 첨부**: 섹션 제목 옆 첨부 아이콘으로 파일을 선택하면, **이미 열려 있는 `.labnote.md`와 같은 실험 폴더 안**에 있는 파일(`images/`, `resources/` 등)은 복사하지 않고 상대 경로 링크만 삽입함. 실험 폴더 **밖**의 파일만 `resources/attachments/`로 복사한 뒤 해당 링크를 넣음(클립보드 이미지 붙여넣기와 달리, 첨부는 항상 `[이름](경로)` 형식)
  - textarea 아래에 첨부 링크가 표시되며, 클릭 시 열기(Office 파일은 OS 기본 앱 우선)
  - 이미지 확장자 첨부는 붙여넣기와 같이 **썸네일**로만 표시되고, PDF·스프레드시트 등 비이미지는 종이클립 링크 줄에만 표시됨
- **textarea 자동 높이 조절**: 모든 SectionEditor의 textarea가 내용에 따라 자동 확장 (스크롤바 없음)
- **샘플 ID 하이라이팅**: textarea 내 샘플 ID를 타입별 색상으로 강조 표시 (커스텀 타입 포함)
  - 하이라이팅된 샘플 ID 클릭 시 해당 정의 위치로 이동
- **마크다운 테이블 편집 지원**: 모든 textarea(SectionEditor, UnitOp 섹션 포함)에서 마크다운 테이블을 쉽게 작성할 수 있는 보조 기능
  - 섹션 제목 옆 테이블 아이콘 클릭 → 행/열 수 지정 → 테이블 템플릿 삽입
  - 테이블 내에서 Tab으로 다음 셀, Shift+Tab으로 이전 셀 이동 (마지막 셀에서 Tab → 새 행 추가)
  - Excel/Google Sheets에서 복사한 데이터를 붙여넣으면 마크다운 테이블로 자동 변환
  - 정렬 버튼으로 테이블 컬럼 자동 정렬 (한글 등 CJK 문자 너비 고려)
- **Tab 들여쓰기 / Shift+Tab 내어쓰기**: 테이블 외 영역에서 Tab은 2 공백 들여쓰기, Shift+Tab은 줄 시작 공백을 최대 2칸 제거. 여러 줄을 선택한 상태에서 Tab/Shift+Tab을 누르면 모든 줄에 일괄 적용됨 (마크다운 리스트 들여쓰기에 그대로 사용 가능)
  - 컬럼 정렬은 **툴바의 정렬 버튼**으로만 실행합니다(정렬 전용 키보드 단축키는 없음)
- **Chat으로 선택 보내기** (v0.56.0+): Section Editor의 어떤 textarea에서든 — Lab Note 모드(Experiment Objective, Results & Discussion, Summary and Discussion)와 Workflow 모드의 모든 UnitOp 섹션 — 드래그로 텍스트를 선택하면 selection 우측 상단에 작은 "Send selection to Chat" 플로팅 버튼이 나타남. 버튼을 클릭하거나 textarea 포커스 상태에서 `Ctrl+Alt+L` (macOS: `Cmd+Alt+L`)을 누르면 VS Code Chat 패널이 prefill된 상태로 열림. prompt에는 (1) 현재 파일을 `#file:` reference variable로 자동 첨부, (2) 출처 메타 라인(`Selected from <파일명> / UnitOp <opId> / Section "<heading>":`), (3) 펜스로 감싼 선택 텍스트가 포함됨. `isPartialQuery: true`로 동작해 사용자가 질문(예: "summarize", "rewrite as bullet points")을 마저 입력한 뒤 직접 Enter로 전송. 단축키는 webview 내부에서만 처리되고 `contributes.keybindings`에는 등록하지 않아 다른 `Ctrl/Cmd+Alt+L` 키바인딩과 충돌하지 않음
- **다크 모드**: 에디터 오른쪽 상단의 달/해 아이콘으로 다크/라이트 모드 전환 (설정은 자동 저장)
- **텍스트로 열기**: 상단 버튼으로 원본 마크다운을 VS Code 텍스트 에디터로 열기
- **에디터 3-way 전환 버튼**: 에디터 타이틀 바 오른쪽 상단에서 Text Editor, Section Editor, Preview 간 전환 가능
  - Text Editor / Preview 모드: 플라스크 아이콘 클릭 → Section Editor로 전환
  - Section Editor 모드: Markdown 편집기 아이콘 / 미리보기 아이콘 클릭 → 해당 모드로 전환

### 샘플 ID 관리

샘플 ID는 `@type;ID;별칭;설명` 형식으로 **정의**하고, `ID;별칭` 형식으로 **참조**합니다. (기존 `|`/`:` 구분자도 호환됩니다)

#### Section Editor에서의 샘플 관리

- **샘플 생성 모달**: 유닛 오퍼레이션의 각 섹션 제목 옆 `+Sample` 버튼 클릭 시 모달 표시
  - 타입 드롭다운(기본 8종 + 커스텀), 별칭, 설명(여러 줄 입력 가능)을 한 번에 입력하여 `- @type;ID;별칭;설명` 형식으로 삽입
  - Reagent/Labware는 "제품 검색" 버튼이 로컬 + 워크스페이스의 `resources/labsamples/{type}_*.json` 카탈로그를 검색하며, Labware는 `labnotev.enableMongo`가 켜진 경우 SBLIMS MongoDB `Item_Catalog`도 함께 검색합니다. 카탈로그가 비어 있으면 어떤 파일을 추가하거나 어떤 설정을 켜야 하는지 토스트로 안내하여 버튼이 무반응처럼 보이지 않도록 했습니다.
  - "새 타입 추가"로 커스텀 샘플 타입을 정의하면 본문에서 하이라이팅 및 추출/저장 가능
- **하이라이팅**: textarea 내 샘플 ID가 타입별 색상으로 강조
- **네비게이션**: 하이라이팅된 샘플 ID 클릭 시 정의 위치로 이동

#### 텍스트 에디터에서의 `@` 자동완성 (`.md` 파일)

일반 `.md` 파일을 텍스트 에디터로 열었을 때 사용 가능한 기능입니다.

- `@dna:`, `@rna:`, `@plasmid:`, `@reagent:`, `@primer:`, `@labware:` - 타입별 샘플 검색
- `@sample:` - 모든 타입 샘플 검색
- `@equip:` - 장비 검색 (MongoDB/로컬)
- 콜론(`:`) 입력 시 자동완성 리스트 표시, 이후 입력으로 필터링
- "Generate new ID", "Enter info" 옵션 제공

| 상황 | 입력 | 결과 |
|------|------|------|
| **기존 샘플 참조** | `@dna:` → 기존 샘플 선택 | `DNA-123\|SampleA` |
| **새 샘플 정의** | `@dna:` → 새 ID 생성 | `@dna:DNA-xxx\|별칭:설명` |
| **TreeView 참조** | 샘플 더블클릭 (또는 `[Insert to Editor]`) | `DNA-123\|SampleA` |

#### 샘플 저장

- 문서 저장 시 샘플 정보가 `resources/labsamples/{TYPE}.json`에 자동 저장
- 실험 폴더를 워크스페이스 루트로 연 경우에도(로컬·글로벌 `labsamples` 경로가 같을 때) 연속 저장 후에도 로컬 JSON이 비워지지 않도록 처리됨
- 지원 형식: `@type;ID;별칭;설명`, `ID;별칭;설명`, `ID;별칭`, `ID: 설명` (기존 `|`/`:` 구분자도 호환)
- 별칭에 공백/특수문자 포함 가능 (예: `Reagent-1|UltraPure™ DNase/RNase-Free Water:설명`)
- **참조 DB**: `{TYPE}_{이름}.json` 파일로 제품 카탈로그 제공 (읽기 전용)
  - 예: `reagent_buffer.json`, `labware_plate.json`

### Sample TreeView (Activity Bar)

- **트리뷰 표시**: VS Code Activity Bar에 플라스크 아이콘으로 샘플 패널 표시
- **Local/Global 구분**: 실험 폴더와 워크스페이스 루트의 샘플 분리 표시
  - 로컬 샘플은 현재 열린 `.labnote.md` 파일이 속한 실험 폴더의 `resources/labsamples/`에서 로딩
  - 다른 실험의 파일을 열면 해당 실험의 로컬 샘플로 자동 전환 (Text Editor 및 Section Editor 모두 지원)
  - 커스텀 샘플 타입(`labnotev.customSampleTypes` 설정)도 빌트인 타입과 함께 트리에 표시되며, 설정을 바꾸면 트리가 자동으로 갱신됨
- **계층 구조**:
  - `Samples (Local)` / `Samples (Global)`: 루트 노드
  - `DNA [3]`, `RNA [1]` 등: 타입별 노드 (빌트인 + 커스텀 타입)
  - `DNA-123 | 샘플A`: 개별 샘플
- **컨텍스트 메뉴**:
  - 샘플 더블클릭 (또는 인라인 `[Insert to Editor]` 아이콘 클릭): Section Editor의 textarea에 `ID;별칭` 삽입 (참조). 파일을 일반 마크다운 텍스트 에디터로 열고 있는 경우에는 `Labnote: Search Sample` 명령(또는 트리뷰 헤더의 돋보기 아이콘)을 사용해 커서 위치에 삽입하라는 안내가 표시됨
  - 우클릭 → Move to Definition: 활성 Section Editor 웹뷰에서 현재 문서의 `@type;ID...` 정의 위치로 스크롤. Section Editor 내부에서만 동작하며 마크다운 텍스트 에디터를 새로 열지 않음
  - 타입 우클릭 → Add Sample: 새 샘플 추가
  - 샘플 우클릭 → Edit Sample: 별칭/설명 수정
  - Move to Global / Move to Local: 샘플 범위 이동
- **드래그 앤 드롭**: 샘플 노드를 임의의 에디터로 드래그하면 `@type;ID;별칭;설명` 정의가 삽입됨. 다중 선택 시 여러 줄로 삽입
- **샘플 순서 변경**: 같은 타입(예: DNA) 안에서 샘플을 다른 샘플 위로 끌어다 놓으면 순서가 바뀌고 JSON 파일에 저장됨. 타입 노드 위에 놓으면 맨 끝으로 이동. 다중 선택 시 상대 순서 보존. 다른 타입/scope로 끌어다 놓는 D&D는 무시되며 이동은 기존 "Move to Global/Local" 명령으로 수행
- **타입별 아이콘 색상**: 타입 노드 아이콘이 본문 하이라이트와 동일한 팔레트로 표시되어 한눈에 구분 가능
- **빈 상태 안내**: 타입에 등록된 샘플이 없을 때 "No samples" 안내 행을 표시 (Local은 우클릭으로 생성, Global은 본문 저장 시 자동 등록됨을 안내)
- **샘플 검색**: 트리뷰 제목 바의 검색 아이콘 또는 명령 팔레트에서 `Labnote: Search Sample` 실행. Local + Global 전체 샘플을 ID·별칭·설명으로 검색하는 QuickPick이 표시됨
  - 선택한 샘플은 **Section Editor와 일반 마크다운 텍스트 에디터 모두에서** 현재 커서 위치에 삽입됨. 따라서 `.labnote.md`를 텍스트 모드로 편집 중일 때 샘플을 삽입하려면 이 방법을 사용. (트리뷰 인라인 `Insert to Editor`는 의도적으로 Section Editor 전용으로 유지됨)

### Workflow TreeView (Activity Bar)

- **워크플로 트리뷰**: Activity Bar의 Lab Samples 패널에 워크플로 카탈로그 표시
- **계층 구조**:
  - `Workflows [50]`: 루트 노드
    - `Design [13]`: 설계 워크플로 (WD 접두어)
    - `Build [17]`: 구축 워크플로 (WB 접두어)
    - `Test [19]`: 테스트 워크플로 (WT 접두어)
    - `Learn [10]`: 학습 워크플로 (WL 접두어)
    - `General [1]`: 범용 워크플로 (WG 접두어) - Blank Workflow 등 DBTL에 속하지 않는 워크플로
  - `HW Unit Operations`: 하드웨어 유닛 오퍼레이션 (UHW 접두어)
  - `SW Unit Operations`: 소프트웨어 유닛 오퍼레이션 (USW 접두어)
- **워크플로 명령어**:
  - `[Create]` 버튼: `README.labnote.md`에서 워크플로 파일 생성
  - 우클릭 → Edit, Delete: JSON 수정/삭제
  - 카테고리 우클릭 → Add Workflow: 새 워크플로 추가
- **유닛 오퍼레이션 명령어**:
  - `[Insert]` 버튼: 현재 열린 워크플로에 유닛 오퍼레이션 템플릿 삽입
  - 우클릭 → Edit, Delete: JSON 수정/삭제
  - 루트 우클릭 → Add Unit Operation: 새 유닛 오퍼레이션 추가
- **검색 기능**: 트리뷰 제목 바의 검색 아이콘으로 워크플로/유닛 오퍼레이션 검색
- **리소스 자동 복사**: 처음 실행 시 확장의 JSON 파일이 워크스페이스로 복사되어 사용자가 자유롭게 편집 가능

### 이미지 처리

- **Section Editor에서의 이미지 붙여넣기**: 모든 textarea에서 `Ctrl+V`로 클립보드 이미지를 붙여넣기 가능
  - 이미지가 `images/` 폴더에 자동 저장되고 마크다운 이미지 링크(`![](images/img_xxx.png)`)가 삽입됨
  - textarea 아래에 이미지 썸네일 자동 표시
  - 썸네일 클릭 시 모달로 확대 보기
- **첨부로 넣은 이미지**: `[파일명](images/…)`·`[파일명](resources/…)` 등 링크 형식으로 삽입한 이미지도 동일하게 썸네일·모달로 표시됨(`![](동일경로)`와 겹치면 한 번만 표시)
- **이미지 미리보기 패널**: 이미지 링크 클릭 시 별도 패널에서 이미지 열기
  - 줌 컨트롤 (+, -, Reset)
  - 키보드 단축키: Esc(닫기), +/-(줌), 0(리셋)

### 실험 노트 폴더 구조

- **새 실험 생성**: `Labnote: Create New Labnote Folder` 명령으로 실험 제목과 작성자 입력
- **생성 위치**: `labnote/{번호}_{제목}/` 형식
- **자동 번호 부여**: `001`, `002`, ... 형식으로 자동 증가
- **자동 생성 항목**:
  - `README.labnote.md`: 실험 개요 메인 문서 (Section Editor로 열림)
  - `images/`: 이미지 저장 폴더
  - `resources/`: 샘플/워크플로 데이터 폴더
- **워크플로 파일명 형식**: `{번호}_{워크플로ID}_{이름}.labnote.md` (예: `001_WD010_General_Design_of_Experiment.labnote.md`)
- **워크플로 이름 변경**: `Labnote: Rename Workflow` 명령으로 파일명, front matter `title`, 본문 H1 헤더, `README.labnote.md`의 체크리스트 표시명·링크가 한 번에 일괄 변경됩니다(v0.52부터).

### 날짜 관리

- **Section Editor**: Front Matter의 Created Date, Last Updated, End Date를 날짜 달력 + 시간 입력으로 편집
  - 시간 입력란 클릭 시 초기화 후 숫자를 입력하면 HH:MM 포맷에 맞춰 자동 채워짐 (4자리 완성 시 자동 확정)
  - "Now" 버튼(시계 아이콘)으로 현재 날짜+시간을 즉시 설정
- **텍스트 에디터**: 키보드 단축키로 날짜 삽입/업데이트
  - `Ctrl+Shift+D` / `Cmd+Shift+D`: 날짜/시간 삽입
  - `Ctrl+Shift+U` / `Cmd+Shift+U`: 날짜 필드 업데이트

### MongoDB 연동 (선택, 기본 비활성)

Equip, Labware 타입의 샘플은 SBLIMS MongoDB 데이터베이스에서 자동으로 로드됩니다. v0.48.0부터 **기본값은 비활성**이며, 명시적으로 켜야 연결을 시도합니다.

#### 설정 방법
1. VS Code 설정 열기 (`Ctrl+,`)
2. "Lab Note Editor" 검색
3. 다음 설정 입력:
   - `Enable Mongo`: SBLIMS MongoDB 연동 활성화 (기본값: `false`)
   - `Mongo Url`: MongoDB 연결 URL
   - `Mongo Db Name`: 데이터베이스 이름 (기본값: SBLIMS)

#### 연결 URL 형식

```
mongodb://username:password@host:port/?authMechanism=SCRAM-SHA-256&authSource=SBLIMS
```

#### 지연 로드 및 opt-in 동작

- `labnotev.enableMongo`가 `false`이면 확장은 MongoDB 드라이버를 전혀 로드하지 않고 Equip/Labware 자동완성·피커는 로컬/글로벌 JSON에서만 데이터를 얻습니다. 서버 도달 불가로 인한 5–10초 블로킹을 원천적으로 제거하기 위함입니다.
- `labnotev.enableMongo`를 `true`로 켜면, MongoDB 연결은 확장 활성화 시점이 아니라 Equip/Labware 관련 기능(자동완성, 샘플 트리 Equip 타입, Labware 후보 피커 등)이 처음 호출될 때 한 번만 비동기로 수행됩니다.
- `labnotev.enableMongo` / `labnotev.mongoUrl` / `labnotev.mongoDbName` 중 하나라도 바꾸면 VS Code 재시작 없이 자동으로 재로드됩니다. 수동으로 즉시 다시 시도하려면 명령 팔레트에서 `Labnote: Reload Remote Data (MongoDB)`를 실행하세요. 재로드가 끝나면 샘플 트리의 Equip/Labware 목록이 자동으로 갱신됩니다.

### 다국어 지원 (Localization)

- 확장의 UI 메시지와 명령 라벨은 영문이 기본이고, VS Code 표시 언어가 한국어(`ko`)이면 명령 팔레트(`%key%` 참조)와 안내 메시지(`vscode.l10n.t()` 호출)가 자동으로 한국어로 표시됩니다.
- 번역 사전 위치:
  - `package.nls.json` / `package.nls.ko.json`: `package.json`의 선언적 문자열(예: 명령 타이틀) 번역
  - `l10n/bundle.l10n.ko.json`: 런타임 안내/에러 메시지 번역
- **사용자 노트 본문은 절대 자동 번역되지 않습니다.** 한국어로 작성된 기존 노트, 폴더명, 별칭/설명은 그대로 유지됩니다.
- **신규 생성 본문은 항상 영문 고정**: 새 워크플로/유닛 오퍼레이션을 만들 때 디스크에 저장되는 안내 문구(섹션 placeholder, "Unit operations are appended here automatically" 등)는 활성 로케일과 무관하게 영문으로 기록되어 협업 시 파일 호환성이 유지됩니다.
- VS Code 표시 언어 전환: 명령 팔레트 → `Configure Display Language` → 원하는 언어 선택 후 재시작.

## 설치

### GitHub Releases에서 설치

1. [Releases](https://github.com/sblabkribb/labnotev/releases) 페이지에서 최신 `.vsix` 파일 다운로드
2. VS Code에서 `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. 다운로드한 `.vsix` 파일 선택
4. 설치 후 VS Code를 다시 열고, 워크스페이스에서 `F1`을 눌러 `Labnote`로 시작하는 명령어를 실행

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `Labnote: Create New Labnote Folder` | 새 실험 노트 폴더 구조 생성 |
| `Labnote: Create Workflow` | README에서 워크플로 파일 생성 |
| `Labnote: Rename Workflow` | 워크플로 이름을 한 번에 5곳(파일명, front matter, 본문 헤더, README 체크리스트 표시명/링크) 일괄 변경 |
| `Labnote: Insert Unit Operation` | 워크플로에 유닛 오퍼레이션 템플릿 삽입 |
| `Labnote: Search Sample` | 샘플 검색 및 삽입 |
| `Labnote: Search Workflow` | 워크플로/유닛 오퍼레이션 검색 |
| `Labnote: Insert Current Date` | 현재 날짜 삽입 (텍스트 에디터) |
| `Labnote: Insert Current Date and Time` | 현재 날짜/시간 삽입 (텍스트 에디터) |
| `Labnote: Manage Templates` | 워크플로/유닛 오퍼레이션 JSON 카탈로그 편집 |
| `Labnote: Reload Remote Data (MongoDB)` | MongoDB Equip/Labware 캐시를 수동으로 재로드 |
| `Labnote: Open with Section Editor` | 현재 마크다운 파일을 Section Editor로 열기 |
| `Labnote: Open as Markdown Editor` | 현재 파일을 텍스트 에디터로 열기 |
| `Labnote: Open Preview` | 현재 파일의 마크다운 미리보기 열기 |

## 문제 해결

### Section Editor가 열리지 않을 때

`.labnote.md` 파일이 Section Editor 대신 일반 텍스트 에디터로 열리는 경우, 다음 방법으로 기본 편집기를 설정할 수 있습니다.

**방법 1: "Open With" 메뉴 사용**

1. `.labnote.md` 파일을 우클릭 → "Open With..." 선택
2. "Lab Note Section Editor" 선택
3. "Configure default editor for '*.labnote.md'" 클릭하여 기본 편집기로 설정

**방법 2: settings.json에 직접 설정**

VS Code `settings.json`에 다음을 추가합니다:

```json
{
  "workbench.editorAssociations": {
    "*.labnote.md": "labnotev.sectionEditor"
  }
}
```

**방법 3: 에디터 타이틀 바 버튼 사용**

`.labnote.md` 파일이 텍스트 에디터나 미리보기로 열려 있을 때, 에디터 타이틀 바 오른쪽 상단에 플라스크 아이콘의 Section Editor 전환 버튼이 표시됩니다. 클릭하면 Section Editor로 전환됩니다. Section Editor에서는 Markdown 편집기 및 미리보기 전환 버튼이 표시됩니다.

일반적으로는 확장 설치 시 자동으로 Section Editor가 기본 편집기로 등록되지만, 다른 마크다운 확장과 충돌할 경우 위 설정이 필요할 수 있습니다.

### `@` 자동완성이 보이지 않을 때

- `@` 자동완성은 **텍스트 에디터**에서만 동작합니다. Section Editor에서는 섹션별 샘플 정의 버튼을 사용하세요.
- `.md` 파일이 텍스트 에디터로 열려 있는지 확인하세요 (Section Editor의 "Open in text editor" 버튼으로 전환 가능).
- `@dna:`, `@rna:`, `@sample:` 같은 접두어 뒤에서 자동완성이 동작합니다.
- Activity Bar의 샘플 트리가 오래된 내용으로 보이면 새로고침 아이콘을 눌러 다시 읽을 수 있습니다.

### MongoDB를 쓰지 않는 경우

- v0.48.0부터 MongoDB 연동은 기본 비활성(`labnotev.enableMongo` = `false`)이므로 별도 작업 없이 로컬/글로벌 JSON 기반의 샘플 관리, 워크플로, 유닛 오퍼레이션 기능을 그대로 사용할 수 있습니다.
- MongoDB 연동은 Equip/Labware 같은 외부 목록을 불러오고 싶을 때만 선택적으로 `labnotev.enableMongo`를 켜고 연결 URL을 설정하면 됩니다.

## 파일 저장 형식

- 실험 노트는 `.labnote.md` 확장자의 마크다운 파일로 저장됩니다.
- Section Editor는 마크다운을 파싱하여 구조화된 UI로 표시하고, 편집 내용을 다시 마크다운으로 직렬화하여 저장합니다. 원본 마크다운 호환성이 유지됩니다.
- 이미지 링크, YAML front matter, 일반 마크다운 문법을 그대로 사용할 수 있습니다.

```markdown
- @dna:DNA-123|SampleA:assembly template

DNA-123|SampleA
```

위 예시에서 첫 줄은 **샘플 정의** (`@`로 시작), 둘째 줄은 **본문 참조** (`@` 없이 ID만)입니다.

## 요구 사항

- **VS Code**: ^1.85.0

## 개발자 참고

소스에서 직접 실행하거나 개발하려면 저장소를 클론한 뒤 아래 명령을 사용할 수 있습니다.

```bash
npm run install:all
npm run build
npm test
```

- `npm test`: 호스트 측 Vitest 단위 테스트(`src/__tests__/**`)
- `cd webview-section && npm test`: 웹뷰 측 Vitest 컴포넌트 테스트
- `npm run build`: esbuild로 호스트 번들 생성 + Vite로 웹뷰 번들 생성
- 영문/한국어 UI 전환은 VS Code의 표시 언어 설정에 따라 자동 적용됩니다. 한국어 번역을 추가/수정하려면 워크스페이스 루트의 `l10n/bundle.l10n.ko.json` 및 `package.nls.ko.json`을 편집하세요.

## 라이선스

MIT License
