# PhaserEditorTool

Phaser 게임의 화면 배치를 눈으로 확인하고 편집하는 로컬 개발 도구입니다.

SlotClient와 홀덤·맞고 게임을 개발할 때, 좌표 코드를 수정하고 게임을 실행해야만 결과를 알 수 있는 불편을 줄이는 것이 목적입니다. Unity처럼 **계층 목록 → 화면 미리보기 → 속성 수정** 흐름을 제공합니다.

## 현재 상태

- GitHub: [lemon-toast/PhaserEditorTool](https://github.com/lemon-toast/PhaserEditorTool)
- 단계: 요구사항 및 설계 문서 작성
- 실행 가능한 에디터와 게임 연동 코드는 아직 구현하지 않았습니다.
- 최초 연동 대상으로 SlotClient를 검토했습니다. 홀덤·맞고는 실제 프로젝트 구조 확인 후 연결합니다.

## 1차 목표

- 이미지, Spine, Phaser 파티클을 같은 화면에서 확인
- 부모·자식 계층 표시와 노드별 active on/off
- 부모 비활성화가 모든 자식에 반영되는 미리보기
- 화면에서 선택·이동하고 Inspector에서 위치·크기·배율 수정
- Spine 애니메이션 선택·재생·일시정지, 파티클 재생·정지·재시작
- 가로·세로 화면 전환 및 배치 저장·불러오기
- 폭죽·팝업·획득 머니 이동 등을 묶은 이벤트 연출 선택·미리보기
- Transform·애니메이션 데이터 import/export와 실제 게임 적용 검증
- 게임 서버에 접속하지 않고 화면 작업

## 문서

| 문서 | 내용 |
| --- | --- |
| [요구사항](docs/REQUIREMENTS.md) | 사용자 흐름, MVP 범위, active 규칙, 완료 기준 |
| [설계](docs/ARCHITECTURE.md) | 에디터 구조, 장면 데이터, 게임 연결, 저장 정책 |
| [개발 순서](docs/ROADMAP.md) | 단계별 작업과 검증 항목 |
| [SlotClient 조사](docs/SLOTCLIENT_INTEGRATION.md) | 실제 코드에서 확인한 구조와 연동 시 확인할 사항 |
| [연출 및 게임 교환 규격](docs/ANIMATION_AND_INTERCHANGE.md) | 복합 연출, 공통 실행 코드, import/export와 게임 적용 계약 |

## 기본 원칙

1. Phaser 기반 미리보기로 실제 게임과의 차이를 줄입니다.
2. 게임 로직 실행 없이 시각 요소를 확인할 수 있어야 합니다.
3. 편집 문서와 게임용 export를 구분합니다. Transform·연출 데이터는 게임과 공통 규격을 사용하고 실제 게임 적용까지 검증합니다. 기존 소스·에셋의 자동 재작성은 하지 않습니다.
4. 파티클은 우선 Phaser emitter를 지원합니다. 다른 엔진의 파티클 데이터 변환은 별도 범위입니다.
5. 여러 게임은 각 프로젝트의 layout과 에셋을 공통 장면 데이터로 바꾸는 어댑터로 연결합니다.
6. Windows와 macOS에서 실행할 수 있도록 TypeScript·Vue·Phaser 기반으로 설계합니다. 프로젝트 경로는 설정으로 선택하고 공유 데이터에는 상대 경로를 사용합니다.
7. Timeline 형태나 코드로 작성한 연출 모두 명시적인 연결 규약을 통해 미리봅니다. 시각적 Timeline 제작 UI는 별도 확장입니다.

작성일: 2026-10-21 (Asia/Seoul)
