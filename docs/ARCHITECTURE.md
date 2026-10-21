# 초기 설계안

이 문서는 구현 방향이며 구현 완료를 의미하지 않습니다. 외부 라이브러리의 최신 API 검증과 버전 확정은 구현 착수 시 수행합니다.

## 실행 구조

로컬 웹 앱으로 시작합니다. 편집 UI는 TypeScript와 Vue, Scene은 Phaser를 사용하는 방향입니다. Vite 개발 서버에 프로젝트 연결과 파일 저장을 위한 로컬 API를 둡니다. Electron 패키징은 필요성이 확인된 뒤 검토합니다.

```text
Hierarchy / Inspector / Assets / Toolbar
                  |
           Document Store
   SceneDocument + 편집 명령 + Undo/Redo
           |                  |
    Preview Bridge       Import / Export
           |                  |
  Phaser + Spine        Project Adapter
           |                  |
  장면·선택·드래그       layout / assets / JSON
```

Document Store를 장면의 기준 데이터로 삼습니다. Phaser 객체의 상태를 저장 데이터로 직접 쓰지 않습니다. 재생 시각·현재 입자 등 런타임 상태도 별도로 유지합니다.

## 구성 요소

| 구성 | 책임 |
| --- | --- |
| Editor Shell | 패널, 툴바, 단축키, 오류 표시 |
| Document Store | 문서 검증, 선택, 편집 명령, 변경 여부, 실행 취소 |
| Hierarchy Service | 부모 변경, 순서, active 계산, 변환 계산 |
| Preview Bridge | 노드 ID와 Phaser 객체 연결, 변경분 반영, hit test, 재생 제어 |
| Asset Registry | 상대 경로 해석, 이미지·Spine 목록, 로딩·오류·해제 관리 |
| Project Adapter | 게임의 layout을 공통 문서로 변환, 출처와 미지원 항목 기록 |
| Local Project Service | 등록한 프로젝트 내 파일 조회 및 에디터 문서 저장 |
| Animation Runtime | 공통 clock, 연출 트랙·등록 코드 실행, reset·cancel·재생 상태 관리. 게임과 공유 |
| Game Interchange | 게임용 export/import 검증, 버전·ID·타깃·지원 기능 확인, 게임 적용 어댑터 |

## 장면 데이터

아래는 데이터 모델의 초안입니다. 구체적인 타입은 첫 구현에서 확정합니다.

```ts
type NodeKind = 'group' | 'image' | 'spine' | 'particle' | 'text';

interface SceneDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  source?: {
    adapter: string;
    game: string;
    layout: string;
    orientation: 'landscape' | 'portrait';
  };
  designSize: { width: number; height: number };
  roots: string[]; // 앞에서 뒤로 그리는 순서
  nodes: Record<string, SceneNode>;
  presets: Record<string, Record<string, boolean>>; // nodeId → activeSelf
}

interface NodeBase {
  id: string;
  name: string;
  children: string[];
  activeSelf: boolean;
  transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number; // 저장은 도(degree), 렌더러 경계에서 변환
    alpha: number;
  };
  sourcePath?: string; // 예: art.front[0], 원본 추적용
}

type SceneNode = NodeBase & (
  | { kind: 'group' }
  | { kind: 'image'; image: ImageProperties }
  | { kind: 'spine'; spine: SpineProperties }
  | { kind: 'particle'; particle: ParticleProperties }
  | { kind: 'text'; text: TextProperties }
);
// 타입별 Properties는 요구사항에 맞춰 정의합니다.
```

부모 ID는 roots와 children에서 역색인을 만들어 계산합니다. 중복 부모와 순환 참조를 검증하여 두 종류의 부모 정보가 어긋나는 문제를 피합니다. activeInHierarchy는 저장하지 않고 조상에서 계산합니다.

그룹은 좌상단 원점, 이미지는 기본 중앙 origin, Spine은 skeleton 원점을 사용합니다. 노드 좌표는 부모 기준이며 최상위는 designSize 좌표입니다. 이미지 origin은 별도 속성입니다. 에디터 표시 배율은 실제 저장 좌표에 반영하지 않습니다.

## 렌더링과 변환

- 문서 변경 시 해당 노드와 영향을 받는 자손만 갱신합니다. 위치 수정 때문에 에셋을 다시 로드하지 않습니다.
- 시작 시 Phaser Container의 Spine·particle 동시 지원, 부모 변환, alpha, 그리기 순서, bounds와 hit test를 검증합니다.
- 호환성이 부족하면 문서 계층은 유지하고 Preview Bridge가 월드 변환을 계산하여 개별 객체에 적용합니다.
- 부모 변경 시 이전 월드 행렬과 새 부모 역행렬로 로컬 변환을 계산합니다. 비균등 배율과 회전 조합으로 shear가 필요해지거나 부모 배율이 0이면 정확한 보존이 불가능할 수 있으므로 조용히 왜곡하지 않고 거부합니다.
- 장면 순서는 문서 트리 순서로 계산합니다. 원본 게임의 여러 Scene 사이 깊이 관계는 어댑터에서 명시적인 그룹 순서로 바꿉니다.
- 선택 테두리·그리드·오류 표식은 편집 전용 오버레이로 렌더링합니다.
- Spine 선택 범위는 애니메이션 중에도 안정적인 기준을 사용하고 필요 시 원점 핸들로 선택합니다.

## active와 재생 상태

`activeSelf → activeInHierarchy → Preview Bridge` 순서로 적용합니다. Phaser의 visible·active 플래그만 바꾸고 끝내지 않으며 Spine 갱신과 emitter 갱신도 해당 타입의 제어 API로 중단해야 합니다.

