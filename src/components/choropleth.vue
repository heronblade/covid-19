<template>
  <div class="covid">
    <div class="covid__controls">
      <div class="radio-button">
        <p>Choose between States or Counties</p>
        <input @click="handleMapToggle" type="radio"
               id="allStates" name="maps" value="States" checked>
        <label for="allStates">States</label>
        <input @click="handleMapToggle" type="radio"
               id="allCounties" name="maps" value="Counties">
        <label for="allCounties">Counties</label>
      </div>
      <div class="date-slider">
        <div class="title"><span>Date Range</span></div>
        <div class="date-slider__controls">
          <i class="el-icon-back" @click="handlePreviousDayClick"></i>
          <el-slider class="slider" v-model="sliderState"
                     :format-tooltip="formatTooltip"
                     @change="handleSliderChange"
          ></el-slider>
          <i class="el-icon-right" @click="handleNextDayClick"></i>
        </div>
        <div class="play-button-wrapper">
          <el-button class="play-button" icon="el-icon-video-play"
                     @click="handlePlayClick">Play</el-button>
        </div>
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
import axios from 'axios';
import usAlbersCounties from '../../public/us-albers-counties.json';
import usAlbers from '../../public/us-albers.json';

export default {
  name: 'choropleth',
  data() {
    return {
      clicked: false,
      datePicker: '',
      endDate: '',
      infectionColors: {},
      maxCases: 0,
      numberOfDays: 70,
      nyTimesData: {
        states: '',
        counties: '',
      },
      nyTimesStartDate: '',
      playing: false,
      radio: 1,
      showStates: true,
      showCounties: false,
      sliderState: 21, // first day we have data for
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
      return a.getDate() === b.getDate()
      && a.getMonth() === b.getMonth()
      && a.getFullYear() === b.getFullYear();
    },
    csvToJSON(csv) {
      const lines = csv.split('\n');
      const result = [];
      const headers = lines[0].split(',');

      // eslint-disable-next-line no-plusplus
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const obj = {};
        const currentline = lines[i].split(',');
        // eslint-disable-next-line no-plusplus
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = currentline[j];
        }
        result.push(obj);
      }
      return result;
    },
    formatTooltip(val) {
      if (val) {
        const startDate = new Date(2020, 0, 21);
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
    getColor() {
      return d3.scaleSequentialSqrt([0, this.maxCases], d3.interpolateBlues);
      // return d3.scaleSequential([0, 1000], d3.interpolateBlues);
    },
    handlePreviousDayClick() {
      this.sliderState -= 1;
      this.renderMap(this.showStates);
    },
    handlePlayClick() {
      const that = this;
      let timer = {};
      // const playButton = document.getElementsByClassName('play-button');
      // console.log(playButton);

      if (this.playing === false) {
        timer = setInterval(() => {
          if (that.sliderState <= 100) {
            that.sliderState += 1;
          } else {
            that.sliderState = 0;
          }
          that.updateInfectionColors();
          that.renderMap(this.showStates);
          // d3.select('#clock').html(attributeArray[currentAttribute]);  // update the clock
        }, 2000);

        // d3.select(this).html('stop');  // change the button label to stop
        this.playing = true;
      } else {
        clearInterval(timer);
        // d3.select(this).html('play');
        this.playing = false;
      }
    },
    handleMapToggle() {
      this.showStates = !this.showStates;
      this.showCounties = !this.showCounties;
      if (!this.countiesRendered) {
        this.countiesRendered = true;
        this.renderMap(false);
      }
    },
    handleNextDayClick() {
      this.sliderState += 1;
      this.renderMap(this.showStates);
    },
    handleSliderChange() {
      this.renderMap(this.showStates);
    },
    renderMap(states) {
      const that = this;
      const width = 760;
      const height = 500;

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
      const color = this.getColor();

      // reset the infection colors
      this.infectionColors = {};
      this.updateInfectionColors();

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

        const fips = states ? 'fips_state' : 'fips';

        svg
          .selectAll('g')
          .data(usa)
          .enter()
          .append('g')
          .append('path')
          .style('opacity', 0.8)
          .style('fill', (d) => color(that.infectionColors[d.properties[`${fips}`]]))
          .attr('infected', (d) => that.infectionColors[d.properties.name])
          .attr('d', path)
          .attr('fill-rule', 'evenodd')
          .attr('clip-rule', 'evenodd')
          .attr('county-id', (d) => d.id)
          .attr('county-name', (d) => d.properties.name)
          .attr('class', `${states ? 'state' : 'county'}`)
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
    parseData() {
      this.maxCases = Math.max(
        ...this.nyTimesData.states.map((state) => parseInt(state.cases, 10)),
      );
      const startDate = new Date(2020, 0, 21);
      const endDate = new Date();
      this.numberOfDays = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24),
      );
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
    updateInfectionColors() {
      const that = this;
      const date = this.endDate;
      /**
       * have to figure out if we are showing totals or we are showing up to the current date
       * for these color figures
       */
      if (this.showStates) {
        /**
         * loop through the states data, and for each state, look at the current date, and
         * pull that data.
         */
        this.nyTimesData.states.forEach((state) => {
          const stateDate = new Date(state.date);
          if (that.compareDates(date, stateDate)) {
            that.infectionColors[state.fips] = state.cases;
          }
        });
      } else {
        this.nyTimesData.counties.forEach((county) => {
          const countyDate = new Date(county.date);
          if (that.compareDates(date, countyDate)) {
            that.infectionColors[county.fips] = county.cases;
          }
        });
      }
    },
  },
  mounted() {
    /**
     * Links
     * http://bl.ocks.org/jadiehm/af4a00140c213dfbc4e6 - main example
     * http://bl.ocks.org/rgdonohue/9280446 - animation example
     * https://observablehq.com/@d3/color-legend - color legend
     * http://91-divoc.com/pages/covid-visualization - covid bar graph
     * https://www.nytimes.com/interactive/2020/us/coronavirus-us-cases.html#g-cases-by-county
     * https://coronavirus.jhu.edu/map.html
     * https://github.com/CSSEGISandData/COVID-19 - Johns Hopkins CSSE Data
     * https://www.cnn.com/interactive/2020/health/coronavirus-maps-and-cases - Animated bubble map
     * https://github.com/nytimes/covid-19-data - NY Times data
     */
    const that = this;

    function getStateData() {
      const payload = {
        url: 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv',
        method: 'GET',
        responseType: 'blob',
      };
      return axios(payload);
    }

    function getCountyData() {
      const payload = {
        url: 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv',
        method: 'GET',
        responseType: 'blob',
      };
      return axios(payload);
    }

    axios.all([getStateData(), getCountyData()])
      .then(axios.spread(async (stateData, countyData) => {
        const stateResponse = await stateData.data.text();
        const countyResponse = await countyData.data.text();
        that.nyTimesData.states = that.csvToJSON(stateResponse);
        that.nyTimesData.counties = that.csvToJSON(countyResponse);
        // need to parse some information out of the data.  need start/end date, and max #
        that.parseData();
        that.renderMap(true);
      }))
      .catch((error) => {
        console.log(error);
      });
  },
  // watch: {
  //   endDate() {
  //     console.log(this.endDate);
  //     this.renderMap(this.showStates);
  //   },
  // },
  // TODO: make it so the date cannot go past the latest date available
  // TODO: show date as time moves, and add a pause button.
  // TODO: add a reset button
  /**
   * the layer aboe it should be heat bubbles based on the number of cases
   * lifehacker has a site up that i can look at
   * make it two things up here so you have the map and you have the bar graph like
   * http://91-divoc.com/pages/covid-visualization/
   *
   * vintage - population analytics (loss triangles)
   *
   * the bubbles will be overlayed in there because they talk about the spread. need to be able
   * to turn the cirlces off on/off switch
   */
};
</script>
