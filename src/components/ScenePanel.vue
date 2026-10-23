<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { createStage } from '../editor/Stage';
import { state, selectedIds, alignSelection } from '../editor/store';
import ScreenControls from './ScreenControls.vue';
const host = ref<HTMLElement>();
const viewZoom = ref(1);
const viewMessage = ref('');
let stage: ReturnType<typeof createStage> | undefined;
onMounted(() => {
  if (host.value)
    stage = createStage(host.value, (zoom) => {
      viewZoom.value = zoom;
      viewMessage.value = '';
    });
});
onBeforeUnmount(() => stage?.destroy());
function fitView() {
  if (!stage) return;
  stage.scene.fitToView();
  viewMessage.value = '화면 맞춤 완료';
}
</script>
<template>
  <div class="scene-panel">
    <div class="scene-tools">
      <span class="live-dot"></span
      ><span>PHASER · {{ state.doc.designSize.width }} × {{ state.doc.designSize.height }}</span
      ><span class="spacer"></span
      ><span class="scene-mode"
        >현재 모드: {{ state.timeline ? '연출 미리보기' : '배치 편집' }}</span
      >
      <span class="scene-zoom" title="화면 맞춤 상태를 100%로 한 보기 배율">
        {{ viewZoom === 1 ? '맞춤' : '확대/축소' }} {{ Math.round(viewZoom * 100) }}%
      </span>
      <button title="작업 화면 전체를 패널 중앙에 맞춥니다" @click="fitView">화면 맞춤</button>
    </div>
    <ScreenControls />
    <div class="placement-tools" role="group" aria-label="배치 도구">
      <span>{{ selectedIds.length }}개 선택</span>
      <button :disabled="selectedIds.length < 2" @click="alignSelection('x')">원점 X 맞춤</button>
      <button :disabled="selectedIds.length < 2" @click="alignSelection('y')">원점 Y 맞춤</button>
      <label><input type="checkbox" v-model="state.snapEnabled" />격자 스냅</label>
      <label
        >간격
        <input
          aria-label="스냅 간격"
          type="number"
          min="1"
          max="1000"
          :value="state.snapSize"
          @change="
            state.snapSize = Math.max(
              1,
              Math.min(1000, Number(($event.target as HTMLInputElement).value) || 10),
            )
          "
      /></label>
      <span class="hint">마지막 선택 원점에 정렬 · Ctrl/Shift 클릭으로 추가·해제</span>
    </div>
    <div ref="host" class="scene-canvas" data-testid="scene-canvas"></div>
    <div class="scene-foot">
      클릭 선택 · 드래그 이동 · 휠 확대/축소
      <span role="status">{{ viewMessage }}</span>
      <span>{{ state.playing ? '● 재생 중' : 'Ⅱ 정지됨' }}</span>
    </div>
  </div>
</template>
<style scoped>
.placement-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
}
.placement-tools label {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.placement-tools input[type='number'] {
  width: 65px;
}
</style>
