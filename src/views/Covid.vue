<template>
  <div class="covid">
    <p>Covid Page</p>
    <choropleth></choropleth>
  </div>
</template>

<script>
import choropleth from '../components/choropleth.vue';

export default {
  name: 'covid',
  data() {
    return {};
  },
  components: {
    choropleth,
  },
};
</script>
