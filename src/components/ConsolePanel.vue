<script setup lang="ts">
import { state } from '../editor/store';
</script>
<template>
  <div class="panel console-panel">
    <div class="panel-tools">
      <span>{{ state.logs.length }}개 메시지</span><button @click="state.logs = []">지우기</button>
    </div>
    <div
      v-for="(entry, i) in [...state.logs].reverse()"
      :key="i"
      class="log-row"
      :class="{ error: entry.level === '오류' }"
    >
      <time>{{ entry.time }}</time
      ><span>{{ entry.level }}</span>
      <p>{{ entry.message }}</p>
    </div>
    <p class="hint" v-if="!state.logs.length">메시지가 없습니다.</p>
  </div>
</template>
