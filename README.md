# Labnote Assistant (LabnoteV)

VS Code에서 실험 노트를 마크다운으로 작성할 수 있도록 돕는 확장입니다. 샘플 정의/참조, 워크플로 연결, 유닛 오퍼레이션 템플릿, 이미지 관리 기능을 통해 실험 기록을 일관된 형식으로 정리할 수 있습니다.

## Quick start

처음 사용하는 경우 아래 순서대로 진행하면 됩니다.

1. 명령 팔레트 열기 (`Ctrl+Shift+P` / `Cmd+Shift+P` / `F1`)
2. `Labnote: Create New Labnote Folder` 입력 및 실행으로 실험노트 생성
3. 명령 팔레트에서 실험 제목과 작성자 이름 입력
4. `labnote/{번호}_{제목}/` 폴더 구조가 생성되고 `README.md`가 열림
   - `README.md`: YAML front matter와 실험 개요, Related Workflows 섹션이 포함된 메인 문서
   - `images/`: 실험 중 붙여넣거나 저장한 이미지 폴더
   - `resources/`: 샘플/워크플로 등 실험 관련 데이터 폴더
5. README에서 실험 목적을 적고, 왼쪽 플라스크 아이콘 클릭해서 activity bar 오픈
   - 워크플로 리스트에서 임의의 워크플로 추가, 또는 명령 팔레트에서 `Labnote: Create Workflow` 입력 후 워크플로 파일을 추가
   - 생성된 워크플로는 README의 `Related Workflows` 섹션에 자동으로 연결됨
6. 워크플로 또는 실험 본문에서 유닛오퍼레이션 템플릿 삽입
   - Activity bar에서 원하는 유닛오퍼레이션 선택해서 템플릿 삽입
   - 또는 명령 팔레트 열어서 `Labnote: Insert Unit Operation`으로 유닛 오퍼레이션 템플릿을 삽입
   - HW는 시약/장비 중심 템플릿, SW는 입력/출력/파라미터/QC/환경 중심 템플릿 사용
7. 샘플을 처음 기록할 때는 **정의 형식**으로 작성
   - `@type:`을 입력하고 `새로운 type ID 생성` 클릭
   - 예: `@dna:DNA-123|SampleA:assembly template`
   - `@type:`로 시작하는 줄은 샘플의 별칭과 설명을 포함한 **정의**로 취급됨
   - `Reagent`, `Labware`는 **사용자 DB**와 **참조 DB**를 함께 생각하면 이해하기 쉬움
     - 사용자 DB: 실제 실험 노트에서 정의하고 계속 사용하는 샘플. `resources/labsamples/Reagent.json`, `Labware.json`에 저장됨
     - 참조 DB: 제품 카탈로그처럼 읽기 전용으로 참고하는 목록. `resources/labsamples/Reagent_xxx.json`, `Labware_xxx.json` 같은 파일로 둘 수 있음
   - `@reagent:` / `@labware:`에서 **새 ID 생성**을 선택할 때는 참조 DB 후보를 보고 제품을 골라 새 샘플을 만들 수 있고, 이렇게 만든 샘플은 최종적으로 사용자 DB(`Reagent.json`, `Labware.json`)에 저장되어 이후 본문과 사이드바에서 다시 참조 가능
   - `Equip`은 성격이 조금 달라서 **새 ID 생성 없이** `@equip:`으로 검색해서 바로 선택해 사용하는 방식임
   - `Equip` 관련 목록은 사용자 DB(`Equip.json`)에 저장된 항목 외에도 참조 DB 또는 외부 장비 목록에서 읽어온 항목이 검색 후보로 함께 보일 수 있음
8. 본문에서 이미 정의한 샘플을 다시 언급할 때는 **참조 형식**으로 사용
   - 본문에서 `@type:` 또는 `@sample:` 입력 후 기존 정의된 샘플 선택
   - 예: `DNA-123|SampleA` 또는 `DNA-123`
   - 본문에서의 참조는 **`@` 없이** 샘플 ID만 적으며, 자동완성에서 기존 샘플을 선택해도 이 형식으로 삽입됨
