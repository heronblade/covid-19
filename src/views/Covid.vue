<template>
  <div class="covid">
    <p>Covid Page</p>
    <choropleth
      title="Plan Enrollment Share by County"
      :state="state"></choropleth>
  </div>
</template>

<script>
import choropleth from '../components/choropleth.vue';

export default {
  name: 'covid',
  data() {
    return {
      state: 'Pennsylvania',
    };
  },
  components: {
    choropleth,
  },
};
</script>
