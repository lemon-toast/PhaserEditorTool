# 슬롯 게임 역적용

기준일: 2026-10-22. 최초 역적용 범위는 **SlotClient / SLOT_1002의 장식 이미지와 Spine 배치**입니다. 연출 트랙과 모든 게임 UI의 역적용까지 완료한 상태는 아닙니다.

## 프로젝트 구분

| 프로젝트 | 역할 | 현재 작업 |
| --- | --- | --- |
| SlotClient | 슬롯 게임 | 선택적인 게임용 layout import 연결 설치 및 실제 게임 검증 |
| TemplateWebGame/GameClient | 홀덤·맞고 | orientation layout과 승리 이벤트 구조 조사. 파일 수정 없음 |
| PhaserEditorTool | 화면·연출 에디터 | 게임 패키지 export, 적용 파일 저장, 재import 및 공통 적용 런타임 |

홀덤은 가로·세로 layout을 공통 OrientationLayout으로 선택하고, 맞고는 PC/모바일 구분으로 layout을 선택합니다. 게임마다 방향·디바이스 축과 이벤트 처리 방식이 다르므로 같은 좌표 파일로 취급하지 않습니다. 홀덤 승리 이벤트는 `scenes_holdem/game/socketHandlers/onResultWin.ts`에서 Winner·머니 갱신 등을 호출하며 추후 코드 연출 어댑터 조사 대상으로 남깁니다.

## 연결 설치

에디터 저장소에서 실행합니다. 기본 대상은 이웃 `SlotClient` 폴더입니다.

```sh
npm run connect:slot
# 경로를 직접 지정하는 경우
node scripts/install-slot-bridge.mjs D:/WorkSpace/SlotClient
```

이 명령은 SlotClient의 다음 파일에 선택적인 데이터 연결과 렌더 속성 지원을 추가합니다.

- `src/config/gameConfig.ts`: 방향별 게임 패키지를 기본 layout 평가 뒤에 적용
- `src/game/layout/editorRuntime.ts`: 에디터와 같은 적용 런타임을 자동 배포
- `src/game/layout/layoutTypes.ts`: 이미지 회전·원점, Spine 비균등 배율·투명도·skin·loop 타입 확장
- `src/game/artImage.ts`, `spineArt.ts`, `BackgroundScene.ts`, `ForegroundScene.ts`: 확장 속성 렌더링과 게임 상태 alpha 곱셈
- `src/game/createSlotGame.ts`: 개발 전용 `editorInspect=1`에서 브라우저 검증용 게임 참조 제공

원본 게임별 layout·에셋은 재작성하지 않습니다. 설치 스크립트는 기존 코드 패턴을 확인하고 예상과 다르면 파일 쓰기 전에 중단합니다. 이미 설치된 연결은 재설치할 수 있습니다. 공통 런타임은 `src/integration/slotRuntime.ts`가 원본이며 이 파일을 수정했다면 재설치해야 합니다. SlotClient는 실행·빌드 시 에디터 저장소에 의존하지 않습니다.

## 편집과 적용

1. **슬롯 배치**로 기본 layout을 새로 가져옵니다. 예전에 저장한 출처 없는 문서는 게임 적용을 지원하지 않습니다.
2. 가로·세로 중 작업할 방향을 고릅니다. 방향을 바꿨다면 다시 **슬롯 배치**로 해당 방향의 원본을 가져옵니다.
3. 지원되는 이미지·Spine의 위치·배율·회전·투명도 등을 편집합니다.
4. **게임용 내보내기**로 `editor.landscape.json` 또는 `editor.portrait.json`을 다운로드하거나, **슬롯에 적용**으로 연결된 게임에 직접 저장합니다.
5. 실제 게임을 새로고침합니다. 개발 서버에서는 변경으로 전체 새로고침이 일어날 수 있습니다. 배포본에는 해당 파일을 포함하여 게임을 다시 빌드해야 합니다.
6. **게임 적용본**으로 저장된 게임 파일의 편집 문서를 다시 가져옵니다. 파일 선택을 통한 가져오기도 가능합니다.

저장 경로는 `SlotClient/games/SLOT_1002/layout/editor.<방향>.json`으로 고정합니다. 임의 경로를 요청으로 받지 않습니다. 직접 적용 API는 같은 origin의 에디터 요청만 처리하며, 패키지와 현재 원본 layout을 검증한 뒤 임시 파일을 교체합니다. 기존 파일은 `.json.bak`으로 보관합니다. 게임 데이터를 제거하면 기본 layout으로 돌아갑니다.

