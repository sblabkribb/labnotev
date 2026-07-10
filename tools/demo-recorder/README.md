# Labnote Assistant — Demo Recorder

`docs/manual/`의 사용자 매뉴얼에 들어가는 **스냅샷(스크린샷)**과 **PDF**를 자동 생성하는 독립 도구입니다. 확장 본체(`src/`)와 분리되어 있으며 배포 vsix에 포함되지 않습니다(`.vscodeignore`의 `tools/**`).

## 동작 원리

VS Code / Cursor는 Electron 앱이므로, 원격 디버깅 포트를 열고 실행하면 Playwright가 CDP로 접속해 워크벤치 UI(명령 팔레트, TreeView, 웹뷰 iframe 포함)를 자동 조작할 수 있습니다. 각 단계에서 클릭 지점에 강조 오버레이를 주입하고 스크린샷을 찍습니다.

```
launch → connectOverCDP → 시나리오 진행 → 강조 주입 → page.screenshot → docs/manual/assets/img/
```

## 사전 준비

```bash
# 1) 확장을 먼저 빌드 (repo 루트에서)
cd ../..
npm run build

# 2) 레코더 의존성 설치
cd tools/demo-recorder
npm install
npx playwright install chromium   # PDF 생성용 headless Chromium
```

호스트 편집기는 **정품 Microsoft VS Code를 우선 사용**합니다(로그인 게이트 없음 + 실행 중인 Cursor와 충돌 없음). 레코더가 설치 경로를 자동 감지하며, 없으면 PATH의 `code`로 폴백합니다. 특정 실행 파일을 강제하려면 `LABNOTE_EDITOR_CLI` 환경 변수로 지정하세요.

## 사용법

### 스냅샷 캡처

```bash
npm run capture:all          # ch1~ch7 전체 순차 캡처
# 또는 챕터별
npm run capture:ch1          # ch2 ... ch7 도 동일
```

챕터마다 별도 Extension Development Host 창이 뜨고 시나리오가 자동 진행되며 `docs/manual/assets/img/chN-step*.png`가 생성됩니다. 완료 후 창은 자동으로 닫힙니다.

- 격리된 `--user-data-dir`을 사용하므로 사용자의 실제 편집기 세션에는 영향을 주지 않습니다.
- 캡처는 영어 UI 기준입니다. Extension Development Host의 표시 언어가 English인지 확인하세요.
- **안전 가드**: 디버깅 포트(기본 9222)가 이미 사용 중이면 실행을 거부하고, 접속한 창이 데모 워크스페이스인지 확인한 뒤에만 입력을 보냅니다. 다른 편집기 창을 조작할 위험을 차단합니다.
- 실행이 비정상 종료되어 EDH 창이 남으면 `npm run clean`으로 격리 EDH 프로세스만 정리할 수 있습니다(사용자의 실제 편집기는 건드리지 않음).

### PDF 생성

```bash
npm run export:pdf
```

`docs/manual/index.html`을 headless Chromium으로 열어 `manual.ko.pdf`, `manual.en.pdf`를 생성합니다. 매뉴얼은 `?lang=` / `?theme=` 쿼리 파라미터로 언어/테마를 고정합니다.

## 파일 구성

| 파일 | 역할 |
|------|------|
| `lib/host.mjs` | Extension Development Host 실행 + CDP 접속 + 데모 워크스페이스 초기화 |
| `lib/scenario.mjs` | 공통 시나리오 러너(생명주기·팔레트·웹뷰 프레임·강조·스크린샷 헬퍼) |
| `lib/actions.mjs` | 재사용 액션(노트 생성, 워크플로/유닛 오퍼레이션 추가, 트리·컨텍스트 메뉴 조작 등) |
| `lib/highlight.js` | 클릭 지점 강조 오버레이(테두리 + 번호 배지) 주입 |
| `scenarios/ch1..ch7-*.mjs` | 챕터별 캡처 시나리오 |
| `scenarios/all.mjs` | 전체 챕터 순차 실행 |
| `set-clipboard-image.ps1` | 이미지 붙여넣기 자동화용 데모 이미지를 Windows 클립보드에 올림 |
| `export-pdf.mjs` | HTML → 한/영 PDF 변환 |
| `demo-workspace/` | 캡처용 예제 워크스페이스(실행 시 `labnote/` 초기화) |

## 수동 캡처

자동화로 커버할 수 없는 장면(예: 파일 첨부의 OS 네이티브 다이얼로그, `ch6-step2.png`)은 `docs/manual/CAPTURE.ko.md`의 수동 캡처 가이드를 따르세요. 매뉴얼 페이지는 해당 이미지가 없으면 "캡처 예정" 플레이스홀더를 표시하므로 페이지가 깨지지 않습니다.
