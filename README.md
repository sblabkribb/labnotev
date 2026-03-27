# Labnote Assistant (LabnoteV)

VS Code에서 실험 노트를 마크다운으로 작성할 수 있도록 돕는 확장입니다. `.labnote.md` 파일을 Section Editor(웹뷰 기반 구조화 편집기)로 열어 Front Matter 폼, 워크플로 체크리스트, 유닛 오퍼레이션 아코디언, 샘플 정의 버튼, 이미지 붙여넣기/썸네일 등 실험 기록에 최적화된 UI를 제공합니다.

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
   - 왼쪽 Activity Bar의 플라스크 아이콘 클릭 → 워크플로 트리뷰에서 원하는 워크플로의 `[Create]` 버튼 클릭
   - 또는 명령 팔레트에서 `Labnote: Create Workflow` 입력
   - 생성된 워크플로는 Related Workflows 섹션에 자동으로 체크리스트 형태로 연결됨
7. 워크플로 제목을 클릭하면 해당 워크플로 `.labnote.md` 파일이 Section Editor로 열림
   - 워크플로 파일 상단에 "Back to Lab Note" 링크가 표시되어 원래 실험 노트로 돌아갈 수 있음
8. 워크플로에서 유닛 오퍼레이션 추가
   - Activity Bar에서 원하는 유닛 오퍼레이션의 `[Insert]` 버튼 클릭
   - 유닛 오퍼레이션은 아코디언 UI로 표시되며, 드래그 앤 드롭으로 순서 변경 가능
   - HW: Input, Reagent, Consumables, Equipment, Method, Output, Results & Discussions
   - SW: Input, Output, Parameters, QC Metrics, Method, Environment, Discussion
9. 샘플 정의
   - 각 유닛 오퍼레이션의 섹션 제목 옆에 샘플 타입 버튼(`+DNA`, `+RNA`, `+Protein` 등)이 표시됨
   - 버튼 클릭 → 별칭/설명 입력 → 해당 textarea에 `- @type:ID|별칭:설명` 형식으로 자동 삽입
   - 또는 Activity Bar의 Sample TreeView에서 타입 우클릭 → Add Sample로 생성 후 Insert Definition으로 삽입
10. 문서는 편집 시 **자동 저장**되며, 상단 배지에 저장 상태가 표시됨
    - "텍스트로 열기" 버튼으로 원본 마크다운을 텍스트 에디터에서 확인 가능

## 주요 기능

### Section Editor (기본 편집기)

`.labnote.md` 파일을 열면 자동으로 Section Editor가 표시됩니다. 마크다운 파일을 파싱하여 구조화된 폼 UI로 보여주며, 편집 내용은 마크다운으로 직렬화되어 저장됩니다.

#### Lab Note 모드 (`README.labnote.md`)

- **Front Matter 폼**: Title, Author, Experiment Type, Created Date, Last Updated를 입력 폼으로 편집
  - 날짜 필드는 DatePickerInput(달력 클릭) + 시간 입력(숫자 자동 포맷팅, Now 버튼)으로 제공
- **Experiment Objective**: 실험 목적을 자유롭게 작성하는 textarea
- **Related Workflows**: 연결된 워크플로 체크리스트
  - 워크플로 제목 클릭 시 해당 워크플로 `.labnote.md` 파일을 Section Editor로 열기
- **Results & Discussion**: 실험 결과 및 논의 작성 영역
- **Summary and Discussion**: 실험 전체 요약 작성 영역

#### Workflow 모드 (워크플로 `.labnote.md`)

- **Back to Lab Note 링크**: 상단에 원래 실험 노트로 돌아가는 링크 표시
- **Front Matter 폼**: Title, Experimenter, Created Date, Last Updated, End Date를 편집
- **Workflow Header**: 워크플로 제목과 설명 표시
- **Unit Operations**: 유닛 오퍼레이션 목록을 아코디언 UI로 표시
  - 드래그 앤 드롭으로 순서 변경
  - 유닛 오퍼레이션 이름 옆에 별칭(alias) 인라인 편집 가능
  - Meta 섹션: Experimenter(텍스트 입력), Start/End Date(날짜 달력 + 시간 선택)를 구조화된 폼으로 표시
  - 일반 섹션(Input, Output, Method 등): textarea로 자유롭게 편집
  - 섹션별 샘플 정의 버튼: `+DNA`, `+RNA`, `+Plasmid`, `+Protein`, `+Primer`, `+Reagent`, `+Labware`, `+Equip`
