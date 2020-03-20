<template>
  <div class="choropleth-wrapper">
    <svg id="choropleth"></svg>
  </div>
</template>

<script>
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import usAlbersCounties from '../../public/us-albers-counties.json';

export default {
  name: 'choropleth',
  props: {
    clicked: {
      type: Boolean,
      default: false,
    },
    handleClick: {
      type: Function,
      default: () => {},
    },
    handleHover: {
      type: Function,
      default: () => {},
    },
    state: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: '',
    },
  },
  methods: {
    render() {
      const width = 960;
      const height = 600;
      const svg = d3.select('#choropleth')
        .attr('width', width)
        .attr('height', height);

      // const projection = d3.geoMercator(); // corrected to line up on the screen
      const projection = d3.geoAlbersUsa(); // correct to the full map
      const path = d3.geoPath().projection(projection);

      projection.scale(1).translate([0, 0]);
      const counties = topojson.feature(usAlbersCounties, usAlbersCounties.objects.collection);
      const b = path.bounds(counties);
      const s = 0.95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);
      /* eslint-disable-next-line no-mixed-operators */
      const t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];

      projection.scale(s)
        .translate(t);

      function ready(us) {
        const usa = topojson.feature(us, us.objects.collection).features;

        svg
          .selectAll('g')
          .data(usa)
          .enter()
          .append('g')
          .append('path')
          .attr('d', path)
          .attr('fill-rule', 'evenodd')
          .attr('clip-rule', 'evenodd')
          .attr('county-id', (d) => d.id)
          .attr('county-name', (d) => d.properties.name)
          .attr('class', 'county')
          .attr('id', (d) => d.properties.name)
          .attr('ref', (d) => d.properties.name);
      }

      ready(usAlbersCounties);
    },
  },
  mounted() {
    // http://bl.ocks.org/jadiehm/af4a00140c213dfbc4e6
    this.render();
  },
};
</script>