9. 문서를 저장하면 본문에 있는 샘플 정의 정보가 `resources/labsamples/{TYPE}.json` 같은 **사용자 DB**에 반영되고, 사이드바 Sample TreeView에서도 바로 확인 가능
   - 정리하면: 참조 DB는 **검색/선택용**, 사용자 DB는 **실제 연구노트에서 계속 사용하는 샘플 저장용**임



## 주요 기능

### 🔬 샘플 ID 관리

- **샘플 정의**: 해당 샘플을 처음 등록할 때 사용하며, "새로운 ID 생성"으로 생성 가능. **`@`로 시작**. 예: `@dna:DNA-123|별칭:설명`.
- **본문에서의 참조**: 이미 정의된 샘플을 본문에서 언급할 때는 **`@` 없이** 샘플 ID만 적혀있음. 예: `DNA-123|SampleA` 또는 `DNA-123`. (자동완성·트리뷰에서 참조로 삽입할 때도 이 형식이 사용됨.)

#### @ 기반 자동완성 (텍스트 에디터)
- `@dna:`, `@rna:`, `@plasmid:`, `@reagent:`, `@primer:`, `@labware:` - 타입별 샘플 검색
- `@sample:` - 모든 타입 샘플 검색
- `@equip:` - 장비 검색 (MongoDB/로컬) 및 "정보 입력"으로 ID/별칭/설명 직접 입력 (새 ID 생성만 불가)
- **콜론(`:`) 입력 시** 자동완성 리스트 표시; **콜론 뒤에 계속 입력**하면 해당 입력 텍스트로 리스트가 검색(필터)됨 (예: `@dna:DNA` 입력 시 DNA가 포함된 항목만 표시)
- "새 ID 생성", "정보 입력" 옵션 제공 (Equip는 "정보 입력"만 제공)

#### 샘플 삽입 형식

| 상황 | 입력 | 결과 |
|------|------|------|
| **기존 샘플 참조** | `@dna:` → 기존 샘플 선택 | `DNA-123\|SampleA` (`@dna:` 제거됨) |
| **새 샘플 정의** | `@dna:` → 새 ID 생성 | `@dna:DNA-xxx\|별칭:설명` |
| **TreeView 참조** | 샘플 더블클릭 | `DNA-123\|SampleA` |
| **TreeView 정의** | 샘플 우클릭 → Insert Definition | `@dna:DNA-123\|SampleA:설명` |
| **Equip 정의** | Insert Definition | `@equip:\|별칭:설명` (ID 없음) |

- 참조: 본문에서 기존 샘플을 언급할 때 사용 (**@ 없이** ID와 별칭만)
- 정의: 샘플을 처음 정의할 때 사용 (**@로 시작하는** `@type:` 접두어 + 설명 포함)


#### 공통 기능
- **샘플 ID 하이라이팅**: 타입별 색상으로 샘플 ID 강조 표시 (항상 활성화)
  - DNA, RNA, Plasmid, Reagent, Primer, Protein, Equip, Labware 지원
  - `TYPE-숫자` 및 `TYPE-숫자-숫자` 형식 지원 (예: `DNA-123`, `Equip-123-456`)
- **@ 접두어 중복 방지**: "새 ID 생성" 또는 "정보 입력" 선택 시 이미 입력된 `@type:` 접두어를 교체하여 `@type:@type:...` 중복 방지
- **Sample Info 패널**: 문서 내 모든 샘플 ID 조회
  - 별칭, 설명, 출처 표시
  - 위치로 이동, Rename, Replace 기능
