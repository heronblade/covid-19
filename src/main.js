import Vue from 'vue';
import { Slider } from 'element-ui';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import store from './store';
import './assets/scss/element-variables.scss';

Vue.config.productionTip = false;

Vue.use(Slider);

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
