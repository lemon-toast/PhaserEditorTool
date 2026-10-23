<script setup lang="ts">
import { computed, ref } from 'vue';
import { add, refreshAssets, state } from '../editor/store';
const search = ref(''),
  type = ref('all');
const assets = computed(() =>
  state.assets
    .filter(
      (a) =>
        (type.value === 'all' || a.kind === type.value) &&
        a.file.toLowerCase().includes(search.value.toLowerCase()),
    )
    .slice(0, 180),
);
function connect() {
  state.projectPickerOpen = true;
}
</script>
<template>
  <div class="panel assets-panel">
    <div class="panel-tools">
      <input
        aria-label="에셋 검색"
        v-model="search"
        placeholder="에셋 이름 또는 경로 검색"
      /><select aria-label="에셋 종류" v-model="type">
        <option value="all">전체</option>
        <option value="image">이미지</option>
        <option value="spine">Spine</option></select
      ><button @click="connect">프로젝트 선택</button
      ><button @click="refreshAssets" :disabled="state.loading">새로고침</button
      ><button @click="add('particle')">＋ 파티클</button
      ><button @click="add('text')">＋ 텍스트</button>
    </div>
    <div class="asset-grid">
      <button
        v-for="a in assets"
        :key="a.kind + a.file"
        class="asset-card"
        @click="add(a.kind, a)"
        :title="a.file"
      >
        <img
          v-if="a.kind === 'image'"
          loading="lazy"
          :src="`/api/asset?path=${encodeURIComponent(a.file)}`"
          alt=""
        /><span class="spine-symbol" v-else>♧</span><span>{{ a.name }}</span
        ><small>{{ a.kind === 'spine' ? 'SPINE ' + a.version : 'IMAGE' }}</small>
      </button>
    </div>
    <p class="hint" v-if="!state.assets.length">
      폴더를 연결하면 실제 이미지와 Spine을 선택할 수 있습니다.
    </p>
    <div class="caption">
      클릭하여 추가 · {{ state.assets.length }}개 중 {{ assets.length }}개 표시
      <span :title="state.project">{{ state.project.split(/[\\/]/).slice(-3).join('/') }}</span>
    </div>
  </div>
</template>