- **자동 저장**: 문서 저장 시 샘플 정보를 JSON으로 자동 저장 (항상 활성화)
  - `resources/labsamples/{TYPE}.json`에 저장 (사용자 DB)
  - 지원 형식: `@type:ID|별칭:설명`, `ID|별칭:설명`, `ID|별칭`, `ID: 설명` (정의는 @ 접두어, 참조는 @ 없이 ID만 사용)
  - 별칭에 공백·특수문자(™ 등) 포함 가능 (예: `Reagent-1|UltraPure™ DNase/RNase-Free Water:설명`)
  - Move to Global한 샘플은 문서 저장 시 Local에 다시 추가되지 않음
- **참조 DB (Reagent/Labware)**: 같은 폴더에 `{TYPE}_{이름}.json` 파일을 두면 제품 카탈로그로 읽음 (쓰기 없음)
  - 예: `reagent_buffer.json`, `labware_plate.json` — 사용자가 직접 생성·편집
  - `@reagent:` / `@labware:` 자동완성 및 "새 ID 생성" 시 이 목록에서 검색·선택 가능
  - 선택한 제품으로 생성한 샘플은 `Reagent.json` / `Labware.json`에 저장되어 본문·사이드바에서 참조
- **본문 ↔ 사이드바 동기화**:
  - 본문에서 샘플 정의(별칭/설명)를 수정하고 저장하면 사이드바 샘플 리스트가 자동 갱신됨
  - 사이드바에서 샘플 우클릭 → Edit으로 별칭/설명을 수정하면, 현재 열린 마크다운 본문의 해당 샘플 정의도 함께 갱신됨

### 🌲 Sample TreeView (Activity Bar)
- **트리뷰 표시**: VS Code Activity Bar에 플라스크 아이콘으로 샘플 패널 표시
- **Local/Global 구분**: 문서 폴더와 워크스페이스 루트의 샘플 분리 표시 (Move to Global 후 문서를 저장해도 해당 샘플은 Local에 재등록되지 않음)
- **계층 구조**:
  - `Samples (Local)` / `Samples (Global)`: 루트 노드 (언폴딩)
  - `DNA [3]`, `RNA [1]` 등: 타입별 노드 (언폴딩)
  - `DNA-123 | 샘플A`: 개별 샘플 (폴딩, 클릭하여 상세 정보)
- **컨텍스트 메뉴**:
  - 샘플 더블클릭: 에디터에 `ID|별칭` 삽입 (참조, 본문에서는 @ 없음)
  - 샘플 우클릭 → Insert Definition: `@{type}:ID|별칭:설명` 삽입 (정의, @로 시작)
  - 샘플 우클릭 → Move to Definition: 해당 샘플이 정의된 마크다운 본문 위치로 이동
  - 타입 우클릭: 새 샘플 추가
  - 샘플 우클릭: 편집 / 삭제 (별칭·설명 수정 시 JSON과 현재 열린 마크다운 본문 모두 갱신)
  - Local 샘플 우클릭 → Move to Global: 샘플을 Global로 이동
  - Global 샘플 우클릭 → Move to Local: 샘플을 Local로 이동
- **샘플 검색**: 트리뷰 제목 바의 🔍 아이콘 또는 `Labnote: Search Sample` 명령어
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
- **유닛 오퍼레이션 템플릿**:
  - **HW**: Input, Reagent, Consumables, Equipment, Method, Output, Results & Discussions
  - **SW**: Input, Output, Parameters, QC Metrics, Method, Environment, Discussion (실행·산출·설정·QC·환경·논의)
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

### 🖼️ 이미지 처리
- **클립보드 이미지 붙여넣기** (Ctrl+V)
- **이미지 미리보기 패널**: 이미지 링크 클릭 시 별도 패널에서 이미지 열기
  - 닫기 버튼을 누르기 전까지 패널 유지
  - 여러 이미지를 동시에 여러 패널로 열기 가능
  - 줌 컨트롤 (+, -, Reset)
  - 키보드 단축키: Esc(닫기), +/-(줌), 0(리셋)

