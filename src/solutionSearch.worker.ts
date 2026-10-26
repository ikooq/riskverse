import {searchSolutions} from './solutionSearch';
import type {Scene} from './model';
self.onmessage=(event:MessageEvent<Scene>)=>{try{self.postMessage({ok:true,result:searchSolutions(event.data)})}catch{self.postMessage({ok:false,error:'Не удалось рассчитать варианты. Исходный план сохранён.'})}};
