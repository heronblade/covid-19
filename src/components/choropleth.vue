<template>
  <div class="covid">
    <div class="covid__controls">
      <div class="radio-button">
        <p>Choose between Infections and Deaths</p>
        <div class="onoffswitch">
          <input type="checkbox" name="onoffswitch"
                 @click="handleDataTypeChange"
                 class="onoffswitch-checkbox" id="myonoffswitch" checked>
          <label class="onoffswitch-label" for="myonoffswitch">
            <span class="onoffswitch-inner"></span>
            <span class="onoffswitch-switch"></span>
          </label>
        </div>
<!--        <input @click="handleDataTypeChange" type="radio"-->
<!--               id="cases" name="dataType" value="Cases">-->
<!--        <label for="cases">Cases</label>-->
<!--        <input @click="handleDataTypeChange" type="radio"-->
<!--               id="deaths" name="dataType" value="Deaths">-->
<!--        <label for="deaths">Deaths</label>-->
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
      dataType: 'infections',
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
      maxDeaths: 0,
      maxCases: 0,
      numberOfDays: 70,
      nyTimesData: {
        states: '',
        counties: '',
      },
      nyTimesStartDate: '',
      paused: false,
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
    getColor(color) {
      if (color === 'deaths') {
        return d3.scaleSequentialSqrt([0, this.maxDeaths], d3.interpolateReds);
      }
      return d3.scaleSequentialSqrt([0, this.maxCases], d3.interpolateBlues);
      // return d3.scaleSequential([0, 1000], d3.interpolateBlues);
    },
    handleDataTypeChange(e) {
      console.log('handle type change');
      console.log(e);
      const { checked } = e.toElement;
      if (checked) {
        this.dataType = 'infections';
      } else {
        this.dataType = 'deaths';
      }
      this.updateInfectionColors();
      this.updateMap();
    },
    handlePlayClick() {
      const that = this;
      /**
       * Need to grab the start date, and the end date and then increment
       * play date by 1 until we get to the end date
       */
      if (this.playing === false) {
        // set playDate to startDate
        // only want to do this if we haven't paused
        // eslint-disable-next-line no-unused-expressions
        this.paused ? null : this.playDate = this.startDate;
        // change value of play button
        document.getElementsByClassName('play-button')[0].innerHTML = 'Pause';
        window.mapTimer = setInterval(() => {
          // need to have the stop functionality here
          const done = this.compareDates(this.playDate, this.endDate);
          if (done) {
            document.getElementsByClassName('play-button')[0].innerHTML = 'Play';
            clearInterval(window.mapTimer);
            this.paused = false;
            return;
          }
          that.updateInfectionColors();
          that.updateMap();
          // increment playDate
          this.playDate = new Date(this.playDate.setDate(this.playDate.getDate() + 1));
        }, 100);
        this.playing = true;
      } else {
        this.playing = false;
        this.paused = true;
        clearInterval(window.mapTimer);
        document.getElementsByClassName('play-button')[0].innerHTML = 'Play';
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
          that.renderMap();
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
    renderMap() {
      const that = this;
      let active = d3.select(null);

      const svg = d3.select('.viz').append('svg')
        .attr('class', 'center-container')
        // eslint-disable-next-line operator-linebreak
        .attr('height', this.mapMeasurements.height +
          this.mapMeasurements.margin.top + this.mapMeasurements.margin.bottom)
        // eslint-disable-next-line operator-linebreak
        .attr('width', this.mapMeasurements.width +
          this.mapMeasurements.margin.left + this.mapMeasurements.margin.right);

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
      const color = this.getColor(this.dataType);

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
    parseData() {
      this.maxCases = Math.max(
        ...this.nyTimesData.states.map((state) => parseInt(state.cases, 10)),
      );
      this.maxDeaths = Math.max(
        ...this.nyTimesData.states.map((state) => parseInt(state.deaths, 10)),
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
      console.log(this.dataType);
      if (this.dataType === 'infections') {
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
      } else {
        this.nyTimesData.states.forEach((state) => {
          const stateDate = new Date(state.date);
          if (that.compareDates(date, stateDate)) {
            that.infectionColors[state.fips] = state.deaths;
          }
        });
        this.nyTimesData.counties.forEach((county) => {
          const countyDate = new Date(county.date);
          if (that.compareDates(date, countyDate)) {
            that.infectionColors[county.fips] = county.deaths;
          }
        });
      }

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
      const color = this.getColor(this.dataType);
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
        that.renderMap();
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
