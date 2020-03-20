<template>
  <div class="choropleth-wrapper">
    <div class="visualization__title">{{title}}</div>
    <svg id="choropleth"></svg>
  </div>
</template>

<script>
import * as d3 from 'd3';
// import d3 from 'd3';
import * as topojson from 'topojson-client';
import usAlbersCounties from '../../public/us-albers-counties.json';
// import usAlbers from '../../public/us-albers.json';
import csvData from '../../public/data.json';

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
    replaceSpace(name) {
      console.log(name);
      return name
        .replace(/ /g, '_')
        .replace(/St./g, 'Saint');
    },
    render() {
      const width = 960; const
        height = 600;
      // const colorDomain = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500,
      // 6000];
      // const extColorDomain = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500,
      //   6000];
      // const legendLabels = ['< 500', '500+', '1000+', '1500+', '2000+', '2500+', '3000+',
      // '3500+', '4000+', '4500+', '5000+', '5500+', '6000+'];
      // const color = d3.scaleOrdinal()
      //   .domain(colorDomain)
      //   .range(['#dcdcdc', '#d0d6cd', '#bdc9be', '#aabdaf', '#97b0a0', '#84a491', '#719782',
      //   '#5e8b73', '#4b7e64', '#387255', '#256546', '#125937', '#004d28']);

      // const div = d3.select('body').append('div')
      //   .attr('class', 'tooltip')
      //   .style('opacity', 0);

      // const svg = d3.select('body').append('svg')
      //   .attr('width', width)
      //   .attr('height', height)
      //   .style('margin', '-15px auto');
      // const path = d3geo.path();
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

      // d3.queue()
      //   .defer(d3.json, "us.json")
      //   .defer(d3.csv, "data.csv")
      //   .await(ready);


      function ready(error, us, data) {
        const pairRateWithId = {};
        const pairNameWithId = {};

        // Moves selction to front
        d3.selection.prototype.moveToFront = function () {
          return this.each(function () {
            this.parentNode.appendChild(this);
          });
        };

        // Moves selction to back
        d3.selection.prototype.moveToBack = function () {
          return this.each(function () {
            const { firstChild } = this.parentNode;
            if (firstChild) {
              this.parentNode.insertBefore(this, firstChild);
            }
          });
        };

        data.forEach((d) => {
          pairRateWithId[d.id] = +d.rate;
          pairNameWithId[d.id] = d.name;
        });

        svg
          .selectAll('g')
          .data(topojson.feature(us, us.objects.collection).features)
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

        // svg.append('g')
        //   .attr('class', 'county')
        //   .selectAll('path')
        //   .data(topojson.feature(us, us.objects.collection).features)
        //   .enter()
        //   .append('path')
        //   .attr('d', path)
        //   // .style('fill', (d) => color(pairRateWithId[d.id]))
        //   .style('opacity', 0.8)
        //   .attr('fill-rule', 'evenodd')
        //   .attr('clip-rule', 'evenodd')
        //   .attr('county-id', (d) => d.id)
        //   .attr('county-name', (d) => d.properties.name)
        //   .attr('class', 'county')
        //   .attr('id', (d) => this.replaceSpace(d))
        //   .attr('ref', (d) => this.replaceSpace(d))
        //   .on('mouseover', (d) => {
        //     console.log(d);
        //     // const sel = d3.select(this);
        //     // sel.moveToFront();
        //     // d3.select(this).transition().duration(300)
        //     // .style({ opacity: 1, stroke: 'black', 'stroke-width': 1.5 });
        //     // div.transition().duration(300)
        //     //   .style('opacity', 1);
        //     // div.text(`${pairNameWithId[d.id]}: ${pairRateWithId[d.id]}`)
        //     //   .style('left', `${d3.event.pageX}px`)
        //     //   .style('top', `${d3.event.pageY - 30}px`);
        //   })
        //   .on('mouseout', () => {
        //     // const sel = d3.select(this);
        //     // sel.moveToBack();
        //     // d3.select(this)
        //     //   .transition().duration(300)
        //     //   .style({ opacity: 0.8, stroke: 'white', 'stroke-width': 1 });
        //     // div.transition().duration(300)
        //     //   .style('opacity', 0);
        //   });
      }

      ready('', usAlbersCounties, csvData);

      // const legend = svg.selectAll('g.legend')
      //   .data(extColorDomain)
      //   .enter().append('g')
      //   .attr('class', 'legend');

      // const lsw = 73; const
      //   lsh = 20;
      //
      // legend.append('rect')
      //   .attr('x', (d, i) => width - (i * lsw) - lsw)
      //   .attr('y', 550)
      //   .attr('width', lsw)
      //   .attr('height', lsh)
      //   .style('fill', (d) => color(d))
      //   .style('opacity', 0.8);
      //
      // legend.append('text')
      //   .attr('x', (d, i) => width - (i * lsw) - lsw)
      //   .attr('y', 590)
      //   .text((d, i) => legendLabels[i]);
      //
      // const legendTitle = 'Number of independent farms';

      // svg.append('text')
      //   .attr('x', 10)
      //   .attr('y', 540)
      //   .attr('class', 'legend_title')
      //   .text(() => legendTitle);
    },
  },
  mounted() {
    // this.renderMap();
    this.render();
  },
  watch: {
    state() {
      // need this in place so that when we reload the
      // page the map is re-rendered when the state is there
      this.renderMap();
    },
  },
};
</script>
