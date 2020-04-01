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
        <input @click="handleDataTypeChange" type="radio"
               id="cases" name="dataType" value="Cases">
        <label for="cases">Cases</label>
        <input @click="handleDataTypeChange" type="radio"
               id="deaths" name="dataType" value="Deaths">
        <label for="deaths">Deaths</label>
      </div>
      <div class="current-date">{{this.formattedPlayDate}}</div>
      <div class="date-slider">
        <div class="title"><span>Date Range</span></div>
        <div class="date-slider__controls">
          <el-date-picker
            v-model="startDate"
            type="date"
            placeholder="Pick Start Date"
            :picker-options="pickerOptions"
          ></el-date-picker>
          <el-date-picker
            v-model="endDate"
            type="date"
            placeholder="Pick End Date"
            :picker-options="pickerOptions"
          ></el-date-picker>
        </div>
        <div class="play-button-wrapper">
          <el-button class="play-button"
                     @click="handlePlayClick">Play</el-button>
        </div>
      </div>
    </div>
    <div class="covid__choropleth-wrapper">
      <div class="viz"></div>
<!--      <svg id="usa" :class="`show-${this.showStates}`"></svg>-->
<!--      <svg id="counties" :class="`show-${this.showCounties}`"></svg>-->
<!--      <div id="stateLegend" :class="`show-${this.showStates}`"></div>-->
<!--      <div id="countyLegend" :class="`show-${this.showCounties}`"></div>-->
    </div>
    <div class="covid__sources">
      <p>Data coming from <a href="https://github.com/nytimes/covid-19-data">NY Times Github</a></p>
      <p>Last updated {{lastPulledDate}}</p>
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
      endDate: new Date(),
      formattedPlayDate: '',
      infectionColors: {},
      lastPulledDate: '',
      mapMeasurements: {
        margin: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10,
        },
        width: 760,
        height: 500,
        defaultRatio: 1.52,
      },
      maxCases: 0,
      numberOfDays: 70,
      nyTimesData: {
        states: '',
        counties: '',
      },
      nyTimesStartDate: '',
      pickerOptions: {
        disabledDate(time) {
          return time.getTime() > Date.now();
        },
        shortcuts: [{
          text: 'Today',
          onClick(picker) {
            picker.$emit('pick', new Date());
          },
        }, {
          text: 'Yesterday',
          onClick(picker) {
            const date = new Date();
            date.setTime(date.getTime() - 3600 * 1000 * 24);
            picker.$emit('pick', date);
          },
        }, {
          text: 'A week ago',
          onClick(picker) {
            const date = new Date();
            date.setTime(date.getTime() - 3600 * 1000 * 24 * 7);
            picker.$emit('pick', date);
          },
        }],
      },
      playing: false,
      playDate: '',
      radio: 1,
      showStates: true,
      showCounties: false,
      startDate: new Date(2020, 0, 21),
      sliderState: 21, // first day we have data for
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
    getColor() {
      return d3.scaleSequentialSqrt([0, this.maxCases], d3.interpolateBlues);
      // return d3.scaleSequential([0, 1000], d3.interpolateBlues);
    },
    handleDataTypeChange() {
      console.log('handle type change');
    },
    handleMapToggle() {
      this.showStates = !this.showStates;
      this.showCounties = !this.showCounties;
      this.renderMap(this.showStates);
    },
    handlePlayClick() {
      const that = this;
      let timer = {};
      /**
       * Need to grab the start date, and the end date and then increment
       * play date by 1 until we get to the end date
       */
      if (this.playing === false) {
        // set playDate to startDate
        this.playDate = this.startDate;
        // change value of play button
        document.getElementsByClassName('play-button')[0].innerHTML = 'Pause';
        timer = setInterval(() => {
          // need to have the stop functionality here
          const done = this.compareDates(this.playDate, this.endDate);
          if (done) {
            document.getElementsByClassName('play-button')[0].innerHTML = 'Play';
            clearInterval(timer);
            return;
          }
          that.updateInfectionColors();
          that.updateMap();
          // that.renderBothMaps();
          // that.renderMap(this.showStates);

          // increment playDate
          this.playDate = new Date(this.playDate.setDate(this.playDate.getDate() + 1));
        }, 100);
        this.playing = true;
      } else {
        clearInterval(timer);
        document.getElementsByClassName('play-button')[0].innerHTML = 'Play';
        this.playing = false;
      }
    },
    handleWindowResize() {
      const that = this;
      let resizeTimer;
      window.onresize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          d3
            .selectAll('svg')
            .remove();
          that.setMapMeasurements();
          that.renderBothMaps();
        }, 100);
      };
    },
    formatDate(date) {
      const dayToString = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday'];
      const monthToString = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];
      const day = dayToString[date.getDay()];
      const month = monthToString[date.getMonth()];
      const dateOfMonth = date.getDate();
      const year = date.getFullYear();
      return `${day}, ${month} ${dateOfMonth} ${year}`;
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
    renderBothMaps() {
      const that = this;
      // eslint-disable-next-line operator-linebreak
      // this.mapMeasurements.width = this.mapMeasurements.width
      //   - this.mapMeasurements.margin.left - this.mapMeasurements.margin.right;
      // this.mapMeasurements.height = this.mapMeasurements.width
      //   * this.mapMeasurements.defaultRatio;
      let active = d3.select(null);

      const svg = d3.select('.viz').append('svg')
        .attr('class', 'center-container')
        // eslint-disable-next-line operator-linebreak
        .attr('height', this.mapMeasurements.height +
          this.mapMeasurements.margin.top + this.mapMeasurements.margin.bottom)
        // eslint-disable-next-line operator-linebreak
        .attr('width', this.mapMeasurements.width +
          this.mapMeasurements.margin.left + this.mapMeasurements.margin.right);

      // svg.selectAll('svg').remove();

      svg.append('rect')
        .attr('class', 'background center-container')
        // eslint-disable-next-line operator-linebreak
        .attr('height', this.mapMeasurements.height +
          this.mapMeasurements.margin.top + this.mapMeasurements.margin.bottom)
        // eslint-disable-next-line operator-linebreak
        .attr('width', this.mapMeasurements.width +
          this.mapMeasurements.margin.left + this.mapMeasurements.margin.right)
        // eslint-disable-next-line no-use-before-define
        .on('click', clicked);

      const projection = d3.geoAlbersUsa()
        .translate([this.mapMeasurements.width / 2, this.mapMeasurements.height / 2])
        .scale(this.mapMeasurements.width);

      const path = d3.geoPath()
        .projection(projection);

      // colors matched with data
      const color = this.getColor();

      // reset the infection colors
      this.updateInfectionColors();

      const g = svg.append('g')
        .attr('class', 'center-container center-items us-state')
        .attr('transform',
          `translate(${this.mapMeasurements.margin.left}, ${this.mapMeasurements.margin.top})`)
        // eslint-disable-next-line operator-linebreak
        .attr('width', this.mapMeasurements.width +
          this.mapMeasurements.margin.left + this.mapMeasurements.margin.right)
        // eslint-disable-next-line operator-linebreak
        .attr('height', this.mapMeasurements.height +
          this.mapMeasurements.margin.top + this.mapMeasurements.margin.bottom);

      // counties
      g.append('g')
        .attr('id', 'counties')
        .selectAll('path')
        .data(topojson.feature(usAlbersCounties, usAlbersCounties.objects.collection).features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('class', 'county-boundary')
        .style('fill', (d) => color(that.infectionColors[d.properties.fips]))
        // eslint-disable-next-line no-use-before-define
        .on('click', reset);

      // states
      g.append('g')
        .attr('id', 'states')
        .selectAll('path')
        .data(topojson.feature(usAlbers, usAlbers.objects.us).features)
        .enter()
        .append('path')
        .attr('d', path)
        .style('fill', (d) => color(that.infectionColors[d.properties.fips_state]))
        .attr('class', 'state')
        // eslint-disable-next-line no-use-before-define
        .on('click', clicked);

      g.append('path')
        .datum(topojson.mesh(usAlbers, usAlbers.objects.us, (a, b) => a !== b))
        .attr('id', 'state-borders')
        .attr('d', path);

      // eslint-disable-next-line consistent-return
      function clicked(d) {
        // eslint-disable-next-line no-use-before-define
        if (d3.select('.background').node() === this) return reset();

        // eslint-disable-next-line no-use-before-define
        if (active.node() === this) return reset();

        active.classed('active', false);
        active = d3.select(this).classed('active', true);

        const bounds = path.bounds(d);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        const scale = 0.9 / Math.max(dx / that.mapMeasurements.width,
          dy / that.mapMeasurements.height);
        const translate = [that.mapMeasurements.width / 2 - scale * x,
          that.mapMeasurements.height / 2 - scale * y];

        g.transition()
          .duration(750)
          .style('stroke-width', `${1.5 / scale}px`)
          .attr('transform', `translate(${translate})scale(${scale})`);
      }

      function reset() {
        active.classed('active', false);
        active = d3.select(null);

        g.transition()
          .delay(100)
          .duration(750)
          .style('stroke-width', '1.5px')
          .attr('transform',
            `translate(${that.mapMeasurements.margin.left},${that.mapMeasurements.margin.top})`);
      }
    },
    legend({
      color,
      title,
      tickSize = 6,
      width = 500,
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

      // set the end date to the last date
      this.playDate = new Date(this.nyTimesData.states.pop().date);
      this.endDate = new Date(this.nyTimesData.states.pop().date);
      this.lastPulledDate = this.formatDate(new Date(this.nyTimesData.states.pop().date));
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
    setMapMeasurements() {
      const currentWidth = window.innerWidth - 100;
      const currentHeight = window.innerHeight - 100;

      const currentRatio = currentWidth / currentHeight;
      let h;
      let w;

      // Check if height is limiting factor
      if (currentRatio > this.mapMeasurements.defaultRatio) {
        h = currentHeight;
        w = h * this.mapMeasurements.defaultRatio;
        // Else width is limiting
      } else {
        w = currentWidth;
        h = w / this.mapMeasurements.defaultRatio;
      }

      // Set new width and height based on graph dimensions
      // eslint-disable-next-line operator-linebreak
      this.mapMeasurements.width = w -
        this.mapMeasurements.margin.left - this.mapMeasurements.margin.right;
      // eslint-disable-next-line operator-linebreak
      this.mapMeasurements.height = h -
        this.mapMeasurements.margin.top - this.mapMeasurements.margin.bottom;
    },
    updateInfectionColors() {
      this.infectionColors = {};
      const that = this;
      const date = this.playDate;
      this.nyTimesData.states.forEach((state) => {
        const stateDate = new Date(state.date);
        if (that.compareDates(date, stateDate)) {
          that.infectionColors[state.fips] = state.cases;
        }
      });
      this.nyTimesData.counties.forEach((county) => {
        const countyDate = new Date(county.date);
        if (that.compareDates(date, countyDate)) {
          that.infectionColors[county.fips] = county.cases;
        }
      });
      /**
       * have to figure out if we are showing totals or we are showing up to the current date
       * for these color figures
       */
      // if (this.showStates) {
      //   /**
      //    * loop through the states data, and for each state, look at the current date, and
      //    * pull that data.
      //    */
      //   this.nyTimesData.states.forEach((state) => {
      //     const stateDate = new Date(state.date);
      //     if (that.compareDates(date, stateDate)) {
      //       that.infectionColors[state.fips] = state.cases;
      //     }
      //   });
      // } else {
      //   this.nyTimesData.counties.forEach((county) => {
      //     const countyDate = new Date(county.date);
      //     if (that.compareDates(date, countyDate)) {
      //       that.infectionColors[county.fips] = county.cases;
      //     }
      //   });
      // }
    },
    updateMap() {
      const that = this;
      const color = this.getColor();
      d3
        .select('#counties')
        .selectAll('path')
        .style('fill', (d) => color(that.infectionColors[d.properties.fips]));
      d3
        .select('#states')
        .selectAll('path')
        .style('fill', (d) => color(that.infectionColors[d.properties.fips_state]));
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
     * https://projects.fivethirtyeight.com/mortality-rates-united-states/musculoskeletal/#2014 - 538 Graph
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
        // that.renderMap(true);
        that.handleWindowResize();
        that.setMapMeasurements();
        that.renderBothMaps();
      }))
      .catch((error) => {
        console.log(error);
      });
  },
  watch: {
    playDate() {
      this.formattedPlayDate = this.formatDate(this.playDate);
    },
  },
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
