# 구현 현황

기준일: 2026-10-22. 개발 버전 0.1이며 전체 요구사항 완료를 의미하지 않습니다.

## 실행

```sh
npm ci
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다. 현재 파일 API는 Vite 개발 서버에 연결되어 있으므로 전체 에셋 기능은 `npm run dev`로 실행합니다. `npm run preview`는 정적 빌드 확인용이며 프로젝트 파일 API를 제공하지 않습니다.

기본 에셋 연결은 이 저장소 옆 `SlotClient/games/SLOT_1002/assets`입니다. 에셋 패널의 **폴더 연결**에서 Windows 또는 macOS의 에셋 폴더 절대 경로를 입력할 수 있습니다. `SLOTCLIENT_ROOT` 환경 변수로 시작 경로를 바꿀 수도 있습니다. 에셋은 이 저장소에 복사하지 않습니다.

**슬롯 배치** 버튼은 내장 SLOT_1002 어댑터입니다. 지정된 이웃 프로젝트의 가로·세로 layout 모듈만 읽습니다. 다른 경로의 임의 TypeScript 코드를 실행하는 범용 import는 제공하지 않습니다.

## 구현하고 확인한 기능

- Vue·TypeScript·Phaser 기반 로컬 에디터
- 계층, 화면, 속성, 에셋, 연출/타임라인, 콘솔의 독립 도킹 패널
- Dockview 8.6.1(MIT)의 분할·탭·플로팅 기반, 패널 재열기·최대화·기본 배치
- 마지막 패널 배치 자동 저장, 이름 있는 배치 저장·불러오기. 브라우저 사용자 설정에 보관
- 부모·자식 계층, active 전파와 자식 체크값 보존, 펼침·접힘
- 노드 추가·삭제·복제·형제 순서 변경·부모 변경
- 부모 변경 시 월드 Transform 보존, 순환 관계·0 배율·표현 불가능한 shear 거부
- Inspector의 위치·배율·회전·투명도, 이미지 크기·origin·tint, 텍스트 편집
- 이미지·Spine·Phaser particle 동시 렌더링과 Scene 클릭·드래그·확대·화면 맞춤
- Spine 4.3 JSON+atlas+다중 페이지 로딩, 애니메이션·skin·반복 선택, active 시 갱신 제어
- 파티클 방출 설정, active 비활성 시 입자 제거, 재생·일시정지
- Transform 트랙 기반 승자승 예제, 전체 재생·정지·반복·배속·도착값 편집
- 시간 커서로 Transform 평가. 편집 원본을 변경하지 않는 평가 함수
- JSON 저장·불러오기, ID·계층·트랙 검증, 주요 편집 undo/redo
- 누락 에셋 자리표시자, 늦게 완료된 로딩의 오래된 장면 반영 방지
- SlotClient 실제 가로·세로 layout → 배경·장식·캐릭터·릴 Spine·HUD·로딩 그룹 변환
- SlotClient 9-slice 값 반영. 실제 게임과 모든 항목의 픽셀 단위 일치 검증은 아직 수행하지 않음

공통 툴바의 **저장 / 내보내기**는 현재 `.scene.json` 파일 다운로드입니다. 문서의 기본 배치와 트랙을 저장하며 중간 재생 위치·패널 배치를 넣지 않습니다. **가져오기**에서 같은 형식을 다시 열 수 있습니다. 문서 저장 전환과 닫기 시 미저장 변경을 확인합니다.

## 검증

```sh
npm run typecheck
npm test
npm run test:browser
npm run build
```

브라우저 테스트는 설치된 Chrome을 사용합니다. SlotClient 에셋을 사용하는 브라우저 검증은 해당 이웃 프로젝트가 있어야 통과합니다. 순수 데이터·파일 경로 테스트는 SlotClient 없이 실행할 수 있습니다.

자동 검증 항목:

- active 전파, 월드 변환 보존, 순환·shear 거부
- JSON 왕복, 잘못된 문서·트랙·경로 거부, 평가 시 원본 보존
- 한글·공백 에셋 경로, 프로젝트 밖 파일 접근 거부
- 실제 Chrome에서 계층 토글·숫자 편집·undo·JSON 다운로드/재import
- 실제 Spine·이미지 로딩, 플로팅·배치 저장·재시작 복원
- SlotClient 가로·세로 layout 렌더링과 브라우저 오류 검사

## 남은 필수 작업

1. Electron 등 데스크톱 호스트, 별도 OS 창·재도킹·다중 모니터·macOS 실기 검증
2. 게임용 규격·에디터 문서 구분, 실제 SlotClient 측 import 어댑터와 역적용 검증
3. 코드 연출 등록·공통 clock 연결, particle/Spine 이벤트 트랙과 정확한 seek·상태 복원
4. 폭죽·팝업·머니 이동을 게임 이벤트와 동일하게 실행하는 완전한 검수 예제
5. SlotClient 메뉴·기능 팝업·bitmap font·실제 릴 데이터·expand 좌표계·게임별 폰트 연결
6. 파티클 burst UI·전체 입자 수 제한, 에셋 참조 변경 UI와 상세 9-slice 편집
7. 홀덤·맞고 어댑터와 문서 버전 마이그레이션

특히 **현재 JSON을 export한 것만으로 실제 게임 적용을 완료했다고 보지 않습니다.** 시간 커서의 입자·Spine 상태는 아직 재시뮬레이션하지 않으며 UI에도 이 제한을 표시합니다. 별도 OS 창 기능도 현재 내부 플로팅과 구분하여 미완료로 관리합니다.

## 기술 참고

- [Dockview 패널 추가](https://dockview.dev/docs/core/panels/add/)
- [Dockview API](https://dockview.dev/docs/api/dockview/overview/)
- [Spine Phaser 공식 문서](https://en.esotericsoftware.com/spine-phaser)
- [Phaser particle 제어](https://docs.phaser.io/phaser/concepts/gameobjects/particles)
