import Vue from 'vue';
import {
  Button,
  DatePicker,
  Slider,
} from 'element-ui';
import lang from 'element-ui/lib/locale/lang/en';
import locale from 'element-ui/lib/locale';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import store from './store';
import './assets/scss/element-variables.scss';

locale.use(lang);

Vue.config.productionTip = false;

Vue.use(Button);
Vue.use(DatePicker);
Vue.use(Slider);

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
