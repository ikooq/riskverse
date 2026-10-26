import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,RotateCcw,X} from 'lucide-react';
import {analyze,pathLength,type Scene,type Point} from './model';
import type {RouteResult} from './planner';
type Props={scene:Scene;onApply:(scene:Scene)=>void;onPreview:(points:Point[]|null)=>void;onShowPlan:()=>void};
export default function RoutePlanner({scene,onApply,onPreview,onShowPlan}:Props){
 const [result,setResult]=useState<{source:Scene;value:RouteResult}|null>(null),[busy,setBusy]=useState(false),[undo,setUndo]=useState<{before:Scene;after:Scene}|null>(null),[error,setError]=useState('');
 const worker=useRef<Worker|null>(null);
 useEffect(()=>{worker.current?.terminate();setBusy(false);setResult(null);onPreview(null);setError('');return()=>worker.current?.terminate()},[scene,onPreview]);
 const search=()=>{worker.current?.terminate();setResult(null);onPreview(null);setBusy(true);setError('');onShowPlan();const w=new Worker(new URL('./planner.worker.ts',import.meta.url),{type:'module'});worker.current=w;w.onmessage=(e:MessageEvent<RouteResult>)=>{setBusy(false);setResult({source:scene,value:e.data});if(e.data.ok)onPreview(e.data.path);w.terminate()};w.onerror=()=>{setBusy(false);setError('Ошибка расчёта. Попробуйте снова.');w.terminate()};w.postMessage(scene)};
 const current=result?.source===scene?result.value:null;
 const candidate=current?.ok?{...scene,pedestrian:current.path}:null;
 const before=analyze(scene),after=candidate?analyze(candidate):[];
 return <div className="route-planner"><div className="planner-actions"><button className="button lime" disabled={busy} onClick={search}>{busy?'Ищем обход…':'Найти обход'}<ArrowUpRight size={16}/></button>{busy&&<button className="button" onClick={()=>{worker.current?.terminate();setBusy(false)}}>Отменить поиск</button>}{undo?.after===scene&&<button className="button" onClick={()=>{onApply(undo.before);setUndo(null)}}><RotateCcw size={14}/>Отменить применение</button>}</div>
 {error&&<p role="alert">{error}</p>}{current&&!current.ok&&<div className="route-result" role="status"><b>Маршрут не изменён</b><p>{current.reason}</p></div>}
 {current?.ok&&candidate&&<div className="route-result" role="status"><div className="route-result-title"><b>{current.separated?'Найден обход вне транспортного коридора':'Найден обход препятствий'}</b><button className="icon-button" aria-label="Закрыть предложение" onClick={()=>{setResult(null);onPreview(null)}}><X size={14}/></button></div><p>{current.separated?'Начало и конец пути сохранены.':'Транспортный коридор остаётся затронут. Полное разделение на сетке не найдено.'} Промежуточные точки заменены; проверьте доступ к рабочим местам.</p><div className="route-stats"><span>Замечания<b>{before.length} → {after.length}</b></span><span>Длина пути<b>{pathLength(scene.pedestrian).toFixed(1)} → {pathLength(current.path).toFixed(1)} м</b></span><span>Конечные точки<b>Сохранены</b></span></div><button className="button lime" onClick={()=>{setUndo({before:scene,after:candidate});onApply(candidate);onPreview(null);setResult(null)}}><Check size={14}/>Применить маршрут</button><small>Поиск на сетке 0,5 м · транспортный коридор принят шириной 1,2 м · не оценка безопасности</small></div>}
 </div>
}