### 📁 실험 노트 폴더 구조
- **새 실험 생성 방법**: Command Palette에서 `Labnote: Create New Labnote Folder` 명령을 실행한 뒤, 실험 제목과 작성자 이름을 입력하면 새 실험 폴더가 생성됩니다.
- **생성 위치**: 워크스페이스의 `labnote/` 아래에 `labnote/{번호}_{제목}/` 형식으로 생성됩니다.
- **자동 번호 부여**: 기존 실험 폴더를 기준으로 `001`, `002`, ... 형식의 다음 번호가 자동으로 부여됩니다.
- **자동 생성 항목**:
  - `README.md`: 실험 개요와 워크플로 목록을 기록하는 메인 문서
  - `images/`: 실험 중 추가한 이미지 저장 폴더
  - `resources/`: 샘플, 워크플로 등 실험 관련 데이터 저장 폴더
- **제목 처리 방식**: 폴더 이름에는 공백이 `_`로 바뀌고, 일부 특수문자는 제거되어 안전한 경로 이름으로 저장됩니다.

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

### GitHub Releases에서 설치

1. [Releases](https://github.com/sblabkribb/labnotev/releases) 페이지에서 최신 `.vsix` 파일 다운로드
2. VS Code에서 `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. 다운로드한 `.vsix` 파일 선택
4. 설치 후 VS Code를 다시 열고, 워크스페이스에서 `F1`을 눌러 `Labnote`로 시작하는 명령어를 실행
5. 이 README 내용은 확장 설치 후 VS Code의 확장 상세 화면에서 확인하는 사용자 도움말 역할도 합니다.

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `Labnote: Create New Labnote Folder` | 새 실험 노트 폴더 구조 생성 |
| `Labnote: Create Workflow` | README에서 워크플로 파일 생성 |
| `Labnote: Insert Unit Operation` | 현재 커서 위치에 유닛 오퍼레이션 템플릿 삽입 |
| `Labnote: Insert Current Date` | 현재 날짜 삽입 |
| `Labnote: Insert Current Date and Time` | 현재 날짜/시간 삽입 |
| `Labnote: Update Date Field on Current Line` | 현재 줄의 날짜 필드 업데이트 |
| `Labnote: Update All last_updated_date Fields` | 모든 날짜 필드 업데이트 |

## 문제 해결

### 자동완성이 보이지 않을 때

- `.md` 파일이 **기본 마크다운 텍스트 에디터**로 열려 있는지 확인하세요.
- `@dna:`, `@rna:`, `@sample:` 같은 접두어 뒤에서 자동완성이 동작합니다.
- 기존 샘플 참조는 `@type:` 또는 `@sample:` 입력 후 목록에서 선택하면 `@` 없이 `DNA-123|SampleA` 같은 형식으로 삽입됩니다.
- 저장 후 사이드바에 샘플이 보이지 않으면, 문서에 `@type:ID|별칭:설명` 형태의 **정의**가 들어 있는지 확인하세요.
- Activity Bar의 샘플 트리가 오래된 내용으로 보이면 새로고침 아이콘을 눌러 다시 읽을 수 있습니다.

### MongoDB를 쓰지 않는 경우

- MongoDB 설정이 없어도 기본 샘플 관리, 워크플로, 유닛 오퍼레이션 기능은 사용할 수 있습니다.
- MongoDB 연동은 Equip/Labware 같은 외부 목록을 불러오고 싶을 때만 선택적으로 설정하면 됩니다.

## 파일 저장 형식

- 실험 노트는 표준 마크다운 파일(`.md`)로 저장됩니다.
- 이미지 링크, YAML front matter, 일반 마크다운 문법을 그대로 사용할 수 있습니다.

```markdown
@dna:DNA-123|SampleA:assembly template

DNA-123|SampleA
```

위 예시에서 첫 줄은 **샘플 정의**, 둘째 줄은 **본문 참조**입니다.

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
