# 디버깅 모드에서 파일 열기 테스트 가이드

## 테스트 절차

### 1. 디버깅 시작
- `F5` 키를 눌러 Extension Development Host 창을 엽니다

### 2. 테스트 파일 생성
Extension Development Host 창에서:
1. 워크스페이스 폴더 열기
2. `test.labnote.md` 파일 생성

### 3. 파일 열기 테스트

**방법 A: 파일 탐색기에서 더블클릭**
- 파일 탐색기에서 `test.labnote.md` 더블클릭
- ✅ 커스텀 에디터로 자동으로 열려야 함

**방법 B: 명령 팔레트 사용**
- `Ctrl+Shift+P` → "File: Open File" 선택
- `test.labnote.md` 선택
- ✅ 커스텀 에디터로 자동으로 열려야 함

**방법 C: 새 노트 명령 사용**
- `Ctrl+Shift+P` → "Lab Note: New Note" 입력
- 파일 이름 입력 (예: "my-test")
- ✅ 자동으로 커스텀 에디터로 열려야 함

### 4. 확인 사항
- [ ] 커스텀 에디터가 열렸는지 확인
- [ ] BlockNote 에디터가 표시되는지 확인
- [ ] 콘솔에 오류가 없는지 확인 (Help > Toggle Developer Tools)
