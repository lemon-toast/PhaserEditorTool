<script setup lang="ts">
import { computed } from 'vue';
import { parentOf, type Transform } from '../core/document';
import { moveParent, patchNode, selected, state, selectedIds } from '../editor/store';
import { gameExportStatus, nodeGameSupport } from '../integration/gameSupport';
import AssetReferenceEditor from './AssetReferenceEditor.vue';
const gameStatus = computed(() => gameExportStatus(state.doc));
const nodeSupport = computed(() => nodeGameSupport(state.doc, state.selected));
const parents = computed(() =>
  Object.values(state.doc.nodes).filter((n) => n.kind === 'group' && n.id !== state.selected),
);
const asset = computed(() =>
  state.assets.find((a) => a.file === selected.value?.asset && a.kind === selected.value?.kind),
);
const fields: { key: keyof Transform; label: string; step: number }[] = [
  { key: 'x', label: '위치 X', step: 1 },
  { key: 'y', label: '위치 Y', step: 1 },
  { key: 'scaleX', label: '배율 X', step: 0.05 },
  { key: 'scaleY', label: '배율 Y', step: 0.05 },
  { key: 'rotation', label: '회전 °', step: 1 },
  { key: 'alpha', label: '투명도', step: 0.05 },
];
function number(event: Event) {
  return Number((event.target as HTMLInputElement).value);
}
</script>
<template>
  <div class="panel inspector" v-if="selected">
    <p v-if="selectedIds.length > 1" class="hint">
      {{ selectedIds.length }}개 선택 중 · 아래 속성과 복제·삭제는 마지막 선택 객체에 적용됩니다.
      함께 이동하려면 화면에서 드래그하세요.
    </p>
    <div class="node-heading">
      <span class="badge">{{ selected.kind }}</span
      ><strong>{{ selected.name }}</strong>
    </div>
    <section class="game-support" aria-label="게임 적용 범위" aria-live="polite">
      <h3>{{ nodeSupport.title }}</h3>
      <p>{{ nodeSupport.supported }}</p>
      <p class="hint">{{ nodeSupport.limited }}</p>
      <strong>{{
        gameStatus.ready ? '현재 화면: 내보내기 가능' : '현재 화면: 게임 적용 제한'
      }}</strong>
      <p>{{ gameStatus.message }}</p>
      <p class="hint">
        현재 배치 모드의 내보내기 검증 결과입니다. 게임 저장·실행 확인은 별도입니다. 장면 JSON
        저장은 계속 사용할 수 있습니다.
      </p>
    </section>
    <label
      >이름<input
        aria-label="노드 이름"
        :value="selected.name"
        @change="
          patchNode(state.selected, (n) => (n.name = ($event.target as HTMLInputElement).value))
        "
    /></label>
    <label
      >부모<select
        aria-label="부모 노드"
        :value="parentOf(state.doc, state.selected) || ''"
        @change="moveParent(($event.target as HTMLSelectElement).value)"
      >
        <option value="">장면 루트</option>
        <option v-for="n in parents" :value="n.id" :key="n.id">{{ n.name }}</option>
      </select></label
    >
    <h3>Transform</h3>
    <div class="field-grid">
      <label v-for="f in fields" :key="f.key"
        >{{ f.label
        }}<input
          :aria-label="f.label"
          type="number"
          :step="f.step"
          :value="selected.transform[f.key]"
          @change="patchNode(state.selected, (n) => (n.transform[f.key] = number($event)))"
      /></label>
    </div>
    <template v-if="selected.kind === 'image' || selected.kind === 'text'"
      ><h3>표시</h3>
      <div class="field-grid">
        <label
          >너비<input
            aria-label="너비"
            type="number"
            min="1"
            :value="selected.width"
            @change="patchNode(state.selected, (n) => (n.width = number($event)))" /></label
        ><label
          >{{ selected.kind === 'text' ? '글자 크기' : '높이'
          }}<input
            aria-label="높이"
            type="number"
            min="1"
            :value="selected.height"
            @change="patchNode(state.selected, (n) => (n.height = number($event)))" /></label
        ><label
          >원점 X<input
            type="number"
            step=".1"
            :value="selected.originX"
            @change="patchNode(state.selected, (n) => (n.originX = number($event)))" /></label
        ><label
          >원점 Y<input
            type="number"
            step=".1"
            :value="selected.originY"
            @change="patchNode(state.selected, (n) => (n.originY = number($event)))"
        /></label>
      </div>
      <label
        >색상<input
          type="color"
          :value="selected.color"
          @change="
            patchNode(state.selected, (n) => (n.color = ($event.target as HTMLInputElement).value))
          " /></label
    ></template>
    <label v-if="selected.kind === 'text'"
      >텍스트<input
        aria-label="텍스트"
        :value="selected.text"
        @change="
          patchNode(state.selected, (n) => (n.text = ($event.target as HTMLInputElement).value))
        "
    /></label>
    <template v-if="selected.kind === 'spine'"
      ><h3>Spine 재생</h3>
      <label
        >애니메이션<select
          aria-label="Spine 애니메이션"
          :value="selected.animation"
          @change="
            patchNode(
              state.selected,
              (n) => (n.animation = ($event.target as HTMLSelectElement).value),
            )
          "
        >
          <option value="">첫 애니메이션</option>
          <option v-for="a in asset?.animations" :key="a">{{ a }}</option>
        </select></label
      ><label
        >스킨<select
          aria-label="Spine 스킨"
          :value="selected.skin"
          @change="
            patchNode(state.selected, (n) => (n.skin = ($event.target as HTMLSelectElement).value))
          "
        >
          <option value="">기본 스킨</option>
          <option v-for="s in asset?.skins" :key="s">{{ s }}</option>
        </select></label
      ><label class="inline"
        ><input
          type="checkbox"
          :checked="selected.loop"
          @change="
            patchNode(state.selected, (n) => (n.loop = ($event.target as HTMLInputElement).checked))
          "
        />반복 재생</label
      >
      <p class="hint">런타임 4.3 · 에셋 {{ asset?.version || '미확인' }}</p></template
    >
    <template v-if="selected.kind === 'particle'"
      ><h3>파티클 방출</h3>
      <div class="field-grid">
        <label
          v-for="(label, key) in {
            frequency: '간격 ms',
            quantity: '방출 수',
            lifespan: '수명 ms',
            speed: '속도',
            gravity: '중력',
            scale: '입자 배율',
          }"
          :key="key"
          >{{ label
          }}<input
            :aria-label="label"
            type="number"
            :step="key === 'scale' ? 0.05 : 1"
            :value="selected.particle[key]"
            @change="patchNode(state.selected, (n) => (n.particle[key] = number($event)))"
        /></label>
      </div>
      <p class="hint">노드당 최대 500개 · 비활성 시 기존 입자 제거</p></template
    >
    <AssetReferenceEditor />
    <template v-if="selected.asset"
      ><h3>에셋 참조</h3>
      <p class="asset-path">{{ selected.asset }}</p></template
    >
    <p class="hint" v-if="state.timeline">
      속성을 변경하면 연출을 정지하고 기본 배치를 편집합니다.
    </p>
  </div>
  <div class="empty panel" v-else>계층 또는 화면에서 노드를 선택하세요.</div>
</template>
<style scoped>
.game-support {
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 10px;
  margin: 10px 0;
  overflow-wrap: anywhere;
}
.game-support h3 {
  margin-top: 0;
}
.game-support p {
  line-height: 1.5;
}
</style>
