<template>
  <svg :class="graphClass" width="500" height="270"></svg>
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
      calculatePaddedTemperatureExtent() {
        let yExtent = d3.extent(this.data, d => d.fahrenheit);
        const [min, max] = yExtent;
        return [
          min - (max - min) * .1,
          max + (max - min) * .1,
        ];
      },
      buildScales() {
        const x = d3.scaleTime().range([0, 500]).domain(d3.extent(this.data, d => d.when));
        const y = d3.scaleLinear().range([270, 0]).domain(this.calculatePaddedTemperatureExtent());
        d3.axisLeft().scale(x);
        d3.axisBottom().scale(y);
        return {x, y};
      },
      calculatePath() {
        const graph = d3.select(`.${this.graphClass}`);
        const {x:scaleX, y:scaleY} = this.buildScales();
        // tear down
        graph.selectAll('path').remove();
        // build up
        const path = d3.line()
          .x(d => scaleX(d.when))
          .y(d => scaleY(d.fahrenheit));
        graph.append('path')
          .attr('stroke-width', '3px')
          .attr('stroke', '#76BF8A')
          .attr('fill', 'none')
          .attr('d', path(this.data));
      },
    },
  };
</script>
<style lang="sass" scoped>
  svg.temp-graph
    background-color: #432
    margin: 25px
</style>
