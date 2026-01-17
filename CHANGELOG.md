# 변경 이력

이 파일은 프로젝트의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 기반으로 하며,
이 프로젝트는 [유의적 버전 관리](https://semver.org/lang/ko/)를 따릅니다.

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
