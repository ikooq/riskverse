import {planRoute} from './planner';
import type {Scene} from './model';
self.onmessage=(e:MessageEvent<Scene>)=>{try{self.postMessage(planRoute(e.data))}catch{self.postMessage({ok:false,reason:'Не удалось рассчитать маршрут. Проверьте сцену.',step:.5,visited:0})}};
