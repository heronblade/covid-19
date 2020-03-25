<template>
  <div class="covid">
    <div class="covid__controls">
      <input @click="handleMapToggle" type="radio"
             id="allStates" name="maps" value="States" checked>
      <label for="allStates">States</label>
      <input @click="handleMapToggle" type="radio"
             id="allCounties" name="maps" value="Counties">
      <label for="allCounties">Counties</label>
      <div class="date-slider">
        <el-slider v-model="sliderState"
                   :format-tooltip="formatTooltip"
                   @change="handleSliderChange"
        ></el-slider>
      </div>
    </div>
    <div class="covid__choropleth-wrapper">
      <svg id="usa" :class="`show-${this.showStates}`"></svg>
      <svg id="counties" :class="`show-${this.showCounties}`"></svg>
      <div id="stateLegend" :class="`show-${this.showStates}`"></div>
      <div id="countyLegend" :class="`show-${this.showCounties}`"></div>
    </div>
  </div>

</template>

<script>
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import usAlbersCounties from '../../public/us-albers-counties.json';
import usAlbers from '../../public/us-albers.json';
import statesData from '../../public/states.json';

import countiesData from '../../public/counties.json';

export default {
  name: 'choropleth',
  data() {
    return {
      clicked: false,
      endDate: '',
      showStates: true,
      showCounties: false,
      sliderState: 1,
      countiesRendered: false,
    };
  },
  methods: {
    /**
     * Compare two dates (could be of any type supported by the convert
     * function above) and returns:
     * -1 : if a < b
     * 0 : if a = b
     * 1 : if a > b
     * NaN : if a or b is an illegal date
     * NOTE: The code inside isFinite does an assignment (=).
     * @param {Date} a - first Date
     * @param {Date} b - second date
     * @return {number}
     */
    compareDates(a, b) {
      // eslint-disable-next-line no-return-assign
      return (
        // eslint-disable-next-line no-restricted-globals
        isFinite(a)
        // eslint-disable-next-line no-restricted-globals
        && isFinite(b)
          ? (a > b) - (a < b)
          : NaN
      );
    },
    formatTooltip(val) {
      if (val) {
        const startDate = new Date(2020, 0, 1);
        startDate.setDate(val);
        this.endDate = startDate;
        const dayToString = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
          'Thursday', 'Friday', 'Saturday'];
        const monthToString = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
          'August', 'September', 'October', 'November', 'December'];
        const day = dayToString[startDate.getDay()];
        const month = monthToString[startDate.getMonth()];
        const dateOfMonth = startDate.getDate();
        const year = startDate.getFullYear();
        return `${day}, ${month} ${dateOfMonth} ${year} `;
      }
      return 'Date';
    },
    handleMapToggle() {
      this.showStates = !this.showStates;
      this.showCounties = !this.showCounties;
      if (!this.countiesRendered) {
        this.countiesRendered = true;
        this.renderMap(false);
      }
    },
    handleSliderChange() {
      this.renderMap(this.showStates);
    },
    renderMap(states) {
      const width = 960;
      const height = 600;

      const tooltip = d3
        .select('.covid__choropleth-wrapper')
        .append('div')
        .attr('class', 'covid__choropleth-tooltip')
        .style('opacity', 0);

      // const projection = d3.geoMercator(); // corrected to line up on the screen
      const projection = d3.geoAlbersUsa(); // correct to the full map
      const path = d3.geoPath().projection(projection);

      projection.scale(1).translate([0, 0]);
      /**
       * Bostock himself answered this question
       * https://stackoverflow.com/questions/14492284/center-a-map-in-d3-given-a-geojson-object
       * to help us other simple human beings figure out how in the world we are supposed
       * to center these things.  Without this, the state renders with a bunch of empty
       * space around it.
       */
      const counties = topojson.feature(usAlbersCounties, usAlbersCounties.objects.collection);
      const b = path.bounds(counties);
      const s = 0.95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);
      /* eslint-disable-next-line no-mixed-operators */
      const t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];

      projection.scale(s).translate(t);

      // colors matched with data
      const infectionColors = {};
      const color = d3.scaleSequential([0, 1000], d3.interpolateBlues);

      /**
       * have to figure out if we are showing totals or we are showing up to the current date
       * for these color figures
       */
      if (states) {
        /**
         * loop through the states data, and for each state, look at the current date, and
         * pull that data.
         */
        const date = new Date(this.endDate);
        statesData.forEach((state) => {
          const matchingDate = state.infections
            .filter((infection) => this.compareDates(date, new Date(infection.date)) === 0)[0];
          if (matchingDate) {
            infectionColors[state.name] = matchingDate.number;
          } else {
            infectionColors[state.name] = state.totals.infections;
          }
          // infectionColors[state.name] = state.totals.infections;
        });
      } else {
        countiesData
          .filter((county) => county.totals)
          .forEach((county) => {
            infectionColors[county.name] = county.totals.infections;
          });
      }

      function handleMouseOver(d, index, allElements) {
        d3.select(this)
          .transition()
          .duration(100)
          .style('opacity', 1);
        const { infected } = allElements[index].attributes;

        tooltip
          .transition()
          .duration(100)
          .style('opacity', 0.9);
        tooltip
          .html(`${d.properties.name} ${infected.value}`)
          .style('left', `${d3.event.pageX}px`)
          .style('top', `${d3.event.pageY - 28}px`);
      }

      function handleMouseOut() {
        d3.select(this)
          .transition()
          .duration(100)
          .style('opacity', 0.8);
        tooltip
          .transition()
          .duration(100)
          .style('opacity', 0);
      }

      function ready(topoData) {
        const usa = states
          ? topojson.feature(topoData, topoData.objects.us).features
          : topojson.feature(topoData, topoData.objects.collection).features;

        const svg = states
          ? d3.select('#usa')
            .attr('width', width)
            .attr('height', height)
          : d3.select('#counties')
            .attr('width', width)
            .attr('height', height);

        svg.selectAll('*').remove();

        svg
          .selectAll('g')
          .data(usa)
          .enter()
          .append('g')
          .append('path')
          .on('mouseover', handleMouseOver)
          .on('mouseout', handleMouseOut)
          .style('opacity', 0.8)
          .style('fill', (d) => color(infectionColors[d.properties.name]))
          .attr('infected', (d) => infectionColors[d.properties.name])
          .attr('d', path)
          .attr('fill-rule', 'evenodd')
          .attr('clip-rule', 'evenodd')
          .attr('county-id', (d) => d.id)
          .attr('county-name', (d) => d.properties.name)
          .attr('class', 'county')
          .attr('id', (d) => d.properties.name)
          .attr('ref', (d) => d.properties.name);
      }

      if (states) {
        ready(usAlbers);
      } else {
        ready(usAlbersCounties);
      }


      // eslint-disable-next-line no-unused-vars
      const legendWrapper = this.legend({
        color,
        title: 'Infections',
      });

      const legend = states
        ? document.getElementById('stateLegend')
        : document.getElementById('countyLegend');
      /**
       * since we call this function every time the slider changes we only want
       * to add the legend if there isn't one already there.
       *
       * Might want to change this so that the legend can have a range of more than 1k
       */
      if (legend.childNodes.length === 0) {
        legend.appendChild(legendWrapper);
      }
    },
    legend({
      color,
      title,
      tickSize = 6,
      width = 320,
      height = 44 + tickSize,
      marginTop = 18,
      marginRight = 0,
      marginBottom = 16 + tickSize,
      marginLeft = 0,
      ticks = width / 64,
      tickFormat,
      tickValues,
    } = {}) {
      // https://observablehq.com/@d3/color-legend
      const svg = d3.create('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .style('overflow', 'visible')
        .style('display', 'block');

      let tickAdjust = (g) => g.selectAll('.tick line').attr('y1', marginTop + marginBottom - height);
      let x;

      // Continuous
      if (color.interpolate) {
        const n = Math.min(color.domain().length, color.range().length);

        x = color.copy()
          .rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

        svg.append('image')
          .attr('x', marginLeft)
          .attr('y', marginTop)
          .attr('width', width - marginLeft - marginRight)
          .attr('height', height - marginTop - marginBottom)
          .attr('preserveAspectRatio', 'none')
          .attr('xlink:href', this.ramp(color.copy().domain(d3.quantize(d3.interpolate(0, 1), n))).toDataURL());
      } else if (color.interpolator) { // Sequential
        x = Object.assign(color.copy()
          .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
        { range() { return [marginLeft, width - marginRight]; } });

        svg.append('image')
          .attr('x', marginLeft)
          .attr('y', marginTop)
          .attr('width', width - marginLeft - marginRight)
          .attr('height', height - marginTop - marginBottom)
          .attr('preserveAspectRatio', 'none')
          .attr('xlink:href', this.ramp(color.interpolator()).toDataURL());

        // scaleSequentialQuantile doesn’t implement ticks or tickFormat.
        if (!x.ticks) {
          if (tickValues === undefined) {
            const n = Math.round(ticks + 1);
            // eslint-disable-next-line no-param-reassign
            tickValues = d3.range(n).map((i) => d3.quantile(color.domain(), i / (n - 1)));
          }
          if (typeof tickFormat !== 'function') {
            // eslint-disable-next-line no-param-reassign
            tickFormat = d3.format(tickFormat === undefined ? ',f' : tickFormat);
          }
        }
      } else if (color.invertExtent) { // Threshold
        // eslint-disable-next-line no-nested-ternary
        const thresholds = color.thresholds ? color.thresholds() // scaleQuantize
          : color.quantiles ? color.quantiles() // scaleQuantile
            : color.domain(); // scaleThreshold

        // eslint-disable-next-line no-nested-ternary
        const thresholdFormat = tickFormat === undefined ? (d) => d
          : typeof tickFormat === 'string' ? d3.format(tickFormat)
            : tickFormat;

        x = d3.scaleLinear()
          .domain([-1, color.range().length - 1])
          .rangeRound([marginLeft, width - marginRight]);

        svg.append('g')
          .selectAll('rect')
          .data(color.range())
          .join('rect')
          .attr('x', (d, i) => x(i - 1))
          .attr('y', marginTop)
          .attr('width', (d, i) => x(i) - x(i - 1))
          .attr('height', height - marginTop - marginBottom)
          .attr('fill', (d) => d);

        // eslint-disable-next-line no-param-reassign
        tickValues = d3.range(thresholds.length);
        // eslint-disable-next-line no-param-reassign
        tickFormat = (i) => thresholdFormat(thresholds[i], i);
      } else { // Ordinal
        x = d3.scaleBand()
          .domain(color.domain())
          .rangeRound([marginLeft, width - marginRight]);

        svg.append('g')
          .selectAll('rect')
          .data(color.domain())
          .join('rect')
          .attr('x', x)
          .attr('y', marginTop)
          .attr('width', Math.max(0, x.bandwidth() - 1))
          .attr('height', height - marginTop - marginBottom)
          .attr('fill', color);

        tickAdjust = () => {};
      }

      svg.append('g')
        .attr('transform', `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x)
          .ticks(ticks, typeof tickFormat === 'string' ? tickFormat : undefined)
          .tickFormat(typeof tickFormat === 'function' ? tickFormat : undefined)
          .tickSize(tickSize)
          .tickValues(tickValues))
        .call(tickAdjust)
        .call((g) => g.select('.domain').remove())
        .call((g) => g.append('text')
          .attr('x', marginLeft)
          .attr('y', marginTop + marginBottom - height - 6)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'start')
          .attr('font-weight', 'bold')
          .text(title));

      return svg.node();
    },
    ramp(color, n = 256) {
      const canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = 1;
      const context = canvas.getContext('2d');
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < n; ++i) {
        context.fillStyle = color(i / (n - 1));
        context.fillRect(i, 0, 1, 1);
      }
      return canvas;
    },
  },
  mounted() {
    // http://bl.ocks.org/jadiehm/af4a00140c213dfbc4e6
    this.renderMap(true);
  },
  // watch: {
  //   endDate() {
  //     console.log(this.endDate);
  //     this.renderMap(this.showStates);
  //   },
  // },
};
</script>
