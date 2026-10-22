# 프로젝트 작업 규칙

- 사용자에게 보내는 설명·진행 보고·최종 답변은 한글로 작성합니다.
- 커밋 제목과 본문도 한글로 작성합니다. 예: `기능: 도킹 패널과 화면 미리보기 추가`.
- 구현 전에 `README.md`, `docs/REQUIREMENTS.md`, `docs/IMPLEMENTATION_STATUS.md`를 읽고 현재 범위를 확인합니다.
- 구현·검증 완료와 설계만 된 기능을 구분합니다. 실제 게임 역적용, 별도 OS 창, macOS 검증을 확인 없이 완료 처리하지 않습니다.
- 이웃 게임 프로젝트와 에셋은 읽기 전용 연동 대상으로 취급하고 요청 범위 없이 수정하거나 복사하지 않습니다.
- 장면 원본과 재생 중 임시 상태, 사용자 워크스페이스와 게임 export를 구분합니다.
- 변경에 맞는 `npm run typecheck`, `npm test`, `npm run test:browser`, `npm run build` 검증을 수행합니다. 브라우저 테스트의 SlotClient·Chrome 요구는 구현 현황 문서를 따릅니다.
