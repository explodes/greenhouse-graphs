<template>
  <div>
    <svg :class="graphClass" width="500" height="270">
      <g style="transform: translate(0, 10px)">
        <path :d="line"></path>
      </g>
    </svg>
    <p>Temperature: Min {{ temperature.min }} Max: {{ temperature.max }}</p>
    <p>Date range: Min {{ dates.min }} Max: {{ dates.max }}</p>
  </div>
</template>
<script>
  import {Greenhouse} from '../lib/greenhouseapi'
  import * as d3 from 'd3';

  function log(x) {
    console.log(x);
    return x;
  }

  const greenhouse = new Greenhouse({statDays: 1});

  export default {
    name: 'vue-line-chart',
    data() {
      return {
        graphClass: 'temp-graph',
        greenhouse: greenhouse,
        data: [],
        updateTimer: null,
        line: '',
        temperature: {min: 0, max: 0},
        dates: {min: 0, max: 0}
      };
    },
    mounted() {
      this.startUpdates();
    },
    destroyed() {
      this.endUpdates();
    },
    methods: {
      startUpdates() {
        this.endUpdates();
        this.updateData();
        this.updateTimer = setInterval(this.updateData, 2000);
      },
      endUpdates() {
        if (this.updateTimer !== null) {
          clearInterval(this.updateTimer);
          this.updateTimer = null;
        }
      },
      updateData() {
        this.greenhouse.temperature()
          .then(items => {
            items.forEach(item => {
              // convert to Fahrenheit
              item.fahrenheit = item.value * (5. / 9.) + 32.;
            });
            return items;
          })
          .then(items => {
            if (items.length > 100) {
              items = items.slice(items.length - 100);
            }
            this.data = items;
            this.calculatePath();
          });
      },
      calculateExtents() {
        let yExtent = d3.extent(this.data, d => d.fahrenheit);
        const [min, max] = yExtent;
        yExtent = [
          min - (max - min) * .1,
          max + (max - min) * .1,
        ];
        [this.temperature.min, this.temperature.max] = yExtent;
        const xExtent = d3.extent(this.data, d => d.when);
        [this.dates.min, this.dates.max] = xExtent;
        return [xExtent, yExtent];
      },
      buildScales() {
        const [xExtent, yExtent] = this.calculateExtents();
        const x = d3.scaleTime().range([0, 500]).domain(xExtent);
        const y = d3.scaleLinear().range([270, 0]).domain(yExtent);
        d3.axisLeft().scale(x);
        d3.axisBottom().scale(y);
        return {x, y};
      },
      calculatePath() {
        const {x: scaleX, y: scaleY} = this.buildScales();
        const path = d3.line()
          .x(d => scaleX(d.when))
          .y(d => scaleY(d.fahrenheit));
        this.line = path(this.data);
      },
    },
  };
</script>
<style lang="sass" scoped>
  svg.temp-graph
    background-color: #432
    margin: 25px
    path
      stroke-width: 3px
      stroke: #76bf8a
      fill: none
</style>