- **Conclusion / Summary**: 워크플로 전체 요약 작성 영역

#### 공통 기능

- **자동 저장**: 편집 후 1.5초 뒤 자동 저장, 상단에 저장 상태 배지 표시 (저장됨/변경사항 있음/저장 중)
- **이미지 붙여넣기**: 모든 textarea(Conclusion/Summary 포함)에서 `Ctrl+V`로 클립보드 이미지 붙여넣기 가능
  - 이미지가 `images/` 폴더에 자동 저장되고 마크다운 이미지 링크가 삽입됨
  - 삽입 후 커서가 삽입된 텍스트 끝에 자동 위치 (샘플/텍스트 삽입 시에도 동일)
  - textarea 아래에 이미지 썸네일이 자동 표시되며, 클릭 시 모달로 확대 보기
- **textarea 자동 높이 조절**: 모든 SectionEditor의 textarea가 내용에 따라 자동 확장 (스크롤바 없음)
- **샘플 ID 하이라이팅**: textarea 내 샘플 ID를 타입별 색상으로 강조 표시
  - 하이라이팅된 샘플 ID 클릭 시 해당 정의 위치로 이동
- **마크다운 테이블 편집 지원**: textarea에서 마크다운 테이블을 쉽게 작성할 수 있는 보조 기능
  - 섹션 제목 옆 테이블 아이콘 클릭 → 행/열 수 지정 → 테이블 템플릿 삽입
  - 테이블 내에서 Tab으로 다음 셀, Shift+Tab으로 이전 셀 이동 (마지막 셀에서 Tab → 새 행 추가)
  - Excel/Google Sheets에서 복사한 데이터를 붙여넣으면 마크다운 테이블로 자동 변환
  - Ctrl+Shift+F 또는 정렬 버튼으로 테이블 컬럼 자동 정렬 (한글 등 CJK 문자 너비 고려)
- **텍스트로 열기**: 상단 버튼으로 원본 마크다운을 VS Code 텍스트 에디터로 열기

### 샘플 ID 관리

샘플 ID는 `@type:ID|별칭:설명` 형식으로 **정의**하고, `ID|별칭` 형식으로 **참조**합니다.

#### Section Editor에서의 샘플 관리

- **섹션별 정의 버튼**: 유닛 오퍼레이션의 각 섹션 제목 옆에 샘플 타입 버튼이 표시됨
  - 버튼 클릭 → 별칭/설명 입력 → `- @type:ID|별칭:설명` 형식으로 textarea에 삽입
  - Reagent/Labware는 참조 DB에서 제품을 검색하여 선택 가능
- **하이라이팅**: textarea 내 샘플 ID가 타입별 색상으로 강조
- **네비게이션**: 하이라이팅된 샘플 ID 클릭 시 정의 위치로 이동

#### 텍스트 에디터에서의 `@` 자동완성 (`.md` 파일)

일반 `.md` 파일을 텍스트 에디터로 열었을 때 사용 가능한 기능입니다.

- `@dna:`, `@rna:`, `@plasmid:`, `@reagent:`, `@primer:`, `@labware:` - 타입별 샘플 검색
- `@sample:` - 모든 타입 샘플 검색
- `@equip:` - 장비 검색 (MongoDB/로컬)
- 콜론(`:`) 입력 시 자동완성 리스트 표시, 이후 입력으로 필터링
- "새 ID 생성", "정보 입력" 옵션 제공

| 상황 | 입력 | 결과 |
|------|------|------|
| **기존 샘플 참조** | `@dna:` → 기존 샘플 선택 | `DNA-123\|SampleA` |
| **새 샘플 정의** | `@dna:` → 새 ID 생성 | `@dna:DNA-xxx\|별칭:설명` |
| **TreeView 참조** | 샘플 더블클릭 | `DNA-123\|SampleA` |
| **TreeView 정의** | 우클릭 → Insert Definition | `@dna:DNA-123\|SampleA:설명` |

#### 샘플 저장