Spine은 비활성화 시 진행 시각을 보존합니다. 파티클은 비활성화 시 기존 입자를 제거하고 활성화 시 다시 시작합니다. 전역 일시정지는 활성 노드의 시간을 동결하며 문서를 변경하지 않습니다. 정지·재시작·문서 열기 시의 재생 상태는 타입별로 검증합니다.

## 프로젝트 연결

- 초기 대상 경로: 이 저장소 옆의 SlotClient. 개발자 환경에 따라 설정으로 변경 가능하게 합니다.
- 로컬 절대 경로는 개인 설정에만 저장하고 공유 장면에는 프로젝트 식별자와 상대 경로를 저장합니다.
- 이미지, Spine skeleton, atlas, atlas 페이지 파일을 묶음으로 해석합니다.
- 에셋 key에 프로젝트와 경로를 포함해 같은 파일명 충돌을 방지합니다.
- 장면 전환 중 비동기 로딩이 늦게 끝나면 이전 문서의 객체를 추가하지 않도록 세대 ID를 검사합니다.
- 참조가 없어진 텍스처·Spine 자원·emitter는 수명주기에 맞춰 해제합니다.

## layout 가져오기

SlotClient의 layout은 TypeScript 함수입니다. 임의 파일을 문자열로 파싱하거나 브라우저에서 eval하지 않습니다. 알려진 프로젝트의 layout 모듈을 전용 어댑터에서 import하고 기준 해상도 context로 평가하는 방식을 우선 검토합니다.

함수 평가 결과 중 화면에 필요한 값만 장면 문서로 정규화합니다. 함수 콜백은 JSON에 넣지 않습니다. 게임 부팅·네트워크 초기화가 따라오는 import는 분리하거나 피합니다. 수식은 결과 좌표로 가져오되 sourcePath와 출처를 남깁니다.

가져오기에서 빠진 항목은 명시적으로 보고합니다. 같은 파일의 모든 x/y 객체를 재귀 탐색해 무조건 그리는 방식은 사용하지 않습니다. 메뉴·로딩·게임 UI의 좌표계와 초기 활성 상태가 서로 다르기 때문입니다.

## 연출 실행과 공통 데이터

지정 이벤트 연출 미리보기와 실제 게임 적용은 필수 범위입니다. [연출 및 게임 교환 규격](ANIMATION_AND_INTERCHANGE.md)에 따라 장면·연출의 공통 데이터와 실행 모듈을 게임과 공유합니다. 에디터는 서버 대신 테스트 context를 주입하며 실제 게임은 서버 결과와 게임 context를 주입합니다.

SceneDocument에는 공통 모델로 정의한 연출 목록과 context 기본값을 포함합니다. 게임 export는 편집 UI 상태를 제외하고 검증된 장면·연출 데이터만 포함합니다. 등록 코드의 구현은 JSON에 포함하지 않으며 등록 ID와 버전을 검증합니다. 공통 clock 밖의 timer·tween은 어댑터에서 관리하지 않으면 시점 이동을 지원한다고 표시할 수 없습니다.

## 저장과 게임 반영

1. 첫 저장 형식은 에디터 전용 `.scene.json`입니다.
2. 저장 전 스키마·참조·숫자·에셋 경로를 검증합니다.
3. 임시 파일에 쓰고 성공 시 교체하여 쓰기 실패로 기존 문서가 손상될 가능성을 줄입니다.
4. 변경된 문서는 전환 전에 저장·폐기·취소를 선택하게 합니다.
5. 원본 layout 재가져오기는 현재 편집을 덮을 수 있으므로 명시적 작업으로 제공합니다.
6. 게임 반영은 필수 단계입니다. stable node ID 기반 공통 장면·연출 데이터를 export하고 게임 어댑터가 import·적용합니다. sourcePath는 원본 추적에 사용하며 배열 인덱스만으로 ID를 정하지 않습니다.
7. 게임이 override를 소비하는 코드와 실제 반영 검증 전에는 '게임 적용 완료'로 표시하지 않습니다.

TypeScript 원본에 수식을 유지하며 재작성하는 기능은 MVP 범위 밖입니다. 에디터에 보이는 현재 좌표를 원본 수식 대신 덮어쓰지 않습니다.

게임 적용은 기본 layout 평가 후 공통 데이터 적용, 그 위에 런타임 연출 적용 순서입니다. resize·방향 전환 시에도 이 순서로 다시 계산합니다. 같은 속성을 두 시스템이 동시에 제어하지 않도록 소유권을 명시합니다. 세부 필드와 어댑터 적용 가능 여부를 검증하고 미지원 항목이 있으면 부분 성공을 전체 성공처럼 표시하지 않습니다.

## 로컬 API 경계

로컬 API는 loopback에만 바인딩하고, 등록한 프로젝트 루트와 문서 저장 디렉터리만 허용합니다. 경로 정규화 후 `..`, 절대 경로, 심볼릭 링크를 통한 루트 이탈을 검사합니다. 요청 본문 크기와 노드·입자 수에 제한을 둡니다. 외부 origin의 쓰기 요청은 허용하지 않습니다.

## 초기 검증이 필요한 기술 항목

| 항목 | 판단 기준 |
| --- | --- |
| Spine runtime | 실제 SlotClient 에셋의 skeleton 버전과 로드·재생 호환 |
| Phaser 계층 | 이미지·Spine·particle의 동일 부모 변환 및 active 동작 |
| 9-slice | 현재 게임의 slice와 sliceScale 결과 비교 |
| 화면 맞춤 | letterbox/expand와 가로·세로 offset 비교 |
| layout import | 서버·게임 부팅 부작용 없는 모듈 분리 |
| 입자 수 | 제한 적용 시 UI 응답성과 오류 회복 |

의존성은 검증 후 고정하고 lockfile을 관리합니다. 문서 단계에서는 패키지를 설치하지 않습니다.
