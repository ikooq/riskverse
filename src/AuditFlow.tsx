import {Check,ChevronRight} from 'lucide-react';
import type {Scene} from './model';
import {auditProgress,type AuditStage} from './auditProgress';
import './auditFlow.css';

type Props={scene:Scene;baseline:Scene;hasPhoto:boolean;onPhoto:()=>void;onPlan:()=>void;onSimulation:()=>void;onBaseline:()=>void};
export default function AuditFlow({scene,baseline,hasPhoto,onPhoto,onPlan,onSimulation,onBaseline}:Props){
 const progress=auditProgress(scene,baseline,hasPhoto);
 const next:{[key in AuditStage]:{title:string;detail:string;label:string;action:()=>void}}={
  photo:{title:'Восстановите исходную фотографию',detail:'В этой модели есть ссылки на снимок, но само изображение недоступно. Откройте полный сохранённый аудит или загрузите фото в разделе снимка.',label:'Открыть раздел фото',action:onPhoto},
  objects:{title:'Добавьте первый объект с фотографии',detail:'Выберите наблюдение AI или выделите область вручную. Задайте размеры и положение, затем нажмите «Подтвердить и добавить».',label:'Перейти к объектам на фото',action:onPhoto},
  routes:{title:!progress.hasPedestrian&&!progress.hasVehicle?'Задайте два маршрута движения':!progress.hasPedestrian?'Добавьте путь пешехода':'Добавьте путь транспорта',detail:'На плане нажмите «Нарисовать путь пешехода» или «Нарисовать путь транспорта». Укажите минимум две разные точки и примените каждый путь. Координаты можно ввести числами.',label:'Перейти к маршрутам на плане',action:onPlan},
  baseline:{title:'Зафиксируйте исходную планировку',detail:'Объекты и маршруты готовы. Сохраните их как исходный вариант перед первой перестановкой: с ним будут сравниваться последствия ваших решений.',label:'Зафиксировать исходный вариант',action:onBaseline},
  experiment:{title:'Проверьте изменение среды',detail:'Переместите объект на плане, затем посмотрите, какие замечания исчезли и появились в блоке «До и после». В симуляции можно отдельно проверить скорости и время старта.',label:'Изменить планировку на плане',action:onPlan},
 };
 const steps=[
  {id:'photo',name:'Снимок',detail:hasPhoto?'Фото доступно':progress.photoRequired?'Восстановите фото':'Можно добавить фото',done:hasPhoto,action:onPhoto},
  {id:'objects',name:'Объекты',detail:`В модели: ${scene.items.length}${progress.linkedObjects?` · с фото: ${progress.linkedObjects}`:''}`,done:progress.hasObjects,action:onPhoto},
  {id:'routes',name:'Маршруты',detail:progress.hasPedestrian&&progress.hasVehicle?'Оба пути заданы':'Нужны два пути',done:progress.hasPedestrian&&progress.hasVehicle,action:onPlan},
  {id:'baseline',name:'Исходный вариант',detail:progress.hasBaseline?'База задана':'Перед перестановкой',done:progress.hasBaseline,action:()=>{if(progress.stage==='baseline')onBaseline();else document.getElementById('scene-comparison')?.scrollIntoView({behavior:'smooth',block:'center'})}},
  {id:'experiment',name:'Эксперимент',detail:'План и движение',done:false,action:onSimulation},
 ];
 const guidance=next[progress.stage];
 return <section className="audit-guidance" aria-label="Порядок работы с аудитом">
  <nav className="audit-flow audit-flow-guided" aria-label="Этапы аудита">{steps.map((step,index)=><button key={step.id} aria-current={progress.stage===step.id?'step':undefined} onClick={step.action}>
   <span className={step.done?'done':''}>{step.done?<Check size={15}/>:index+1}</span><div><b>{step.name}</b><small>{step.detail}</small></div><ChevronRight size={14}/>
  </button>)}</nav>
  <div className="audit-next-step"><div><span className="eyebrow">СЛЕДУЮЩИЙ ШАГ</span><h2>{guidance.title}</h2><p>{guidance.detail}</p>
   {progress.stage==='experiment'&&progress.differences.length>0&&<p className="audit-condition-change">Условия сравнения изменились. В блоке «До и после» указаны различия; проверьте их перед оценкой результата.</p>}
  </div><div className="audit-next-actions"><button className="button lime" onClick={guidance.action}>{guidance.label}<ChevronRight size={15}/></button>
   {progress.stage==='experiment'&&<button className="text-button" onClick={onSimulation}>Проверить движение во времени</button>}
  </div></div>
 </section>;
}