- 문서 저장 시 샘플 정보가 `resources/labsamples/{TYPE}.json`에 자동 저장
- 지원 형식: `@type:ID|별칭:설명`, `ID|별칭:설명`, `ID|별칭`, `ID: 설명`
- 별칭에 공백/특수문자 포함 가능 (예: `Reagent-1|UltraPure™ DNase/RNase-Free Water:설명`)
- **참조 DB**: `{TYPE}_{이름}.json` 파일로 제품 카탈로그 제공 (읽기 전용)
  - 예: `reagent_buffer.json`, `labware_plate.json`

### Sample TreeView (Activity Bar)

- **트리뷰 표시**: VS Code Activity Bar에 플라스크 아이콘으로 샘플 패널 표시
- **Local/Global 구분**: 문서 폴더와 워크스페이스 루트의 샘플 분리 표시
- **계층 구조**:
  - `Samples (Local)` / `Samples (Global)`: 루트 노드
  - `DNA [3]`, `RNA [1]` 등: 타입별 노드
  - `DNA-123 | 샘플A`: 개별 샘플
- **컨텍스트 메뉴**:
  - 샘플 더블클릭: 에디터에 `ID|별칭` 삽입 (참조)
  - 우클릭 → Insert Definition: `@{type}:ID|별칭:설명` 삽입 (정의)
  - 우클릭 → Move to Definition: 샘플 정의 위치로 이동
  - 타입 우클릭 → Add Sample: 새 샘플 추가
  - 샘플 우클릭 → Edit / Delete: 별칭/설명 수정 또는 삭제
  - Move to Global / Move to Local: 샘플 범위 이동
- **샘플 검색**: 트리뷰 제목 바의 검색 아이콘 또는 `Labnote: Search Sample` 명령어

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

### 날짜 관리

- **Section Editor**: Front Matter의 Created Date, Last Updated, End Date를 날짜 달력 + 시간 입력으로 편집
  - 시간 필드에 숫자만 입력해도 자동 포맷팅 (예: `1430` → `14:30`, `930` → `09:30`)
  - "Now" 버튼(시계 아이콘)으로 현재 날짜+시간을 즉시 설정
- **텍스트 에디터**: 키보드 단축키로 날짜 삽입/업데이트
  - `Ctrl+Shift+D` / `Cmd+Shift+D`: 날짜/시간 삽입
  - `Ctrl+Shift+U` / `Cmd+Shift+U`: 날짜 필드 업데이트

### MongoDB 연동 (선택)

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
| `Labnote: Insert Unit Operation` | 워크플로에 유닛 오퍼레이션 템플릿 삽입 |
| `Labnote: Search Sample` | 샘플 검색 및 삽입 |
| `Labnote: Search Workflow` | 워크플로/유닛 오퍼레이션 검색 |
| `Labnote: Insert Current Date` | 현재 날짜 삽입 (텍스트 에디터) |
| `Labnote: Insert Current Date and Time` | 현재 날짜/시간 삽입 (텍스트 에디터) |
| `Labnote: Manage Templates` | 워크플로/유닛 오퍼레이션 JSON 카탈로그 편집 |

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

일반적으로는 확장 설치 시 자동으로 Section Editor가 기본 편집기로 등록되지만, 다른 마크다운 확장과 충돌할 경우 위 설정이 필요할 수 있습니다.

### `@` 자동완성이 보이지 않을 때

- `@` 자동완성은 **텍스트 에디터**에서만 동작합니다. Section Editor에서는 섹션별 샘플 정의 버튼을 사용하세요.
- `.md` 파일이 텍스트 에디터로 열려 있는지 확인하세요 (Section Editor의 "텍스트로 열기" 버튼으로 전환 가능).
- `@dna:`, `@rna:`, `@sample:` 같은 접두어 뒤에서 자동완성이 동작합니다.
- Activity Bar의 샘플 트리가 오래된 내용으로 보이면 새로고침 아이콘을 눌러 다시 읽을 수 있습니다.

### MongoDB를 쓰지 않는 경우

- MongoDB 설정이 없어도 기본 샘플 관리, 워크플로, 유닛 오퍼레이션 기능은 사용할 수 있습니다.
- MongoDB 연동은 Equip/Labware 같은 외부 목록을 불러오고 싶을 때만 선택적으로 설정하면 됩니다.

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

## 라이선스

MIT License
