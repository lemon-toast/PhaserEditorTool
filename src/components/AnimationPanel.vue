<script setup lang="ts">
import { animation, edit, playTimeline, state, stop } from '../editor/store';
function seek(e: Event) {
  state.timeline = true;
  state.playing = false;
  state.time = Number((e.target as HTMLInputElement).value);
}
</script>
<template>
  <div class="panel animation-panel">
    <div class="panel-tools">
      <select aria-label="연출 선택" v-model="state.animationId" @change="stop">
        <option v-for="a in state.doc.animations" :key="a.id" :value="a.id">
          {{ a.name }}
        </option></select
      ><button class="accent" @click="playTimeline" :disabled="!animation">▶ 연출 재생</button
      ><button @click="state.playing = !state.playing">
        {{ state.playing ? 'Ⅱ 일시정지' : '▶ 계속' }}</button
      ><button @click="stop">■ 정지</button
      ><label class="inline"><input type="checkbox" v-model="state.loop" />반복</label
      ><select aria-label="재생 속도" v-model="state.speed">
        <option :value="0.25">0.25배</option>
        <option :value="0.5">0.5배</option>
        <option :value="1">1배</option>
        <option :value="2">2배</option>
      </select>
    </div>
    <div class="timebar">
      <strong>{{ (state.time / 1000).toFixed(2) }} s</strong
      ><input
        aria-label="연출 시점"
        type="range"
        min="0"
        :max="animation?.duration || 1"
        :value="state.time"
        @input="seek"
      /><span>{{ ((animation?.duration || 0) / 1000).toFixed(2) }} s</span>
    </div>
    <div class="track-list" v-if="animation">
      <div class="track-row" v-for="(t, i) in animation.tracks" :key="i">
        <span
          >{{ state.doc.nodes[t.target]?.name }} <small>{{ t.property }}</small></span
        >
        <div class="track-lane">
          <div
            class="track-clip"
            :style="{
              left: `${(t.start / animation.duration) * 100}%`,
              width: `${(t.duration / animation.duration) * 100}%`,
            }"
          >
            {{ t.from }} → {{ t.to }}
          </div>
        </div>
        <input
          :aria-label="`트랙 ${i + 1} 도착값`"
          type="number"
          :value="t.to"
          @change="
            edit((doc) => {
              doc.animations.find((a) => a.id === state.animationId)!.tracks[i].to = Number(
                ($event.target as HTMLInputElement).value,
              );
            })
          "
        />
      </div>
    </div>
    <p class="hint">
      현재 트랙: Transform · 시점 이동은 Transform만 평가합니다. 입자·Spine의 정확한 시점 복원과
      코드 연출 연결은 후속 구현입니다.
    </p>
  </div>
</template>
