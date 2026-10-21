# SlotClient 연동 조사

조사일: 2026-10-21 (Asia/Seoul)

이 문서는 로컬 `D:\WorkSpace\SlotClient`의 코드 일부를 읽은 결과입니다. 전체 게임 실행, 렌더링 호환성 검증, 파티클 구성의 전체 조사는 아직 수행하지 않았습니다. 이 저장소에는 원본 코드나 에셋을 복사하지 않았습니다.

## 확인한 기술 구성

`package.json` 선언 기준입니다. 실제 설치·에셋 버전의 호환성은 구현 시 확인해야 합니다.

| 항목 | 선언 |
| --- | --- |
| UI | Vue `^3.5.13` |
| 렌더러 | Phaser `^3.90.0` |
| Spine | `@esotericsoftware/spine-phaser-v3` `~4.3.13` |
| 개발 서버 | Vite `^6.3.5` |
| 언어 | TypeScript `~5.8.3` |

## 주요 파일

경로는 SlotClient 루트 기준입니다.

| 경로 | 확인 내용 |
| --- | --- |
| `src/config/layout.ts` | 기본 가로 1920×1080, 세로 1080×1920 |
| `src/game/layout/layoutTypes.ts` | 이미지·Spine·HUD·팝업 등 타입 정의 |
| `src/game/layout/orientation.ts` | 방향별 context, letterbox/expand 화면 좌표 계산 |
| `src/game/layout/LayoutManager.ts` | 방향별 layout 함수 평가 및 캐시 |
| `src/game/layout/landscapeLayout.ts` | `w/h` 계산을 포함한 기본 layout 함수 |
| `src/game/spineArt.ts` | Spine JSON·atlas 페이지 로드와 객체 생성, 애니메이션 선택 도우미 |
| `src/game/assets.ts` | 게임별 manifest, 이미지 URL, Spine atlas와 skeleton 탐색 |
| `games/SLOT_1002/layout/landscape.ts` | 기본 layout과 게임별 art/shared 데이터를 조합 |
| `games/SLOT_1002/layout/portrait.ts` | 세로 layout 모듈 존재 확인. 상세 내용은 후속 조사 |
| `games/SLOT_1002/layout/art.landscape.ts` | 배경·앞쪽 장식 이미지 배열과 배치 |
| `games/SLOT_1002/layout/shared.ts` | 공통 버튼·계기·배경 등의 설정 |
| `games/SLOT_1002/game.config.ts` | screenFit, 폰트, 기능 팝업·게임 연출 설정 |

## 기존 타입과 에디터 연결

| 기존 데이터 | 에디터 변환 방향 |
| --- | --- |
| `ArtImage` | image 노드. file, x/y, width/height, flip, opacity, tint, slice 반영 |
| `SpineArt`, `SpineBackground` | spine 노드. spine, x/y, scale, animation 반영 |
| `art.back`, `art.front` | 렌더 순서가 구분되는 group |
| `reelSpines` | spine 자식 노드. idle 선택과 flipX 반영 |
| `hud` | 버튼 그룹과 이미지·텍스트 자식. skinned UI의 합성 규칙 추가 조사 필요 |
| `loading`, `menu` | 별도 그룹과 프리셋. 좌표계·표시 조건 검증 필요 |
| `featureBackground`, `featureTitle` | 프리스핀 프리셋용 초기 비활성 노드 |
| `reels` | 릴 배치 영역 가이드와 샘플 심볼. 실제 릴 동작은 별도 |

이미지는 중심 좌표를 사용하고 Spine은 skeleton 원점을 사용합니다. 이 차이를 에디터에서 유지해야 합니다. 또한 데이터의 중첩이 반드시 렌더 부모 관계를 뜻하지는 않으므로, 모든 객체를 자동으로 계층화하지 않고 필드별 규칙으로 변환해야 합니다.

## 기존 코드 재사용의 주의점

- `assets.ts`는 Vite glob과 게임 전용 쿼리를 사용합니다. 그대로 import하면 에디터의 빌드 설정과 맞지 않을 수 있습니다. 로딩 규칙을 참고하여 에디터용 Asset Registry를 구성합니다.
- `game.config.ts`는 게임 presentation 모듈과 함수 콜백도 연결합니다. 화면 미리보기만을 위해 게임 설정 전체를 실행하지 않도록 import 경계를 조사합니다.
- layout 함수의 `w / 2`, `h - 105` 등 수식은 평가 후 숫자가 됩니다. 가져온 숫자만으로 원래 수식을 복원할 수 없습니다.
- 실제 게임은 배경·릴·전경·HUD 등 여러 Scene의 순서를 사용합니다. 에디터 그룹 순서로 대응시키고 실제 결과를 비교해야 합니다.
- `expand` 모드에서는 화면 여분에 따른 offset과 배경 처리 규칙이 있습니다. 고정 기준 해상도 미리보기와 실제 viewport 미리보기를 구분해야 합니다.
- Spine atlas 페이지 이름과 텍스처 key 규약을 맞춰야 합니다. 파일명이 같아도 경로가 다르면 별도 자원으로 취급합니다.

## 파티클 조사 상태

현재 조사에서는 독립적인 Phaser emitter 설정 파일이나 공통 파티클 layout 타입을 확인하지 못했습니다. 따라서 기존 파티클을 자동으로 가져올 수 있다고 가정하지 않습니다.

초기에는 에디터에서 Phaser particle 노드를 생성·편집하는 기능을 만들고, 프로젝트별 emitter 생성 코드와 설정을 추가 조사하여 변환 범위를 결정합니다. Spine 파일에 포함된 불꽃 등의 애니메이션은 Spine 미리보기로 확인하며 Phaser particle과 구분합니다.

## 제안하는 첫 연동 순서

1. 실제 이미지 한 장, SLOT_1002의 Spine 한 개와 신규 Phaser emitter로 렌더러 검증
2. `landscape(ctx)`의 순수 평가 가능 여부 검증
3. background → art.back → 샘플 릴 → art.front → reelSpines → HUD 순으로 화면 구성
4. 메뉴·로딩·프리스핀을 초기 비활성 그룹으로 추가
5. 가로·세로, 일반·프리스핀을 실제 게임과 비교
6. 저장한 에디터 문서의 재현성 확인 후 공통 장면·연출 규격과 실제 게임 import/export 구현·검증

지정 복합 연출은 presentation 코드의 실행 경계를 추가 조사하여 공유 모듈 또는 등록 코드 어댑터로 연결합니다. 조사한 `game.config.ts`에는 presentation 모듈 연결이 있지만, 그것만으로 기존 연출의 시점 이동과 export 적용이 지원되는 것은 아닙니다. 게임 layout·resize·연출이 같은 Transform을 덮어쓰는 지점을 확인해야 합니다.

홀덤·맞고는 대상 경로와 layout 구조를 확인한 뒤 같은 문서 모델을 소비하는 별도 어댑터로 연결합니다.
