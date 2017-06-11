import Vue from 'vue'
import Router from 'vue-router'
import Temperature from '@/components/Temperature'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'Temperature',
      component: Temperature
    }
  ]
})
