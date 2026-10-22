<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { createStage } from '../editor/Stage';
import { state } from '../editor/store';
const host = ref<HTMLElement>();
let stage: ReturnType<typeof createStage> | undefined;
onMounted(() => {
  if (host.value) stage = createStage(host.value);
});
onBeforeUnmount(() => stage?.destroy());
</script>
<template>
  <div class="scene-panel">
    <div class="scene-tools">
      <span class="live-dot"></span
      ><span>PHASER · {{ state.doc.designSize.width }} × {{ state.doc.designSize.height }}</span
      ><span class="spacer"></span><span>{{ state.timeline ? '연출 미리보기' : '배치 편집' }}</span
      ><button @click="stage && (stage.scene.viewZoom = 1)">화면 맞춤</button>
    </div>
    <div ref="host" class="scene-canvas" data-testid="scene-canvas"></div>
    <div class="scene-foot">
      클릭 선택 · 드래그 이동 · 휠 확대/축소
      <span>{{ state.playing ? '● 재생 중' : 'Ⅱ 정지됨' }}</span>
    </div>
  </div>
</template>
