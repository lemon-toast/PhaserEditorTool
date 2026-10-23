import type { SceneDocument } from '../core/document';
import { exportSlotDocument } from './exportSlot';
import { bindingPath } from './slotRuntime';

// 내보내기와 같은 검증을 사용합니다. 파일 저장·게임 실행 성공을 뜻하지 않습니다.
export function gameExportStatus(doc: SceneDocument) {
  try {
    const pack = exportSlotDocument(doc);
    return { ready: true, message: `게임용 내보내기 가능 · 변경 ${pack.patches.length}개` };
  } catch (error) {
    return { ready: false, message: (error as Error).message };
  }
}

export function nodeGameSupport(doc: SceneDocument, id: string) {
  const node = doc.nodes[id];
  const source = doc.source;
  if (
    !source ||
    source.adapter !== 'slot-client' ||
    source.gameCode !== 'SLOT_1002' ||
    !source.baseline
  )
    return {
      title: '장면 저장 전용',
      supported: '현재 화면은 게임 적용 연결이 없습니다.',
      limited: '편집 내용은 장면 JSON으로 저장할 수 있습니다.',
    };
  if (!node || !source.baseline.nodes[id])
    return {
      title: '게임 적용 미지원',
      supported: '새 객체는 장면 JSON으로 저장할 수 있습니다.',
      limited: '노드 추가·삭제·계층 변경은 게임에 적용되지 않습니다.',
    };
  if (node.kind === 'group')
    return {
      title: '자식별 적용 범위 확인',
      supported: '그룹 변환은 자식의 최종 배치에 반영됩니다.',
      limited:
        'HUD 등 미지원 자식이 바뀌면 전체 내보내기가 제한됩니다. 부모·형제 순서 변경은 미지원입니다.',
    };
  try {
    bindingPath(id);
  } catch {
    return {
      title: '게임 적용 미지원',
      supported: '이 객체는 장면 안에서 편집·저장할 수 있습니다.',
      limited: '현재 게임 연결은 장식 이미지·배경·캐릭터·릴 Spine만 지원합니다.',
    };
  }
  if (node.kind !== 'image' && node.kind !== 'spine')
    return {
      title: '게임 적용 미지원',
      supported: '이 객체 종류는 장면 저장만 지원합니다.',
      limited: '텍스트·파티클의 게임 적용은 아직 지원하지 않습니다.',
    };
  return {
    title: '일부 속성 게임 적용 지원',
    supported:
      node.kind === 'image'
        ? '지원: 위치·배율·회전·투명도, 너비·높이·원점·색상'
        : '지원: 위치·배율·회전·투명도, 애니메이션·스킨·반복',
    limited:
      '제한: 에셋·9-slice 교체, 계층 변경, 연출 트랙은 미지원. 숨김 해제와 부모 변환은 현재 장면 검증 결과를 확인하세요. 이름은 편집용입니다.',
  };
}