**저장 / 내보내기**의 `.scene.json`은 편집 문서입니다. **게임용 내보내기**는 게임 적용 계약을 검증한 별도 형식입니다. 미지원 수정은 오류로 표시하며 부분 적용을 성공처럼 처리하지 않습니다.

## 지원 범위

| 대상 | 지원 |
| --- | --- |
| `art.back`, `art.front` 이미지 | 위치·크기·배율·뒤집기·회전·원점·tint·투명도, 활성 → 비활성 변경 |
| 기본·프리스핀 배경, 캐릭터, 릴 Spine | 위치·배율 X/Y·회전·투명도·animation·skin·loop, 활성 → 비활성 변경 |
| 기존 그룹의 Transform·alpha | 자식의 월드 Transform·alpha로 합산. shear가 필요하면 거부 |
| 출처·계층·트랙을 포함한 편집 문서 | 게임 파일에 편집 snapshot 포함, 재import 가능 |

기존 게임의 featureTitle 숨김, 프리스핀 배경 전환, 릴 사라짐과 캐릭터 fade는 게임 상태가 계속 제어합니다. 기본 프리셋의 숨김 값을 게임의 영구 비활성으로 해석하지 않습니다. 숨김 프리셋을 강제로 켜는 수정은 현재 거부합니다. Spine opacity는 기존 게임 fade와 곱해지도록 연결했습니다.

현재 미지원: HUD·로딩·샘플 릴 수정, 새 노드 추가·삭제·부모/형제 순서 변경, 에셋·9-slice 교체, 일반 사용자 장면, 파티클·연출 트랙의 게임 실행 연결. 이 수정이 있으면 게임 내보내기를 거부하고 대상 이름을 표시합니다. 일반 장면 저장 기능은 그대로 사용할 수 있습니다.

## 데이터 계약과 원본 보호

게임 파일은 `format: phaser-editor/slot-layout`, `version: 1`, 게임 코드, 방향, 해상도, 원본 fingerprint, 변경된 바인딩 목록과 편집 문서를 포함합니다. 기본 Transform 위에 현재 재생 커서의 값을 저장하지 않습니다.

적용 함수는 원본 layout을 변경하지 않고 바뀐 경로만 복사합니다. 원본의 함수 콜백도 유지합니다. 부모 Transform을 합산한 이미지·Spine 값을 기존 layout 좌표로 적용하므로 게임의 화면 offset/resize 처리 앞에 일관된 기준 좌표가 유지됩니다.

현재 바인딩 ID에는 원본 배열 경로가 포함됩니다. 따라서 전체 원본 출력의 fingerprint와 에셋 식별자를 함께 검사하여 배열이 바뀌었을 때 다른 요소에 적용되는 것을 막습니다. fingerprint는 실수로 오래된 원본에 적용하는 것을 탐지하는 용도이며 보안 서명은 아닙니다. 원본 변경 시 다시 가져와 재작업해야 하며 자동 병합은 아직 지원하지 않습니다.

버전·게임·방향·해상도·원본·에셋 바인딩이 다르면 적용 전에 거부합니다. 실제 게임은 오류를 콘솔에 한 번 알리고 기본 layout으로 돌아갑니다. 모든 patch를 검증한 뒤 복사 적용하므로 원본이나 일부 노드만 손상시키지 않습니다.

## 검증

```sh
npm run connect:slot
npm test
npm run test:browser
npm run build
```

브라우저 테스트는 에디터(5173)와 실제 SlotClient 개발 서버(5174)를 실행합니다. Chrome과 이웃 SlotClient의 설치된 의존성이 필요합니다. 실제 게임은 `?mock=1&gameId=1002`로 서버 없이 검증합니다.

실제 게임 검수는 에디터에서 이미지 위치·회전과 캐릭터 Spine 위치·회전·opacity·loop를 변경하여 저장한 뒤 실제 Phaser 객체를 조회합니다. resize와 방향 전환에서 값 유지·방향 분리를 확인하고, 저장 파일을 에디터로 재import합니다. 테스트는 자신이 변경한 게임 적용 파일과 백업만 원상 복원합니다. 게임의 플레이·결과 서버 코드는 변경하지 않습니다.
